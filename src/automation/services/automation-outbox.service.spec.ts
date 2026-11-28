import { AutomationOutboxEvent } from '../entities/automation-outbox-event.entity';
import {
  AutomationEventType,
  AutomationOutboxStatus,
} from '../enums/automation-event.enums';
import { AutomationEventDispatcher } from './automation-event-dispatcher.service';
import { AutomationOutboxService } from './automation-outbox.service';

type SaveManagerMock = jest.Mock<
  Promise<AutomationOutboxEvent>,
  [unknown, AutomationOutboxEvent]
>;

type ManagerMock = {
  create: jest.Mock<AutomationOutboxEvent, [unknown, Record<string, unknown>]>;
  find: jest.Mock<Promise<AutomationOutboxEvent[]>, []>;
  save: SaveManagerMock;
};

type DispatchMock = jest.Mock<Promise<void>, [AutomationOutboxEvent]>;

type SaveOutboxMock = jest.Mock<
  Promise<AutomationOutboxEvent>,
  [AutomationOutboxEvent]
>;

describe('AutomationOutboxService', () => {
  const createManager = (
    save: SaveManagerMock = jest.fn<
      Promise<AutomationOutboxEvent>,
      [unknown, AutomationOutboxEvent]
    >((_entity, event) => Promise.resolve(event)),
  ): ManagerMock => ({
    create: jest.fn<AutomationOutboxEvent, [unknown, Record<string, unknown>]>(
      (_entity, data) =>
        ({
          ...data,
          attemptCount: 0,
          status: AutomationOutboxStatus.PENDING,
        }) as unknown as AutomationOutboxEvent,
    ),
    find: jest.fn<Promise<AutomationOutboxEvent[]>, []>().mockResolvedValue([]),
    save,
  });

  const createService = (
    manager: ManagerMock,
    dispatch: DispatchMock = jest
      .fn<Promise<void>, [AutomationOutboxEvent]>()
      .mockResolvedValue(undefined),
    saved: SaveOutboxMock = jest.fn<
      Promise<AutomationOutboxEvent>,
      [AutomationOutboxEvent]
    >((event) => Promise.resolve(event)),
  ) => {
    const dataSource = {
      transaction: jest.fn(
        (callback: (value: ManagerMock) => Promise<unknown>) =>
          callback(manager),
      ),
    };
    const outboxRepo = { save: saved };
    const dispatcher = { dispatch } as unknown as AutomationEventDispatcher;
    const service = new AutomationOutboxService(
      outboxRepo as never,
      dataSource as never,
      dispatcher,
    );
    return {
      service,
      manager,
      dataSource,
      outboxRepo,
      dispatcher,
      dispatch,
      saved,
    };
  };

  const input = {
    type: AutomationEventType.PAYMENT_APPROVED,
    schoolId: 'school-a',
    aggregateType: 'PaymentSubmissionStudentShare',
    aggregateId: 'share-a',
    actorId: 'admin-a',
    payload: { studentIds: ['student-a'] },
  };

  it('writes a durable event into the supplied transaction manager', async () => {
    const manager = createManager();
    const { service } = createService(manager);

    const event = await service.enqueue(manager as never, input);

    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(event?.type).toBe(AutomationEventType.PAYMENT_APPROVED);
    expect(event?.schoolId).toBe('school-a');
    expect(event?.payload).toEqual({
      studentIds: ['student-a'],
      schoolId: 'school-a',
    });
    expect(event?.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates stable idempotency keys across payload key ordering', async () => {
    const manager = createManager();
    const { service } = createService(manager);

    const first = await service.enqueue(manager as never, {
      ...input,
      payload: { a: 1, b: 2 },
    });
    const second = await service.enqueue(manager as never, {
      ...input,
      payload: { b: 2, a: 1 },
    });

    expect(first?.idempotencyKey).toBe(second?.idempotencyKey);
  });

  it('ignores duplicate idempotency keys', async () => {
    const save = jest
      .fn<Promise<AutomationOutboxEvent>, [unknown, AutomationOutboxEvent]>()
      .mockRejectedValueOnce({ code: '23505' })
      .mockResolvedValueOnce({
        id: 'event-a',
      } as unknown as AutomationOutboxEvent);
    const manager = createManager(save);
    const { service } = createService(manager);

    const event = await service.enqueue(manager as never, input);

    expect(event).toBeNull();
  });

  it('marks a failed event for retry with backoff', async () => {
    const manager = createManager();
    const dispatch = jest
      .fn<Promise<void>, [AutomationOutboxEvent]>()
      .mockRejectedValue(new Error('refresh failed'));
    const saved = jest.fn<
      Promise<AutomationOutboxEvent>,
      [AutomationOutboxEvent]
    >((event) => Promise.resolve(event));
    const { service, dataSource } = createService(manager, dispatch, saved);
    const event = {
      id: 'event-a',
      status: AutomationOutboxStatus.PENDING,
      attemptCount: 0,
      type: AutomationEventType.PAYMENT_APPROVED,
      schoolId: 'school-a',
      availableAt: new Date(),
    } as AutomationOutboxEvent;
    manager.find.mockResolvedValue([event]);

    const processed = await service.processBatch();

    expect(processed).toBe(1);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(event);
    expect(event.status).toBe(AutomationOutboxStatus.FAILED);
    expect(event.attemptCount).toBe(1);
    expect(event.failureReason).toBe('refresh failed');
    expect(event.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(saved).toHaveBeenCalledWith(event);
  });

  it('dead-letters an event after the attempt limit', async () => {
    const manager = createManager();
    const dispatch = jest
      .fn<Promise<void>, [AutomationOutboxEvent]>()
      .mockRejectedValue(new Error('still failing'));
    const { service } = createService(manager, dispatch);
    const event = {
      id: 'event-a',
      status: AutomationOutboxStatus.PENDING,
      attemptCount: 7,
      type: AutomationEventType.PAYMENT_APPROVED,
      schoolId: 'school-a',
      availableAt: new Date(),
    } as AutomationOutboxEvent;
    manager.find.mockResolvedValue([event]);

    await service.processBatch();

    expect(event.status).toBe(AutomationOutboxStatus.DEAD);
    expect(event.attemptCount).toBe(8);
  });

  it('marks a successful event complete', async () => {
    const manager = createManager();
    const { service } = createService(manager);
    const event = {
      id: 'event-a',
      status: AutomationOutboxStatus.PENDING,
      attemptCount: 0,
      type: AutomationEventType.PAYMENT_APPROVED,
      schoolId: 'school-a',
      availableAt: new Date(),
    } as AutomationOutboxEvent;
    manager.find.mockResolvedValue([event]);

    await service.processBatch();

    expect(event.status).toBe(AutomationOutboxStatus.COMPLETED);
    expect(event.processedAt).toBeInstanceOf(Date);
  });
});

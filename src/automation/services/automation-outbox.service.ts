import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import {
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { AutomationOutboxEvent } from '../entities/automation-outbox-event.entity';
import {
  AutomationEventType,
  AutomationOutboxStatus,
} from '../enums/automation-event.enums';
import { EnqueueAutomationEventInput } from '../interfaces/automation-event.interface';
import { AutomationEventDispatcher } from './automation-event-dispatcher.service';

const BATCH_SIZE = 25;
const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 8;

@Injectable()
export class AutomationOutboxService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private processing = false;
  private readonly workerEnabled =
    process.env.NODE_ENV !== 'test' &&
    process.env.AUTOMATION_OUTBOX_WORKER !== 'disabled';

  constructor(
    @InjectRepository(AutomationOutboxEvent)
    private readonly outboxRepo: Repository<AutomationOutboxEvent>,
    private readonly dataSource: DataSource,
    private readonly dispatcher: AutomationEventDispatcher,
  ) {}

  onModuleInit(): void {
    if (!this.workerEnabled) return;
    this.timer = setInterval(() => {
      void this.processBatch();
    }, POLL_INTERVAL_MS);
    this.timer.unref?.();
    void this.processBatch();
  }

  onModuleDestroy(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  enqueue = async (
    manager: EntityManager,
    input: EnqueueAutomationEventInput,
  ): Promise<AutomationOutboxEvent | null> => {
    if (!input.schoolId) {
      throw new BadRequestException('Automation events require a school scope');
    }
    const payload = {
      ...(input.payload ?? {}),
      schoolId: input.schoolId,
    };
    const event = manager.create(AutomationOutboxEvent, {
      id: randomUUID(),
      schoolId: input.schoolId,
      type: input.type,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId ?? null,
      actorId: input.actorId ?? null,
      payload,
      status: AutomationOutboxStatus.PENDING,
      attemptCount: 0,
      availableAt: input.availableAt ?? new Date(),
      idempotencyKey:
        input.idempotencyKey ?? this.buildIdempotencyKey(input, payload),
    });
    try {
      const saved = await manager.save(AutomationOutboxEvent, event);
      this.scheduleProcessing();
      return saved;
    } catch (error) {
      if (this.isUniqueViolation(error)) return null;
      throw error;
    }
  };

  enqueueMany = async (
    manager: EntityManager,
    inputs: EnqueueAutomationEventInput[],
  ): Promise<AutomationOutboxEvent[]> => {
    const events: AutomationOutboxEvent[] = [];
    for (const input of inputs) {
      const event = await this.enqueue(manager, input);
      if (event) events.push(event);
    }
    return events;
  };

  processBatch = async (batchSize = BATCH_SIZE): Promise<number> => {
    if (this.processing) return 0;
    this.processing = true;
    try {
      const events = await this.claimBatch(batchSize);
      for (const event of events) {
        await this.processEvent(event);
      }
      return events.length;
    } finally {
      this.processing = false;
    }
  };

  private scheduleProcessing = (): void => {
    if (!this.workerEnabled || this.processing) return;
    setImmediate(() => {
      void this.processBatch();
    });
  };

  private claimBatch = async (
    batchSize: number,
  ): Promise<AutomationOutboxEvent[]> => {
    return this.dataSource.transaction(async (manager) => {
      const events = await manager.find(AutomationOutboxEvent, {
        where: {
          status: In([
            AutomationOutboxStatus.PENDING,
            AutomationOutboxStatus.FAILED,
          ]),
          availableAt: LessThanOrEqual(new Date()),
        },
        order: { createdAt: 'ASC' },
        take: batchSize,
        lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
      });
      if (events.length === 0) return [];
      const now = new Date();
      for (const event of events) {
        event.status = AutomationOutboxStatus.PROCESSING;
        event.attemptCount += 1;
        event.lastAttemptAt = now;
      }
      await manager.save(AutomationOutboxEvent, events);
      return events;
    });
  };

  private processEvent = async (
    event: AutomationOutboxEvent,
  ): Promise<void> => {
    try {
      await this.dispatcher.dispatch(event);
      event.status = AutomationOutboxStatus.COMPLETED;
      event.processedAt = new Date();
      event.failureReason = null;
    } catch (error) {
      event.failureReason = this.errorMessage(error);
      event.status =
        event.attemptCount >= MAX_ATTEMPTS
          ? AutomationOutboxStatus.DEAD
          : AutomationOutboxStatus.FAILED;
      if (event.status === AutomationOutboxStatus.FAILED) {
        event.availableAt = new Date(
          Date.now() + this.retryDelay(event.attemptCount),
        );
      }
    }
    await this.outboxRepo.save(event);
  };

  private retryDelay = (attemptCount: number): number =>
    Math.min(5000 * 2 ** Math.max(0, attemptCount - 1), 15 * 60 * 1000);

  private errorMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, 2000);
  };

  private buildIdempotencyKey = (
    input: EnqueueAutomationEventInput,
    payload: Record<string, unknown>,
  ): string => {
    const canonical = JSON.stringify([
      input.type,
      input.schoolId,
      input.aggregateType,
      input.aggregateId ?? null,
      this.stableValue(payload),
    ]);
    return createHash('sha256').update(canonical).digest('hex');
  };

  private stableValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(this.stableValue);
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = this.stableValue(
            (value as Record<string, unknown>)[key],
          );
          return sorted;
        }, {});
    }
    return value;
  };

  private isUniqueViolation = (error: unknown): boolean =>
    (error as { code?: unknown } | null)?.code === '23505';
}

export { AutomationEventType };

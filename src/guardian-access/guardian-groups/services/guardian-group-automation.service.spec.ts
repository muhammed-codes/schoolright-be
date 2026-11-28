import { Repository } from 'typeorm';
import { AutomationOutboxEvent } from '../../../automation/entities/automation-outbox-event.entity';
import { AutomationEventType } from '../../../automation/enums/automation-event.enums';
import {
  AutomationEventHandler,
  AutomationEventDispatcher,
} from '../../../automation/services/automation-event-dispatcher.service';
import { GuardianGroup } from '../entities/guardian-group.entity';
import { GuardianGroupType } from '../enums/guardian-group.enums';
import { GuardianGroupMembershipService } from './guardian-group-membership.service';
import {
  AUTOMATION_SYSTEM_ACTOR_ID,
  GuardianGroupAutomationService,
} from './guardian-group-automation.service';

type RegisterMock = jest.Mock<
  void,
  [AutomationEventType[], AutomationEventHandler]
>;

type GroupRepoMock = {
  find: jest.Mock<Promise<GuardianGroup[]>, []>;
};

type MembershipMock = {
  syncGroup: jest.Mock<Promise<unknown>, [GuardianGroup, string]>;
};

describe('GuardianGroupAutomationService', () => {
  const build = () => {
    const groupRepo: GroupRepoMock = {
      find: jest.fn<Promise<GuardianGroup[]>, []>(),
    };
    const membershipService: MembershipMock = {
      syncGroup: jest
        .fn<Promise<unknown>, [GuardianGroup, string]>()
        .mockResolvedValue(null),
    };
    const register: RegisterMock = jest.fn<
      void,
      [AutomationEventType[], AutomationEventHandler]
    >();
    const dispatcher = { register };
    const service = new GuardianGroupAutomationService(
      groupRepo as unknown as Repository<GuardianGroup>,
      membershipService as unknown as GuardianGroupMembershipService,
      dispatcher as unknown as AutomationEventDispatcher,
    );
    return { service, groupRepo, membershipService, dispatcher };
  };

  const event = (overrides: Partial<AutomationOutboxEvent> = {}) =>
    ({
      type: AutomationEventType.PAYMENT_APPROVED,
      schoolId: 'school-a',
      actorId: null,
      payload: {},
      ...overrides,
    }) as AutomationOutboxEvent;

  it('registers the derived-data refresh handlers', () => {
    const { service, dispatcher } = build();

    service.onModuleInit();

    expect(dispatcher.register).toHaveBeenCalledTimes(1);
    const [types, handler] = dispatcher.register.mock.calls[0];
    expect(types).toContain(AutomationEventType.PAYMENT_APPROVED);
    expect(types).toContain(AutomationEventType.STUDENT_CLASS_CHANGED);
    expect(typeof handler).toBe('function');
  });

  it('refreshes active dynamic groups for the event school', async () => {
    const { service, dispatcher, groupRepo, membershipService } = build();
    const groups = [
      { id: 'group-a', schoolId: 'school-a' },
      { id: 'group-b', schoolId: 'school-a' },
    ] as unknown as GuardianGroup[];
    groupRepo.find.mockResolvedValue(groups);
    service.onModuleInit();
    const handler = dispatcher.register.mock.calls[0][1];

    await handler(event({ actorId: 'admin-a' }));

    expect(groupRepo.find).toHaveBeenCalledWith({
      where: {
        schoolId: 'school-a',
        type: GuardianGroupType.DYNAMIC,
        isActive: true,
        isDeleted: false,
      },
    });
    expect(membershipService.syncGroup).toHaveBeenCalledTimes(2);
    expect(membershipService.syncGroup).toHaveBeenCalledWith(
      groups[0],
      'admin-a',
    );
  });

  it('uses a system actor and narrows to supplied group ids', async () => {
    const { service, dispatcher, groupRepo, membershipService } = build();
    const group = {
      id: 'group-a',
      schoolId: 'school-a',
    } as unknown as GuardianGroup;
    groupRepo.find.mockResolvedValue([group]);
    service.onModuleInit();
    const handler = dispatcher.register.mock.calls[0][1];

    await handler(event({ payload: { groupIds: ['group-a'] } }));

    expect(groupRepo.find).toHaveBeenCalledWith({
      where: {
        schoolId: 'school-a',
        type: GuardianGroupType.DYNAMIC,
        isActive: true,
        isDeleted: false,
        id: expect.anything(),
      },
    });
    expect(membershipService.syncGroup).toHaveBeenCalledWith(
      group,
      AUTOMATION_SYSTEM_ACTOR_ID,
    );
  });

  it('ignores event types that do not affect group membership', async () => {
    const { service, dispatcher, groupRepo } = build();
    service.onModuleInit();
    const handler = dispatcher.register.mock.calls[0][1];

    await handler(
      event({ type: AutomationEventType.GUARDIAN_ACCESS_POLICY_CHANGED }),
    );

    expect(groupRepo.find).not.toHaveBeenCalled();
  });
});

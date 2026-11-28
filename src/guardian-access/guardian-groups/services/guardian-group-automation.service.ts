import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AutomationEventType } from '../../../automation/enums/automation-event.enums';
import { AutomationOutboxEvent } from '../../../automation/entities/automation-outbox-event.entity';
import { AutomationEventDispatcher } from '../../../automation/services/automation-event-dispatcher.service';
import { GuardianGroup } from '../entities/guardian-group.entity';
import { GuardianGroupType } from '../enums/guardian-group.enums';
import { GuardianGroupMembershipService } from './guardian-group-membership.service';

export const AUTOMATION_SYSTEM_ACTOR_ID =
  '00000000-0000-0000-0000-000000000000';

@Injectable()
export class GuardianGroupAutomationService implements OnModuleInit {
  private readonly refreshTypes = new Set<AutomationEventType>([
    AutomationEventType.PAYMENT_APPROVED,
    AutomationEventType.PAYMENT_REVERSED,
    AutomationEventType.FEE_ALLOCATION_CHANGED,
    AutomationEventType.FEE_DISCOUNT_CHANGED,
    AutomationEventType.FEE_WAIVER_CHANGED,
    AutomationEventType.INVOICE_CHANGED,
    AutomationEventType.STUDENT_CLASS_CHANGED,
    AutomationEventType.STUDENT_STATUS_CHANGED,
    AutomationEventType.GUARDIAN_RELATIONSHIP_ADDED,
    AutomationEventType.GUARDIAN_RELATIONSHIP_CHANGED,
    AutomationEventType.GUARDIAN_RELATIONSHIP_REMOVED,
    AutomationEventType.GUARDIAN_GROUP_CONDITION_CHANGED,
    AutomationEventType.GUARDIAN_GROUP_ACTIVATED,
    AutomationEventType.TERM_CHANGED,
  ]);

  constructor(
    @InjectRepository(GuardianGroup)
    private readonly groupRepo: Repository<GuardianGroup>,
    private readonly membershipService: GuardianGroupMembershipService,
    private readonly dispatcher: AutomationEventDispatcher,
  ) {}

  onModuleInit(): void {
    this.dispatcher.register(Array.from(this.refreshTypes), this.refresh);
  }

  private refresh = async (event: AutomationOutboxEvent): Promise<void> => {
    if (!this.refreshTypes.has(event.type) || !event.schoolId) return;
    const groupIds = Array.isArray(event.payload?.groupIds)
      ? (event.payload.groupIds as unknown[]).filter(
          (id): id is string => typeof id === 'string',
        )
      : [];
    const groups = await this.groupRepo.find({
      where: {
        schoolId: event.schoolId,
        type: GuardianGroupType.DYNAMIC,
        isActive: true,
        isDeleted: false,
        ...(groupIds.length > 0 ? { id: In(groupIds) } : {}),
      },
    });
    const actorId =
      typeof event.actorId === 'string' && event.actorId
        ? event.actorId
        : AUTOMATION_SYSTEM_ACTOR_ID;
    for (const group of groups) {
      await this.membershipService.syncGroup(group, actorId);
    }
  };
}

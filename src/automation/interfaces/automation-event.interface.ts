import { AutomationEventType } from '../enums/automation-event.enums';

export interface AutomationEventPayload {
  schoolId: string;
  actorId?: string | null;
  studentIds?: string[];
  guardianIds?: string[];
  groupIds?: string[];
  policyIds?: string[];
  aggregateId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EnqueueAutomationEventInput {
  type: AutomationEventType;
  schoolId: string;
  aggregateType: string;
  aggregateId?: string | null;
  actorId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  availableAt?: Date;
}

import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import {
  AutomationEventType,
  AutomationOutboxStatus,
} from '../enums/automation-event.enums';

@Entity('automation_outbox_events')
@Index('IDX_automation_outbox_status_available', ['status', 'availableAt'])
@Index('IDX_automation_outbox_school_created', ['schoolId', 'createdAt'])
@Index('UQ_automation_outbox_idempotency', ['idempotencyKey'], {
  unique: true,
})
export class AutomationOutboxEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Column({
    type: 'enum',
    enum: AutomationEventType,
    enumName: 'automation_event_type_enum',
  })
  type!: AutomationEventType;

  @Column()
  aggregateType!: string;

  @Column({ type: 'uuid', nullable: true })
  aggregateId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorId?: string | null;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: AutomationOutboxStatus,
    enumName: 'automation_outbox_status_enum',
    default: AutomationOutboxStatus.PENDING,
  })
  status!: AutomationOutboxStatus;

  @Column({ type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ type: 'timestamp', default: () => 'now()' })
  availableAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastAttemptAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ type: 'varchar', length: 128 })
  idempotencyKey!: string;
}

import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import {
  AnnouncementDeliveryChannel,
  AnnouncementDeliveryStatus,
  AnnouncementRecipientKind,
} from '../enums/announcement-targeting.enums';

@ObjectType()
@Entity('announcement_deliveries')
@Index(
  'UQ_announcement_deliveries_announcement_user_channel',
  ['announcementId', 'userId', 'channel'],
  { unique: true },
)
@Index('IDX_announcement_deliveries_status', ['status'])
@Index('IDX_announcement_deliveries_announcement', ['announcementId'])
export class AnnouncementDelivery extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Field()
  @Column({ type: 'uuid' })
  announcementId!: string;

  @Field()
  @Column({ type: 'uuid' })
  recipientId!: string;

  @Field()
  @Column({ type: 'uuid' })
  userId!: string;

  @Field(() => AnnouncementDeliveryChannel)
  @Column({ type: 'enum', enum: AnnouncementDeliveryChannel })
  channel!: AnnouncementDeliveryChannel;

  @Field(() => AnnouncementDeliveryStatus)
  @Column({
    type: 'enum',
    enum: AnnouncementDeliveryStatus,
    default: AnnouncementDeliveryStatus.PENDING,
  })
  status!: AnnouncementDeliveryStatus;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  attemptCount!: number;

  @Field()
  @Column({ type: 'varchar', unique: true })
  idempotencyKey!: string;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  lastAttemptAt!: Date | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  sentAt!: Date | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  deliveredAt!: Date | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  failedAt!: Date | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  failureReason!: string | null;

  recipient?: {
    recipientName?: string | null;
    recipientEmail?: string | null;
    recipientKind?: AnnouncementRecipientKind;
    qualifyingStudentIds?: string[];
    audienceSources?: string[];
  } | null;
}

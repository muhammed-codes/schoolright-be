import { Field, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from '../../common/scalars/json-object.scalar';
import {
  AnnouncementDeliveryChannel,
  AnnouncementDeliveryStatus,
  AnnouncementRecipientKind,
} from '../enums/announcement-targeting.enums';

@ObjectType()
export class AnnouncementAudienceGuardianType {
  @Field()
  guardianId!: string;

  @Field()
  guardianName!: string;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => [String])
  qualifyingStudentIds!: string[];

  @Field(() => [String])
  sources!: string[];
}

@ObjectType()
export class AnnouncementAudiencePreviewType {
  @Field(() => Int)
  uniqueGuardianCount!: number;

  @Field(() => Int)
  qualifiedStudentCount!: number;

  @Field(() => Int)
  excludedCount!: number;

  @Field(() => Int)
  unevaluableCount!: number;

  @Field(() => [String])
  warnings!: string[];

  @Field(() => GraphQLJSONObject)
  breakdown!: Record<string, unknown>;

  @Field(() => GraphQLJSONObject)
  selectedGroups!: Record<string, unknown>[];

  @Field(() => [AnnouncementAudienceGuardianType])
  guardians!: AnnouncementAudienceGuardianType[];

  @Field()
  generatedAt!: Date;
}

@ObjectType()
export class AnnouncementDeliverySummaryType {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  pending!: number;

  @Field(() => Int)
  processing!: number;

  @Field(() => Int)
  sent!: number;

  @Field(() => Int)
  delivered!: number;

  @Field(() => Int)
  failed!: number;

  @Field(() => Int)
  read!: number;

  @Field(() => Int)
  successful!: number;
}

@ObjectType()
export class AnnouncementDeliveryReportItemType {
  @Field()
  id!: string;

  @Field()
  announcementId!: string;

  @Field()
  userId!: string;

  @Field(() => String, { nullable: true })
  recipientName?: string | null;

  @Field(() => String, { nullable: true })
  recipientEmail?: string | null;

  @Field(() => AnnouncementRecipientKind)
  recipientKind!: AnnouncementRecipientKind;

  @Field(() => [String])
  qualifyingStudentIds!: string[];

  @Field(() => GraphQLJSONObject)
  audienceSources!: string[];

  @Field(() => AnnouncementDeliveryChannel)
  channel!: AnnouncementDeliveryChannel;

  @Field(() => AnnouncementDeliveryStatus)
  status!: AnnouncementDeliveryStatus;

  @Field(() => Int)
  attemptCount!: number;

  @Field(() => Date, { nullable: true })
  lastAttemptAt?: Date | null;

  @Field(() => Date, { nullable: true })
  sentAt?: Date | null;

  @Field(() => Date, { nullable: true })
  deliveredAt?: Date | null;

  @Field(() => Date, { nullable: true })
  readAt?: Date | null;

  @Field(() => String, { nullable: true })
  failureReason?: string | null;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class AnnouncementReadStateType {
  @Field()
  announcementId!: string;

  @Field(() => Boolean)
  isRead!: boolean;

  @Field(() => Date, { nullable: true })
  readAt!: Date | null;
}

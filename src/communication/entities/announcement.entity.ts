import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { GraphQLJSONObject } from '../../common/scalars/json-object.scalar';

export enum AnnouncementAudience {
  SCHOOL = 'school',
  STAFF = 'staff',
  GUARDIANS = 'guardians',
  CLASS = 'class',
  GUARDIAN_GROUP = 'guardian_group',
  CUSTOM_GUARDIANS = 'custom_guardians',
  MANUAL_STUDENTS = 'manual_students',
  MANUAL_GUARDIANS = 'manual_guardians',
}

export enum AnnouncementStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

registerEnumType(AnnouncementAudience, { name: 'AnnouncementAudience' });
registerEnumType(AnnouncementStatus, { name: 'AnnouncementStatus' });

@ObjectType()
@Entity('announcements')
@Index('IDX_announcements_school_status', ['schoolId', 'status'])
export class Announcement extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Field()
  @Column({ type: 'uuid' })
  createdById!: string;

  @Field()
  @Column()
  title!: string;

  @Field()
  @Column({ type: 'text' })
  body!: string;

  @Field(() => AnnouncementAudience)
  @Column({ type: 'enum', enum: AnnouncementAudience })
  audience!: AnnouncementAudience;

  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  targetClassId!: string | null;

  @Field(() => AnnouncementStatus)
  @Column({
    type: 'enum',
    enum: AnnouncementStatus,
    default: AnnouncementStatus.DRAFT,
  })
  status!: AnnouncementStatus;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  publishedAt!: Date | null;

  @Field(() => [String], { nullable: true })
  @Column({ type: 'uuid', array: true, nullable: true, default: '{}' })
  targetGroupIds!: string[];

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  audienceCondition!: Record<string, any> | null;

  @Field(() => [String], { nullable: true })
  @Column({ type: 'uuid', array: true, nullable: true, default: '{}' })
  manualStudentIds!: string[];

  @Field(() => [String], { nullable: true })
  @Column({ type: 'uuid', array: true, nullable: true, default: '{}' })
  manualGuardianIds!: string[];

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  audienceSnapshot!: Record<string, any> | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  audienceResolvedAt!: Date | null;
}

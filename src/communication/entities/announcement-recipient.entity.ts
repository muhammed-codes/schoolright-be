import { Field, ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { GraphQLJSONObject } from '../../common/scalars/json-object.scalar';
import { AnnouncementRecipientKind } from '../enums/announcement-targeting.enums';

@ObjectType()
@Entity('announcement_recipients')
@Index(
  'UQ_announcement_recipients_announcement_user',
  ['announcementId', 'userId'],
  {
    unique: true,
  },
)
@Index('IDX_announcement_recipients_school_user', ['schoolId', 'userId'])
export class AnnouncementRecipient extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Field()
  @Column({ type: 'uuid' })
  announcementId!: string;

  @Field()
  @Column({ type: 'uuid' })
  userId!: string;

  @Field(() => AnnouncementRecipientKind)
  @Column({
    type: 'enum',
    enum: AnnouncementRecipientKind,
  })
  recipientKind!: AnnouncementRecipientKind;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  recipientName!: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  recipientEmail!: string | null;

  @Field(() => [String])
  @Column({ type: 'uuid', array: true, default: '{}' })
  qualifyingStudentIds!: string[];

  @Field(() => GraphQLJSONObject)
  @Column({ type: 'jsonb', default: '[]' })
  audienceSources!: any;

  @Field(() => GraphQLJSONObject)
  @Column({ type: 'jsonb', default: '{}' })
  snapshot!: Record<string, any>;
}

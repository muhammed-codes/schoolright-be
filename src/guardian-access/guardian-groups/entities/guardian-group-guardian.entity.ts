import { Field, ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  GuardianGroupMembershipSource,
  GuardianGroupMembershipState,
} from '../enums/guardian-group.enums';

@ObjectType()
@Entity('guardian_group_guardians')
@Unique('UQ_guardian_group_guardians_group_guardian', ['groupId', 'guardianId'])
@Index('IDX_guardian_group_guardians_group_state', ['groupId', 'state'])
@Index('IDX_guardian_group_guardians_school_guardian', [
  'schoolId',
  'guardianId',
])
export class GuardianGroupGuardian extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  groupId!: string;

  @Field()
  @Column({ type: 'uuid' })
  guardianId!: string;

  @Field()
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Field(() => [String], { nullable: true, defaultValue: [] })
  @Column({ type: 'uuid', array: true, default: '{}' })
  qualifyingStudentIds!: string[];

  @Field(() => GuardianGroupMembershipSource)
  @Column({ type: 'enum', enum: GuardianGroupMembershipSource })
  source!: GuardianGroupMembershipSource;

  @Field(() => GuardianGroupMembershipState)
  @Column({ type: 'enum', enum: GuardianGroupMembershipState })
  state!: GuardianGroupMembershipState;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  evaluatedAt?: Date | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  actorId?: string | null;
}

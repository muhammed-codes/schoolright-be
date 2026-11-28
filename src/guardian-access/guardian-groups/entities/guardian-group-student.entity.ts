import { Field, ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { GraphQLJSONObject } from '../../../common/scalars/json-object.scalar';
import {
  GuardianGroupMembershipSource,
  GuardianGroupMembershipState,
} from '../enums/guardian-group.enums';

@ObjectType()
@Entity('guardian_group_students')
@Unique('UQ_guardian_group_students_group_student', ['groupId', 'studentId'])
@Index('IDX_guardian_group_students_group_state', ['groupId', 'state'])
@Index('IDX_guardian_group_students_school_student', ['schoolId', 'studentId'])
export class GuardianGroupStudent extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  groupId!: string;

  @Field()
  @Column({ type: 'uuid' })
  studentId!: string;

  @Field()
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Field(() => GuardianGroupMembershipSource)
  @Column({ type: 'enum', enum: GuardianGroupMembershipSource })
  source!: GuardianGroupMembershipSource;

  @Field(() => GuardianGroupMembershipState)
  @Column({ type: 'enum', enum: GuardianGroupMembershipState })
  state!: GuardianGroupMembershipState;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  evaluation?: Record<string, unknown> | null;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamp with time zone', nullable: true })
  evaluatedAt?: Date | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  actorId?: string | null;
}

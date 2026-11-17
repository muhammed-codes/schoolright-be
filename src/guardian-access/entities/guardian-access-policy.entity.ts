import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { GraphQLJSONObject } from '../../common/scalars/json-object.scalar';
import { User } from '../../users/entities/user.entity';
import { GuardianPolicyScope } from '../enums/guardian-policy.enums';
import { GuardianConditionGroup } from '../interfaces/guardian-condition.interface';
import { GuardianAccessPolicyRule } from './guardian-access-policy-rule.entity';

@Entity('guardian_access_policies')
@ObjectType()
@Index('IDX_guardian_access_policies_school_scope', ['schoolId', 'scope'])
@Index('IDX_guardian_access_policies_school_student', ['schoolId', 'studentId'])
export class GuardianAccessPolicy extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Field()
  @Column()
  name!: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Field(() => GuardianPolicyScope)
  @Column({ type: 'enum', enum: GuardianPolicyScope })
  scope!: GuardianPolicyScope;

  @Field()
  @Column({ default: false })
  enabled!: boolean;

  @Field()
  @Column({ type: 'int', default: 0 })
  priority!: number;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  condition?: GuardianConditionGroup | null;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  studentId?: string | null;

  @Field()
  @Column({ type: 'uuid' })
  createdById!: string;

  @Field()
  @Column({ type: 'uuid' })
  updatedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updatedById' })
  updatedBy!: User;

  @Field(() => [GuardianAccessPolicyRule])
  @OneToMany(() => GuardianAccessPolicyRule, (rule) => rule.policy, {
    cascade: false,
  })
  rules!: GuardianAccessPolicyRule[];
}

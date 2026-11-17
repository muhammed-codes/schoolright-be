import { Field, ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { GuardianAction } from '../enums/guardian-permission.enums';
import { GuardianEffect } from '../enums/guardian-policy.enums';
import { GuardianResource } from '../enums/guardian-permission.enums';
import { GuardianAccessPolicy } from './guardian-access-policy.entity';

@Entity('guardian_access_policy_rules')
@ObjectType()
@Unique('UQ_guardian_policy_rules_policy_resource_action', [
  'policyId',
  'resource',
  'action',
])
@Index('IDX_guardian_policy_rules_policy', ['policyId'])
export class GuardianAccessPolicyRule extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  policyId!: string;

  @Field(() => GuardianResource)
  @Column({ type: 'enum', enum: GuardianResource })
  resource!: GuardianResource;

  @Field(() => GuardianAction)
  @Column({ type: 'enum', enum: GuardianAction })
  action!: GuardianAction;

  @Field(() => GuardianEffect)
  @Column({ type: 'enum', enum: GuardianEffect })
  effect!: GuardianEffect;

  @ManyToOne(() => GuardianAccessPolicy, (policy) => policy.rules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'policyId' })
  policy!: GuardianAccessPolicy;
}

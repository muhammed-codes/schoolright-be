import { Field, InputType } from '@nestjs/graphql';
import { GraphQLJSONObject } from '../../common/scalars/json-object.scalar';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import {
  GuardianEffect,
  GuardianPolicyScope,
} from '../enums/guardian-policy.enums';

@InputType()
export class GuardianPolicyRuleInput {
  @Field(() => GuardianResource)
  resource!: GuardianResource;

  @Field(() => GuardianAction)
  action!: GuardianAction;

  @Field(() => GuardianEffect)
  effect!: GuardianEffect;
}

@InputType()
export class CreateGuardianPolicyInput {
  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => GuardianPolicyScope)
  scope!: GuardianPolicyScope;

  @Field({ nullable: true })
  enabled?: boolean;

  @Field({ nullable: true })
  priority?: number;

  @Field(() => GraphQLJSONObject, { nullable: true })
  condition?: Record<string, unknown>;

  @Field({ nullable: true })
  studentId?: string;

  @Field(() => [GuardianPolicyRuleInput])
  rules!: GuardianPolicyRuleInput[];
}

@InputType()
export class UpdateGuardianPolicyInput {
  @Field()
  id!: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => GuardianPolicyScope, { nullable: true })
  scope?: GuardianPolicyScope;

  @Field({ nullable: true })
  enabled?: boolean;

  @Field({ nullable: true })
  priority?: number;

  @Field(() => GraphQLJSONObject, { nullable: true })
  condition?: Record<string, unknown>;

  @Field({ nullable: true })
  clearCondition?: boolean;

  @Field({ nullable: true })
  studentId?: string;

  @Field(() => [GuardianPolicyRuleInput], { nullable: true })
  rules?: GuardianPolicyRuleInput[];
}

@InputType()
export class UpdateGuardianPolicyRuleInput {
  @Field()
  id!: string;

  @Field(() => GuardianEffect, { nullable: true })
  effect?: GuardianEffect;
}

import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from '../../common/scalars/json-object.scalar';
import {
  GuardianConditionField,
  GuardianConditionOperator,
} from '../enums/guardian-condition.enums';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import {
  GuardianDecisionSource,
  GuardianEffect,
  GuardianPolicyScope,
} from '../enums/guardian-policy.enums';

@InputType()
export class GuardianPreviewInput {
  @Field()
  studentId!: string;

  @Field()
  guardianId!: string;

  @Field(() => GuardianResource)
  resource!: GuardianResource;

  @Field(() => GuardianAction)
  action!: GuardianAction;
}

@ObjectType()
export class GuardianConditionDetailType {
  @Field(() => GuardianConditionField, { nullable: true })
  field?: GuardianConditionField | null;

  @Field(() => GuardianConditionOperator, { nullable: true })
  operator?: GuardianConditionOperator | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  value?: Record<string, unknown> | string | number | null;

  @Field()
  matched!: boolean;

  @Field({ nullable: true })
  reason?: string;
}

@ObjectType()
export class GuardianConditionEvaluationType {
  @Field()
  matched!: boolean;

  @Field(() => [String])
  unavailableReasons!: string[];

  @Field(() => [GuardianConditionDetailType])
  details!: GuardianConditionDetailType[];
}

@ObjectType()
export class GuardianPolicyTraceType {
  @Field()
  policyId!: string;

  @Field()
  policyName!: string;

  @Field(() => GuardianPolicyScope)
  scope!: GuardianPolicyScope;

  @Field()
  priority!: number;

  @Field()
  matched!: boolean;

  @Field(() => GuardianEffect, { nullable: true })
  ruleEffect?: GuardianEffect;

  @Field(() => GuardianConditionEvaluationType, { nullable: true })
  conditionEvaluation?: GuardianConditionEvaluationType;

  @Field()
  reason!: string;
}

@ObjectType()
export class GuardianDecisionType {
  @Field()
  allowed!: boolean;

  @Field()
  reason!: string;

  @Field(() => GuardianDecisionSource)
  sourceType!: GuardianDecisionSource;

  @Field({ nullable: true })
  policyId?: string | null;

  @Field({ nullable: true })
  ruleId?: string | null;

  @Field()
  evaluatedAt!: Date;
}

@ObjectType()
export class GuardianPreviewType {
  @Field(() => GuardianDecisionType)
  decision!: GuardianDecisionType;

  @Field(() => [GuardianPolicyTraceType])
  trace!: GuardianPolicyTraceType[];

  @Field(() => GraphQLJSONObject)
  metrics!: Record<string, unknown>;
}

@ObjectType()
export class GuardianPermissionDecisionType extends GuardianDecisionType {
  @Field(() => GuardianResource)
  resource!: GuardianResource;

  @Field(() => GuardianAction)
  action!: GuardianAction;
}

@ObjectType()
export class GuardianAccessSnapshotType {
  @Field()
  studentId!: string;

  @Field()
  schoolId!: string;

  @Field()
  studentName!: string;

  @Field(() => [GuardianPermissionDecisionType])
  permissions!: GuardianPermissionDecisionType[];

  @Field()
  generatedAt!: Date;
}

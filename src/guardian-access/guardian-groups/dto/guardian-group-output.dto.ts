import { Field, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from '../../../common/scalars/json-object.scalar';
import {
  GuardianConditionField,
  GuardianConditionOperator,
} from '../../enums/guardian-condition.enums';
import {
  GuardianGroupMembershipSource,
  GuardianGroupMembershipState,
} from '../enums/guardian-group.enums';

@ObjectType()
export class GuardianGroupConditionDetailType {
  @Field(() => GuardianConditionField, { nullable: true })
  field?: GuardianConditionField | null;

  @Field(() => GuardianConditionOperator, { nullable: true })
  operator?: GuardianConditionOperator | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  value?: string | number | Array<string | number> | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  fee?: Record<string, unknown>;

  @Field()
  matched!: boolean;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@ObjectType()
export class GuardianGroupConditionEvaluationType {
  @Field()
  matched!: boolean;

  @Field(() => [String])
  unavailableReasons!: string[];

  @Field(() => [GuardianGroupConditionDetailType])
  details!: GuardianGroupConditionDetailType[];
}

@ObjectType()
export class GuardianGroupStudentPreviewType {
  @Field()
  studentId!: string;

  @Field()
  studentName!: string;

  @Field(() => String, { nullable: true })
  classId?: string | null;

  @Field(() => String, { nullable: true })
  className?: string | null;

  @Field()
  studentStatus!: string;

  @Field(() => GuardianGroupMembershipState)
  state!: GuardianGroupMembershipState;

  @Field(() => String, { nullable: true })
  reason?: string | null;

  @Field(() => GuardianGroupConditionEvaluationType, { nullable: true })
  conditionEvaluation?: GuardianGroupConditionEvaluationType;

  @Field(() => GraphQLJSONObject, { nullable: true })
  metrics?: Record<string, unknown>;

  @Field(() => Date, { nullable: true })
  evaluatedAt?: Date | null;
}

@ObjectType()
export class GuardianGroupGuardianPreviewType {
  @Field()
  guardianId!: string;

  @Field()
  guardianName!: string;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => [String])
  qualifyingStudentIds!: string[];

  @Field(() => GuardianGroupMembershipState)
  state!: GuardianGroupMembershipState;

  @Field(() => String, { nullable: true })
  reason?: string | null;

  @Field(() => Date, { nullable: true })
  evaluatedAt?: Date | null;
}

@ObjectType()
export class GuardianGroupPreviewType {
  @Field(() => GuardianGroupMembershipSource)
  source!: GuardianGroupMembershipSource;

  @Field(() => Int)
  studentCount!: number;

  @Field(() => Int)
  matchedStudentCount!: number;

  @Field(() => Int)
  unevaluableStudentCount!: number;

  @Field(() => Int)
  uniqueGuardianCount!: number;

  @Field(() => [GuardianGroupStudentPreviewType])
  students!: GuardianGroupStudentPreviewType[];

  @Field(() => [GuardianGroupStudentPreviewType])
  exclusions!: GuardianGroupStudentPreviewType[];

  @Field(() => [GuardianGroupGuardianPreviewType])
  guardians!: GuardianGroupGuardianPreviewType[];

  @Field(() => GraphQLJSONObject)
  breakdown!: Record<string, unknown>;

  @Field()
  generatedAt!: Date;
}

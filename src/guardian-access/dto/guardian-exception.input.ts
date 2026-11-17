import { Field, InputType } from '@nestjs/graphql';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import { GuardianEffect } from '../enums/guardian-policy.enums';

@InputType()
export class CreateGuardianExceptionInput {
  @Field()
  studentId!: string;

  @Field({ nullable: true })
  guardianId?: string;

  @Field(() => GuardianResource)
  resource!: GuardianResource;

  @Field(() => GuardianAction)
  action!: GuardianAction;

  @Field(() => GuardianEffect)
  effect!: GuardianEffect;

  @Field()
  reason!: string;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date;
}

@InputType()
export class UpdateGuardianExceptionInput {
  @Field()
  id!: string;

  @Field(() => GuardianEffect, { nullable: true })
  effect?: GuardianEffect;

  @Field({ nullable: true })
  reason?: string;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date;
}

import { Field, InputType } from '@nestjs/graphql';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { GraphQLJSONObject } from '../../../common/scalars/json-object.scalar';
import { GuardianGroupType } from '../enums/guardian-group.enums';

@InputType()
export class GuardianGroupDraftInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => GuardianGroupType)
  type!: GuardianGroupType;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  condition?: Record<string, unknown>;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@InputType()
export class CreateGuardianGroupInput extends GuardianGroupDraftInput {}

@InputType()
export class UpdateGuardianGroupInput {
  @Field()
  @IsUUID()
  id!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => GuardianGroupType, { nullable: true })
  @IsOptional()
  type?: GuardianGroupType;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  condition?: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  clearCondition?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@InputType()
export class GuardianGroupMembersInput {
  @Field()
  @IsUUID()
  groupId!: string;

  @Field(() => [String])
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds!: string[];
}

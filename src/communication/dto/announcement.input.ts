import { InputType, Field } from '@nestjs/graphql';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { GraphQLJSONObject } from '../../common/scalars/json-object.scalar';
import { AnnouncementAudience } from '../entities/announcement.entity';

@InputType()
export class CreateAnnouncementInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @Field(() => AnnouncementAudience)
  @IsEnum(AnnouncementAudience)
  audience!: AnnouncementAudience;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  targetClassId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetGroupIds?: string[];

  @Field(() => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  @IsObject()
  audienceCondition?: Record<string, unknown>;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  manualStudentIds?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  manualGuardianIds?: string[];
}

@InputType()
export class UpdateAnnouncementInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  body?: string;

  @Field(() => AnnouncementAudience, { nullable: true })
  @IsOptional()
  @IsEnum(AnnouncementAudience)
  audience?: AnnouncementAudience;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  targetClassId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetGroupIds?: string[];

  @Field(() => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  @IsObject()
  audienceCondition?: Record<string, unknown>;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  manualStudentIds?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  manualGuardianIds?: string[];
}

@InputType()
export class AnnouncementAudiencePreviewInput {
  @Field(() => AnnouncementAudience)
  @IsEnum(AnnouncementAudience)
  audience!: AnnouncementAudience;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  targetClassId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetGroupIds?: string[];

  @Field(() => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  @IsObject()
  audienceCondition?: Record<string, unknown>;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  manualStudentIds?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  manualGuardianIds?: string[];
}

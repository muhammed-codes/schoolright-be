import { ObjectType, Field, InputType, Int, Float } from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import {
  IdCardType,
  IdCardOrientation,
  IdCardSide,
} from '../enums/id-card.enums';
import { IdCardTemplate } from '../entities/id-card-template.entity';

@ObjectType()
export class IdCardRenderResult {
  @Field()
  html!: string;

  @Field(() => String, { nullable: true })
  frontHtml?: string | null;

  @Field(() => String, { nullable: true })
  backHtml?: string | null;

  @Field(() => Int)
  totalCards!: number;

  @Field(() => Int, { nullable: true })
  page?: number;

  @Field(() => Int, { nullable: true })
  pageSize?: number;

  @Field(() => Int, { nullable: true })
  totalPages?: number;

  @Field()
  templateKey!: string;

  @Field()
  templateName!: string;
}

@ObjectType()
export class IdCardPdfResult {
  @Field()
  pdfUrl!: string;

  @Field(() => String, { nullable: true })
  pdfPrivateUrl?: string;

  @Field(() => Int, { nullable: true })
  expiresAt?: number;

  @Field(() => Int)
  totalCards!: number;
}

@InputType()
export class UpdateSchoolIdCardSettingsInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  defaultStudentTemplateId?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  defaultStaffTemplateId?: string | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  showQrCode?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  showSchoolAddress?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  showPrincipalSignature?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  customNote?: string | null;
}

@InputType()
export class RenderStudentIdCardInput {
  @Field()
  @IsUUID()
  studentId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @Field(() => IdCardSide, { nullable: true })
  @IsOptional()
  @IsEnum(IdCardSide)
  side?: IdCardSide;
}

@InputType()
export class RenderStaffIdCardInput {
  @Field()
  @IsUUID()
  staffId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @Field(() => IdCardSide, { nullable: true })
  @IsOptional()
  @IsEnum(IdCardSide)
  side?: IdCardSide;
}

@InputType()
export class RenderBatchStudentIdCardsInput {
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  studentIds?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @Field(() => IdCardSide, { nullable: true })
  @IsOptional()
  @IsEnum(IdCardSide)
  side?: IdCardSide;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Min(1)
  @IsInt()
  page?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Min(1)
  @Max(100)
  @IsInt()
  limit?: number;
}

@InputType()
export class RenderBatchStaffIdCardsInput {
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  staffIds?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @Field(() => IdCardSide, { nullable: true })
  @IsOptional()
  @IsEnum(IdCardSide)
  side?: IdCardSide;
}

@InputType()
export class GenerateStudentIdCardPdfInput {
  @Field()
  @IsUUID()
  studentId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @Field(() => IdCardSide, { nullable: true })
  @IsOptional()
  @IsEnum(IdCardSide)
  side?: IdCardSide;
}

@InputType()
export class GenerateStaffIdCardPdfInput {
  @Field()
  @IsUUID()
  staffId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @Field(() => IdCardSide, { nullable: true })
  @IsOptional()
  @IsEnum(IdCardSide)
  side?: IdCardSide;
}

@InputType()
export class GenerateBatchStudentIdCardsPdfInput {
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  studentIds?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @Field(() => IdCardSide, { nullable: true })
  @IsOptional()
  @IsEnum(IdCardSide)
  side?: IdCardSide;
}

@InputType()
export class GenerateBatchStaffIdCardsPdfInput {
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  staffIds?: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @Field(() => IdCardSide, { nullable: true })
  @IsOptional()
  @IsEnum(IdCardSide)
  side?: IdCardSide;
}

@InputType()
export class CreateIdCardTemplateInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => IdCardType, { defaultValue: IdCardType.STUDENT })
  @IsOptional()
  @IsEnum(IdCardType)
  cardType?: IdCardType;

  @Field(() => IdCardOrientation, { defaultValue: IdCardOrientation.PORTRAIT })
  @IsOptional()
  @IsEnum(IdCardOrientation)
  orientation?: IdCardOrientation;

  @Field(() => Float, { defaultValue: 53.98 })
  @IsOptional()
  widthMm?: number;

  @Field(() => Float, { defaultValue: 85.6 })
  @IsOptional()
  heightMm?: number;

  @Field(() => Boolean, { defaultValue: true })
  @IsOptional()
  @IsBoolean()
  hasBackSide?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  previewThumbnailUrl?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  designConfiguration?: string;

  @Field(() => Boolean, { defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

@InputType()
export class UpdateIdCardTemplateInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => IdCardOrientation, { nullable: true })
  @IsOptional()
  @IsEnum(IdCardOrientation)
  orientation?: IdCardOrientation;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  widthMm?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  heightMm?: number;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  hasBackSide?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  previewThumbnailUrl?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  designConfiguration?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

@InputType()
export class PreviewIdCardInput {
  @Field(() => IdCardType, { defaultValue: IdCardType.STUDENT })
  @IsEnum(IdCardType)
  cardType!: IdCardType;

  @Field(() => IdCardOrientation, { defaultValue: IdCardOrientation.PORTRAIT })
  @IsEnum(IdCardOrientation)
  orientation!: IdCardOrientation;

  @Field()
  @IsString()
  designConfiguration!: string;

  @Field(() => Boolean, { defaultValue: true })
  @IsBoolean()
  hasBackSide!: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  studentId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  staffId?: string;
}

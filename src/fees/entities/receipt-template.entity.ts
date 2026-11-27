import { ObjectType, Field } from '@nestjs/graphql';
import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { GraphQLJSONObject } from '../../common/scalars/json-object.scalar';
import { ReceiptTemplateConfig } from '../interfaces/receipt-template-config.interface';

@ObjectType()
@Entity('receipt_templates')
@Index(['schoolId'])
export class ReceiptTemplate extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Field()
  @Column()
  name!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  thumbnailUrl!: string | null;

  /** Maps to a template file key — same pattern as report-card-template */
  @Field()
  @Column({ default: 'custom' })
  templateKey!: string;

  @Field()
  @Column({ default: true })
  isActive!: boolean;

  @Field()
  @Column({ default: false })
  isDefault!: boolean;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  config?: ReceiptTemplateConfig | null;
}


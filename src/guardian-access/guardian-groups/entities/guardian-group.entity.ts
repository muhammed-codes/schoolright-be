import { Field, ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { GraphQLJSONObject } from '../../../common/scalars/json-object.scalar';
import { GuardianGroupType } from '../enums/guardian-group.enums';

@ObjectType()
@Entity('guardian_groups')
@Index('UQ_guardian_groups_school_name', ['schoolId', 'name'])
@Index('IDX_guardian_groups_school_active_type', [
  'schoolId',
  'isActive',
  'type',
])
export class GuardianGroup extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Field()
  @Column()
  name!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Field(() => GuardianGroupType)
  @Column({ type: 'enum', enum: GuardianGroupType })
  type!: GuardianGroupType;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  condition?: Record<string, unknown> | null;

  @Field()
  @Column({ default: true })
  isActive!: boolean;

  @Field()
  @Column({ default: false })
  isDeleted!: boolean;

  @Field()
  @Column({ type: 'uuid' })
  createdById!: string;

  @Field()
  @Column({ type: 'uuid' })
  updatedById!: string;
}

import { Field, ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import { GuardianEffect } from '../enums/guardian-policy.enums';

@Entity('guardian_access_exceptions')
@ObjectType()
@Index('IDX_guardian_exceptions_school_student', ['schoolId', 'studentId'])
@Index('IDX_guardian_exceptions_guardian', ['schoolId', 'guardianId'])
export class GuardianAccessException extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Field()
  @Column({ type: 'uuid' })
  studentId!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  guardianId?: string | null;

  @Field(() => GuardianResource)
  @Column({ type: 'enum', enum: GuardianResource })
  resource!: GuardianResource;

  @Field(() => GuardianAction)
  @Column({ type: 'enum', enum: GuardianAction })
  action!: GuardianAction;

  @Field(() => GuardianEffect)
  @Column({ type: 'enum', enum: GuardianEffect })
  effect!: GuardianEffect;

  @Field()
  @Column({ type: 'text' })
  reason!: string;

  @Field(() => Date, { nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Field()
  @Column({ type: 'uuid' })
  createdById!: string;

  @Field()
  @Column({ type: 'uuid' })
  updatedById!: string;
}

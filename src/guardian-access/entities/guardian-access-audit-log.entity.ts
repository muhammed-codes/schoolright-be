import { Field, ObjectType } from '@nestjs/graphql';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { GraphQLJSONObject } from '../../common/scalars/json-object.scalar';
import { GuardianAuditAction } from '../enums/guardian-policy.enums';

@Entity('guardian_access_audit_logs')
@ObjectType()
@Index('IDX_guardian_audit_school_created', ['schoolId', 'createdAt'])
@Index('IDX_guardian_audit_school_entity', [
  'schoolId',
  'entityType',
  'entityId',
])
export class GuardianAccessAuditLog extends BaseEntity {
  @Field()
  @Column({ type: 'uuid' })
  schoolId!: string;

  @Field()
  @Column({ type: 'uuid' })
  actorId!: string;

  @Field(() => GuardianAuditAction)
  @Column({ type: 'enum', enum: GuardianAuditAction })
  action!: GuardianAuditAction;

  @Field()
  @Column()
  entityType!: string;

  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  entityId?: string | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  beforeState?: Record<string, unknown> | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  afterState?: Record<string, unknown> | null;
}

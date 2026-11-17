import { registerEnumType } from '@nestjs/graphql';

export enum GuardianPolicyScope {
  SCHOOL_DEFAULT = 'SCHOOL_DEFAULT',
  DYNAMIC_SEGMENT = 'DYNAMIC_SEGMENT',
  STUDENT_OVERRIDE = 'STUDENT_OVERRIDE',
}

export enum GuardianEffect {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

export enum GuardianAuditAction {
  POLICY_CREATED = 'POLICY_CREATED',
  POLICY_UPDATED = 'POLICY_UPDATED',
  POLICY_DELETED = 'POLICY_DELETED',
  POLICY_ENABLED = 'POLICY_ENABLED',
  POLICY_DISABLED = 'POLICY_DISABLED',
  RULE_CREATED = 'RULE_CREATED',
  RULE_UPDATED = 'RULE_UPDATED',
  RULE_DELETED = 'RULE_DELETED',
  EXCEPTION_CREATED = 'EXCEPTION_CREATED',
  EXCEPTION_UPDATED = 'EXCEPTION_UPDATED',
  EXCEPTION_REMOVED = 'EXCEPTION_REMOVED',
}

registerEnumType(GuardianPolicyScope, { name: 'GuardianPolicyScope' });
registerEnumType(GuardianEffect, { name: 'GuardianEffect' });
registerEnumType(GuardianAuditAction, { name: 'GuardianAuditAction' });

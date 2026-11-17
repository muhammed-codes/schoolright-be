import { UserRole } from '../../common/enums';
import {
  GuardianDecisionSource,
  GuardianEffect,
  GuardianPolicyScope,
} from '../enums/guardian-policy.enums';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import {
  GuardianConditionEvaluation,
  GuardianStudentMetrics,
} from './guardian-condition.interface';

export interface GuardianEvaluatorUser {
  sub: string;
  role: UserRole;
  schoolId?: string | null;
}

export interface GuardianDecision {
  allowed: boolean;
  reason: string;
  sourceType: GuardianDecisionSource;
  policyId?: string | null;
  ruleId?: string | null;
  evaluatedAt: Date;
}

export interface GuardianPolicyCandidate {
  id: string;
  schoolId: string;
  name: string;
  scope: GuardianPolicyScope;
  enabled: boolean;
  priority: number;
  condition?: unknown;
  studentId?: string | null;
  rules: Array<{
    id: string;
    resource: GuardianResource;
    action: GuardianAction;
    effect: GuardianEffect;
  }>;
}

export interface GuardianAccessExceptionCandidate {
  id: string;
  schoolId: string;
  studentId: string;
  guardianId?: string | null;
  resource: GuardianResource;
  action: GuardianAction;
  effect: GuardianEffect;
  reason: string;
  expiresAt?: Date | null;
}

export interface GuardianPolicyTraceItem {
  policyId: string;
  policyName: string;
  scope: GuardianPolicyScope;
  priority: number;
  matched: boolean;
  ruleEffect?: GuardianEffect;
  conditionEvaluation?: GuardianConditionEvaluation;
  reason: string;
}

export interface GuardianPolicyDecision extends GuardianDecision {
  trace: GuardianPolicyTraceItem[];
}

export interface GuardianEvaluateInput {
  user: GuardianEvaluatorUser;
  studentId: string;
  studentSchoolId: string;
  guardianLinked: boolean;
  resource: GuardianResource;
  action: GuardianAction;
  policies: GuardianPolicyCandidate[];
  exceptions: GuardianAccessExceptionCandidate[];
  metrics: GuardianStudentMetrics;
  now?: Date;
}

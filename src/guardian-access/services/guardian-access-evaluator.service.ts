import { Injectable } from '@nestjs/common';
import { UserRole } from '../../common/enums';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import {
  GuardianDecisionSource,
  GuardianEffect,
  GuardianPolicyScope,
} from '../enums/guardian-policy.enums';
import {
  GuardianAccessExceptionCandidate,
  GuardianEvaluateInput,
  GuardianPolicyCandidate,
  GuardianPolicyDecision,
  GuardianPolicyTraceItem,
} from '../interfaces/guardian-decision.interface';
import { GuardianConditionEvaluation } from '../interfaces/guardian-condition.interface';
import { GuardianConditionEvaluator } from './guardian-condition-evaluator.service';
import { GuardianConditionValidator } from './guardian-condition-validator.service';

@Injectable()
export class GuardianAccessEvaluator {
  constructor(
    private readonly conditionEvaluator: GuardianConditionEvaluator,
    private readonly conditionValidator: GuardianConditionValidator,
  ) {}

  evaluate = (input: GuardianEvaluateInput): GuardianPolicyDecision => {
    const now = input.now ?? new Date();
    const trace: GuardianPolicyTraceItem[] = [];
    const invariantDenial = this.checkInvariants(input, now);
    if (invariantDenial) return { ...invariantDenial, trace };

    const exception = this.resolveException(input, now);
    if (exception) {
      return {
        allowed: exception.effect === GuardianEffect.ALLOW,
        reason: exception.reason,
        sourceType: GuardianDecisionSource.EXCEPTION,
        policyId: exception.id,
        evaluatedAt: now,
        trace,
      };
    }

    const scopedPolicies = input.policies.filter(
      (policy) =>
        policy.schoolId === input.studentSchoolId &&
        policy.schoolId === input.user.schoolId &&
        policy.enabled,
    );

    const evaluationByPolicy = new Map<string, GuardianConditionEvaluation>();
    for (const policy of scopedPolicies) {
      if (!policy.condition) {
        evaluationByPolicy.set(policy.id, {
          matched: true,
          unavailableReasons: [],
          details: [],
        });
        continue;
      }
      try {
        const condition = this.conditionValidator.validate(policy.condition);
        evaluationByPolicy.set(
          policy.id,
          this.conditionEvaluator.evaluate(condition, input.metrics),
        );
      } catch {
        evaluationByPolicy.set(policy.id, {
          matched: false,
          unavailableReasons: [],
          details: [],
        });
      }
    }

    const studentOverride = this.resolvePolicyRule(
      scopedPolicies.filter(
        (policy) =>
          policy.scope === GuardianPolicyScope.STUDENT_OVERRIDE &&
          policy.studentId === input.studentId,
      ),
      input.resource,
      input.action,
      evaluationByPolicy,
      trace,
    );
    if (studentOverride) {
      return {
        allowed: studentOverride.rule.effect === GuardianEffect.ALLOW,
        reason: `Allowed by student override ${studentOverride.policy.name}`,
        sourceType: GuardianDecisionSource.STUDENT_OVERRIDE,
        policyId: studentOverride.policy.id,
        ruleId: studentOverride.rule.id,
        evaluatedAt: now,
        trace,
      };
    }

    const dynamicSegment = this.resolvePolicyRule(
      scopedPolicies.filter(
        (policy) => policy.scope === GuardianPolicyScope.DYNAMIC_SEGMENT,
      ),
      input.resource,
      input.action,
      evaluationByPolicy,
      trace,
      true,
    );
    if (dynamicSegment) {
      return {
        allowed: dynamicSegment.rule.effect === GuardianEffect.ALLOW,
        reason: `Allowed by dynamic segment ${dynamicSegment.policy.name}`,
        sourceType: GuardianDecisionSource.DYNAMIC_SEGMENT,
        policyId: dynamicSegment.policy.id,
        ruleId: dynamicSegment.rule.id,
        evaluatedAt: now,
        trace,
      };
    }

    const schoolDefault = this.resolvePolicyRule(
      scopedPolicies.filter(
        (policy) => policy.scope === GuardianPolicyScope.SCHOOL_DEFAULT,
      ),
      input.resource,
      input.action,
      evaluationByPolicy,
      trace,
    );
    if (schoolDefault) {
      return {
        allowed: schoolDefault.rule.effect === GuardianEffect.ALLOW,
        reason: `Allowed by school default ${schoolDefault.policy.name}`,
        sourceType: GuardianDecisionSource.SCHOOL_DEFAULT,
        policyId: schoolDefault.policy.id,
        ruleId: schoolDefault.rule.id,
        evaluatedAt: now,
        trace,
      };
    }

    return {
      allowed: false,
      reason: 'No matching guardian policy; access denied by default',
      sourceType: GuardianDecisionSource.DEFAULT_DENY,
      evaluatedAt: now,
      trace,
    };
  };

  private checkInvariants = (
    input: GuardianEvaluateInput,
    now: Date,
  ): GuardianPolicyDecision | null => {
    if (input.user.role !== UserRole.PARENT) {
      return {
        allowed: false,
        reason: 'Guardian access is restricted to parent accounts',
        sourceType: GuardianDecisionSource.SECURITY_INVARIANT,
        evaluatedAt: now,
        trace: [],
      };
    }
    if (!input.user.schoolId || input.user.schoolId !== input.studentSchoolId) {
      return {
        allowed: false,
        reason: 'The student is outside the guardian school scope',
        sourceType: GuardianDecisionSource.SECURITY_INVARIANT,
        evaluatedAt: now,
        trace: [],
      };
    }
    if (!input.guardianLinked) {
      return {
        allowed: false,
        reason: 'The guardian is not linked to this student',
        sourceType: GuardianDecisionSource.SECURITY_INVARIANT,
        evaluatedAt: now,
        trace: [],
      };
    }
    return null;
  };

  private resolveException = (
    input: GuardianEvaluateInput,
    now: Date,
  ): GuardianAccessExceptionCandidate | null => {
    const candidates = input.exceptions.filter(
      (exception) =>
        exception.schoolId === input.studentSchoolId &&
        exception.studentId === input.studentId &&
        exception.resource === input.resource &&
        exception.action === input.action &&
        (!exception.expiresAt || exception.expiresAt.getTime() > now.getTime()),
    );
    return (
      candidates.find((exception) => exception.guardianId === input.user.sub) ??
      candidates.find((exception) => !exception.guardianId) ??
      null
    );
  };

  private resolvePolicyRule = (
    policies: GuardianPolicyCandidate[],
    resource: GuardianResource,
    action: GuardianAction,
    evaluationByPolicy: Map<string, GuardianConditionEvaluation>,
    trace: GuardianPolicyTraceItem[],
    applyPriority = false,
  ): {
    policy: GuardianPolicyCandidate;
    rule: { id: string; effect: GuardianEffect };
  } | null => {
    const candidates: Array<{
      policy: GuardianPolicyCandidate;
      rule: { id: string; effect: GuardianEffect };
    }> = [];
    for (const policy of policies) {
      const evaluation = evaluationByPolicy.get(policy.id);
      const rule = policy.rules.find(
        (item) => item.resource === resource && item.action === action,
      );
      const reason = evaluation?.unavailableReasons.length
        ? evaluation.unavailableReasons.join('; ')
        : evaluation?.matched
          ? 'Condition matched'
          : policy.condition
            ? 'Condition did not match'
            : 'No condition';
      trace.push({
        policyId: policy.id,
        policyName: policy.name,
        scope: policy.scope,
        priority: policy.priority,
        matched: Boolean(
          evaluation?.matched && !evaluation.unavailableReasons.length,
        ),
        ...(rule ? { ruleEffect: rule.effect } : {}),
        ...(policy.condition ? { conditionEvaluation: evaluation } : {}),
        reason,
      });
      if (
        rule &&
        evaluation?.matched &&
        evaluation.unavailableReasons.length === 0
      ) {
        candidates.push({ policy, rule });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((left, right) => {
      if (applyPriority && right.policy.priority !== left.policy.priority) {
        return right.policy.priority - left.policy.priority;
      }
      if (left.rule.effect !== right.rule.effect) {
        return left.rule.effect === GuardianEffect.DENY ? -1 : 1;
      }
      return left.policy.id.localeCompare(right.policy.id);
    });
    return candidates[0];
  };
}

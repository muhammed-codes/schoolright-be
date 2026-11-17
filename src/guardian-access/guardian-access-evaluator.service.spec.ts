import { StudentStatus, UserRole } from '../common/enums';
import {
  GuardianConditionCombinator,
  GuardianConditionField,
  GuardianConditionNodeType,
  GuardianConditionOperator,
} from './enums/guardian-condition.enums';
import {
  GuardianAction,
  GuardianResource,
} from './enums/guardian-permission.enums';
import {
  GuardianDecisionSource,
  GuardianEffect,
  GuardianPolicyScope,
} from './enums/guardian-policy.enums';
import {
  GuardianAccessExceptionCandidate,
  GuardianEvaluateInput,
  GuardianPolicyCandidate,
} from './interfaces/guardian-decision.interface';
import { GuardianAccessEvaluator } from './services/guardian-access-evaluator.service';
import { GuardianConditionEvaluator } from './services/guardian-condition-evaluator.service';
import { GuardianConditionValidator } from './services/guardian-condition-validator.service';

describe('guardian access evaluator', () => {
  const evaluator = new GuardianAccessEvaluator(
    new GuardianConditionEvaluator(),
    new GuardianConditionValidator(),
  );
  const now = new Date('2026-01-01T00:00:00.000Z');
  const baseInput: GuardianEvaluateInput = {
    user: { sub: 'parent-a', role: UserRole.PARENT, schoolId: 'school-a' },
    studentId: 'student-a',
    studentSchoolId: 'school-a',
    guardianLinked: true,
    resource: GuardianResource.FEES,
    action: GuardianAction.VIEW,
    policies: [],
    exceptions: [],
    metrics: {
      studentClassId: 'class-a',
      studentStatus: StudentStatus.ACTIVE,
      feePaymentPercentage: 50,
      outstandingBalance: 1000,
      unavailable: {},
    },
    now,
  };
  const rule = (
    id: string,
    effect: GuardianEffect,
  ): GuardianPolicyCandidate['rules'][number] => ({
    id,
    resource: GuardianResource.FEES,
    action: GuardianAction.VIEW,
    effect,
  });
  const policy = (
    overrides: Partial<GuardianPolicyCandidate>,
  ): GuardianPolicyCandidate => ({
    id: 'policy-a',
    schoolId: 'school-a',
    name: 'Policy A',
    scope: GuardianPolicyScope.SCHOOL_DEFAULT,
    enabled: true,
    priority: 0,
    rules: [rule('rule-a', GuardianEffect.ALLOW)],
    ...overrides,
  });
  const exception = (
    overrides: Partial<GuardianAccessExceptionCandidate>,
  ): GuardianAccessExceptionCandidate => ({
    id: 'exception-a',
    schoolId: 'school-a',
    studentId: 'student-a',
    guardianId: 'parent-a',
    resource: GuardianResource.FEES,
    action: GuardianAction.VIEW,
    effect: GuardianEffect.DENY,
    reason: 'Manual hold',
    ...overrides,
  });
  const activeCondition = {
    type: GuardianConditionNodeType.GROUP,
    combinator: GuardianConditionCombinator.AND,
    conditions: [
      {
        type: GuardianConditionNodeType.CONDITION,
        field: GuardianConditionField.STUDENT_STATUS,
        operator: GuardianConditionOperator.EQUALS,
        value: StudentStatus.ACTIVE,
      },
    ],
  };

  it('denies when the guardian role or school invariant fails', () => {
    const decision = evaluator.evaluate({
      ...baseInput,
      user: { ...baseInput.user, role: UserRole.BURSAR },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.sourceType).toBe(GuardianDecisionSource.SECURITY_INVARIANT);

    const foreignDecision = evaluator.evaluate({
      ...baseInput,
      studentSchoolId: 'school-b',
    });
    expect(foreignDecision.sourceType).toBe(
      GuardianDecisionSource.SECURITY_INVARIANT,
    );

    const unlinkedDecision = evaluator.evaluate({
      ...baseInput,
      guardianLinked: false,
    });
    expect(unlinkedDecision.sourceType).toBe(
      GuardianDecisionSource.SECURITY_INVARIANT,
    );
  });

  it('applies exact guardian exceptions before policies', () => {
    const decision = evaluator.evaluate({
      ...baseInput,
      exceptions: [exception({})],
      policies: [policy({})],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.sourceType).toBe(GuardianDecisionSource.EXCEPTION);
    expect(decision.reason).toBe('Manual hold');
  });

  it('prefers student overrides over dynamic segments and ignores expired exceptions', () => {
    const decision = evaluator.evaluate({
      ...baseInput,
      exceptions: [
        exception({
          expiresAt: new Date('2025-12-31T00:00:00.000Z'),
        }),
      ],
      policies: [
        policy({
          id: 'dynamic',
          scope: GuardianPolicyScope.DYNAMIC_SEGMENT,
          priority: 99,
          condition: activeCondition,
          rules: [rule('dynamic-rule', GuardianEffect.DENY)],
        }),
        policy({
          id: 'override',
          scope: GuardianPolicyScope.STUDENT_OVERRIDE,
          studentId: 'student-a',
          rules: [rule('override-rule', GuardianEffect.ALLOW)],
        }),
      ],
    });
    expect(decision.allowed).toBe(true);
    expect(decision.sourceType).toBe(GuardianDecisionSource.STUDENT_OVERRIDE);
  });

  it('uses dynamic priority and denies ties', () => {
    const decision = evaluator.evaluate({
      ...baseInput,
      policies: [
        policy({
          id: 'low',
          scope: GuardianPolicyScope.DYNAMIC_SEGMENT,
          priority: 1,
          condition: activeCondition,
          rules: [rule('low-rule', GuardianEffect.ALLOW)],
        }),
        policy({
          id: 'high',
          scope: GuardianPolicyScope.DYNAMIC_SEGMENT,
          priority: 10,
          condition: activeCondition,
          rules: [rule('high-rule', GuardianEffect.ALLOW)],
        }),
        policy({
          id: 'tie-deny',
          scope: GuardianPolicyScope.DYNAMIC_SEGMENT,
          priority: 10,
          condition: activeCondition,
          rules: [rule('tie-deny-rule', GuardianEffect.DENY)],
        }),
      ],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.policyId).toBe('tie-deny');
  });

  it('falls back to school default then secure deny', () => {
    const withDefault = evaluator.evaluate({
      ...baseInput,
      policies: [policy({})],
    });
    expect(withDefault.allowed).toBe(true);
    expect(withDefault.sourceType).toBe(GuardianDecisionSource.SCHOOL_DEFAULT);

    const denied = evaluator.evaluate(baseInput);
    expect(denied.allowed).toBe(false);
    expect(denied.sourceType).toBe(GuardianDecisionSource.DEFAULT_DENY);
    expect(denied.reason).toContain('denied by default');
  });
});

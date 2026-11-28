import { StudentStatus, UserRole } from '../common/enums';
import { GuardianAccessPolicy } from './entities/guardian-access-policy.entity';
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
  GuardianEffect,
  GuardianPolicyScope,
} from './enums/guardian-policy.enums';
import { GuardianFeeMetric } from './interfaces/guardian-fee-facts.interface';
import { GuardianAccessEvaluator } from './services/guardian-access-evaluator.service';
import { GuardianConditionEvaluator } from './services/guardian-condition-evaluator.service';
import { GuardianConditionValidator } from './services/guardian-condition-validator.service';
import { GuardianEnforcementService } from './services/guardian-enforcement.service';
import { GuardianFeeMetricService } from './services/guardian-fee-metric.service';

describe('guardian fee enforcement', () => {
  const metric: GuardianFeeMetric = {
    grossAmount: 1000,
    netPayableAmount: 1000,
    discountAmount: 0,
    scholarshipAmount: 0,
    waiverAmount: 0,
    adjustmentAmount: 0,
    nonCashSettledAmount: 0,
    approvedPaymentAmount: 500,
    settledAmount: 500,
    cashOutstandingBalance: 500,
    obligationOutstandingBalance: 500,
    overpaymentAmount: 0,
    feePaymentPercentage: 50,
    settledObligationPercentage: 90,
    outstandingBalance: 500,
    unavailable: {},
  };

  const student = (id: string) => ({
    id,
    schoolId: 'school-a',
    isArchived: false,
    status: StudentStatus.ACTIVE,
    currentClassId: null,
    firstName: 'Test',
    lastName: id,
  });

  const policy = (
    condition: Record<string, unknown>,
    effect: GuardianEffect = GuardianEffect.ALLOW,
  ) =>
    ({
      id: `policy-${effect}`,
      schoolId: 'school-a',
      name: 'Fee segment',
      scope: GuardianPolicyScope.DYNAMIC_SEGMENT,
      enabled: true,
      priority: 10,
      condition,
      studentId: null,
      rules: [
        {
          id: `rule-${effect}`,
          resource: GuardianResource.RESULTS,
          action: GuardianAction.VIEW,
          effect,
        },
      ],
    }) as unknown as GuardianAccessPolicy;

  const condition = (
    field: GuardianConditionField,
    fee: Record<string, unknown>,
  ) => ({
    type: GuardianConditionNodeType.GROUP,
    combinator: GuardianConditionCombinator.AND,
    conditions: [
      {
        type: GuardianConditionNodeType.CONDITION,
        field,
        operator: GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
        value: 50,
        fee,
      },
    ],
  });

  const setup = (policies: GuardianAccessPolicy[]) => {
    const calculateForStudents = jest
      .fn()
      .mockImplementation(
        (request: { studentIds: string[] }) =>
          new Map(request.studentIds.map((id) => [id, metric])),
      );
    const studentRepo = {
      findOne: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          student(where.id),
        ),
    };
    const studentParentRepo = {
      findOne: jest.fn().mockResolvedValue({ studentId: 'student-a' }),
      find: jest.fn().mockResolvedValue([
        { student: student('student-a'), parentId: 'guardian-a' },
        { student: student('student-b'), parentId: 'guardian-a' },
      ]),
    };
    const userRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'guardian-a',
        schoolId: 'school-a',
        role: UserRole.PARENT,
      }),
    };
    const policyRepo = { find: jest.fn().mockResolvedValue(policies) };
    const exceptionRepo = { find: jest.fn().mockResolvedValue([]) };
    const validator = new GuardianConditionValidator();
    const service = new GuardianEnforcementService(
      studentRepo as never,
      studentParentRepo as never,
      userRepo as never,
      policyRepo as never,
      exceptionRepo as never,
      new GuardianAccessEvaluator(new GuardianConditionEvaluator(), validator),
      { calculateForStudents } as unknown as GuardianFeeMetricService,
      validator,
    );
    return { service, calculateForStudents, studentParentRepo };
  };

  it('fetches configured fee facts before evaluating backend enforcement', async () => {
    const feeConfig = {
      selectionMode: 'INCLUDE',
      categoryIds: ['tuition'],
      amountBasis: 'SETTLED_OBLIGATION',
    };
    const { service, calculateForStudents } = setup([
      policy(
        condition(GuardianConditionField.FEE_SETTLED_PERCENTAGE, feeConfig),
      ),
    ]);
    const decision = await service.getDecision(
      'guardian-a',
      'school-a',
      'student-a',
      GuardianResource.RESULTS,
      GuardianAction.VIEW,
    );
    expect(decision.allowed).toBe(true);
    expect(calculateForStudents).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: 'school-a',
        studentIds: ['student-a'],
        feeSelectionMode: 'INCLUDE',
        feeCategoryIds: ['tuition'],
        amountBasis: 'SETTLED_OBLIGATION',
      }),
    );
  });

  it('batches fee facts across children and fee configs', async () => {
    const { service, calculateForStudents, studentParentRepo } = setup([
      policy(
        condition(GuardianConditionField.FEE_PAYMENT_PERCENTAGE, {
          selectionMode: 'INDIVIDUAL',
          categoryIds: ['tuition'],
        }),
      ),
    ]);
    const snapshots = await service.snapshot('guardian-a', 'school-a');
    expect(snapshots).toHaveLength(2);
    expect(studentParentRepo.find).toHaveBeenCalledTimes(1);
    expect(calculateForStudents).toHaveBeenCalledTimes(2);
    calculateForStudents.mock.calls.forEach((call: unknown[]) => {
      const request = call[0] as { studentIds: string[] };
      expect(request.studentIds).toEqual(['student-a', 'student-b']);
    });
  });

  it('evaluates a draft fee condition in backend preview', async () => {
    const { service, calculateForStudents } = setup([
      policy({
        type: GuardianConditionNodeType.GROUP,
        combinator: GuardianConditionCombinator.AND,
        conditions: [
          {
            type: GuardianConditionNodeType.CONDITION,
            field: GuardianConditionField.STUDENT_STATUS,
            operator: GuardianConditionOperator.EQUALS,
            value: StudentStatus.GRADUATED,
          },
        ],
      }),
    ]);
    const result = await service.preview(
      'school-a',
      'guardian-a',
      'student-a',
      GuardianResource.RESULTS,
      GuardianAction.VIEW,
      {
        condition: condition(GuardianConditionField.FEE_PAID_AMOUNT, {
          selectionMode: 'INCLUDE',
          categoryIds: ['transport'],
        }),
        rules: [
          {
            resource: GuardianResource.RESULTS,
            action: GuardianAction.VIEW,
            effect: GuardianEffect.ALLOW,
          },
        ],
      },
    );
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.policyId).toBe('DRAFT_POLICY');
    expect(calculateForStudents).toHaveBeenCalledWith(
      expect.objectContaining({
        feeSelectionMode: 'INCLUDE',
        feeCategoryIds: ['transport'],
      }),
    );
  });
});

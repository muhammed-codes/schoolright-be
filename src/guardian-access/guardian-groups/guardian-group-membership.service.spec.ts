import { BadRequestException } from '@nestjs/common';
import { StudentStatus, UserRole } from '../../common/enums';
import {
  GuardianConditionCombinator,
  GuardianConditionField,
  GuardianConditionNodeType,
  GuardianConditionOperator,
} from '../enums/guardian-condition.enums';
import { GuardianFeeEvaluationStatus } from '../interfaces/guardian-fee-facts.interface';
import { GuardianConditionEvaluator } from '../services/guardian-condition-evaluator.service';
import { GuardianConditionValidator } from '../services/guardian-condition-validator.service';
import { GuardianGroup } from './entities/guardian-group.entity';
import {
  GuardianGroupMembershipSource,
  GuardianGroupMembershipState,
  GuardianGroupType,
} from './enums/guardian-group.enums';
import { GuardianGroupMembershipService } from './services/guardian-group-membership.service';

type StudentMembershipRecord = {
  studentId: string;
  state: GuardianGroupMembershipState;
};

const metric = (percentage: number) => ({
  grossAmount: 1000,
  netPayableAmount: 1000,
  discountAmount: 0,
  scholarshipAmount: 0,
  waiverAmount: 0,
  adjustmentAmount: 0,
  nonCashSettledAmount: 0,
  approvedPaymentAmount: percentage * 10,
  settledAmount: percentage * 10,
  cashOutstandingBalance: 1000 - percentage * 10,
  obligationOutstandingBalance: 1000 - percentage * 10,
  overpaymentAmount: 0,
  feePaymentPercentage: percentage,
  outstandingBalance: 1000 - percentage * 10,
  unavailable: {},
  evaluationStatus: GuardianFeeEvaluationStatus.AVAILABLE,
});

const unavailableMetric = () => ({
  ...metric(0),
  feePaymentPercentage: undefined,
  evaluationStatus: GuardianFeeEvaluationStatus.NO_ACTIVE_TERM,
  reasons: ['No active term'],
});

const condition = {
  type: GuardianConditionNodeType.GROUP,
  combinator: GuardianConditionCombinator.AND,
  conditions: [
    {
      type: GuardianConditionNodeType.CONDITION,
      field: GuardianConditionField.STUDENT_STATUS,
      operator: GuardianConditionOperator.EQUALS,
      value: StudentStatus.ACTIVE,
    },
    {
      type: GuardianConditionNodeType.CONDITION,
      field: GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
      operator: GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
      value: 50,
    },
  ],
};

const student = (id: string, percentage: number) => ({
  id,
  firstName: id.toUpperCase(),
  lastName: 'Student',
  fullName: `${id.toUpperCase()} Student`,
  status: StudentStatus.ACTIVE,
  currentClassId: id === 'student-3' ? 'class-b' : 'class-a',
  schoolId: 'school-1',
  isArchived: false,
  ...(percentage === -1 ? { metricOverride: unavailableMetric() } : {}),
});

describe('GuardianGroupMembershipService', () => {
  let service: GuardianGroupMembershipService;
  let studentRepo: { find: jest.Mock };
  let studentParentRepo: { createQueryBuilder: jest.Mock };
  let classRepo: { find: jest.Mock };
  let groupStudentRepo: {
    find: jest.Mock;
    create: jest.Mock<unknown, [unknown]>;
    save: jest.Mock<Promise<unknown>, [StudentMembershipRecord[]]>;
  };
  let groupGuardianRepo: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let feeMetricService: { calculateForStudents: jest.Mock };
  let auditService: { record: jest.Mock };
  let parentQuery: {
    innerJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  const setup = (options: {
    students: Array<ReturnType<typeof student>>;
    links: Array<Record<string, unknown>>;
    metrics?: Map<string, unknown>;
  }) => {
    studentRepo = {
      find: jest.fn((query?: { where?: { id?: { value?: string[] } } }) => {
        const ids = query?.where?.id?.value;
        return Promise.resolve(
          ids
            ? options.students.filter((item) => ids.includes(item.id))
            : options.students,
        );
      }),
    };
    parentQuery = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(options.links),
    };
    studentParentRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(parentQuery),
    };
    classRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 'class-a', name: 'JSS 1' },
        { id: 'class-b', name: 'JSS 2' },
      ]),
    };
    groupStudentRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value: unknown) => value),
      save: jest
        .fn<Promise<unknown>, [StudentMembershipRecord[]]>()
        .mockResolvedValue([]),
    };
    groupGuardianRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue([]),
    };
    feeMetricService = {
      calculateForStudents: jest
        .fn()
        .mockResolvedValue(
          options.metrics ??
            new Map(
              options.students.map((item) => [
                item.id,
                'metricOverride' in item ? item.metricOverride : metric(100),
              ]),
            ),
        ),
    };
    auditService = { record: jest.fn().mockResolvedValue({}) };
    service = new GuardianGroupMembershipService(
      studentRepo as never,
      studentParentRepo as never,
      {} as never,
      classRepo as never,
      groupStudentRepo as never,
      groupGuardianRepo as never,
      feeMetricService as never,
      new GuardianConditionValidator(),
      new GuardianConditionEvaluator(),
      auditService as never,
    );
  };

  const group = (type: GuardianGroupType = GuardianGroupType.DYNAMIC) =>
    ({
      id: 'group-1',
      schoolId: 'school-1',
      name: 'Fee-aware group',
      type,
      condition: type === GuardianGroupType.DYNAMIC ? condition : null,
      isActive: true,
      isDeleted: false,
      createdById: 'admin-1',
      updatedById: 'admin-1',
    }) as unknown as GuardianGroup;

  const parentLink = (guardianId: string, studentIds: string[]) =>
    studentIds.map((studentId) => ({
      studentId,
      parent: {
        id: guardianId,
        firstName: guardianId.toUpperCase(),
        lastName: 'Guardian',
        email: `${guardianId}@example.com`,
        role: UserRole.PARENT,
        schoolId: 'school-1',
        isActive: true,
      },
    }));

  it('evaluates dynamic groups in batches and deduplicates guardians by qualifying children', async () => {
    setup({
      students: [
        student('student-1', 70),
        student('student-2', 20),
        student('student-3', 80),
      ],
      links: [
        ...parentLink('guardian-1', ['student-1']),
        ...parentLink('guardian-2', ['student-3']),
      ],
      metrics: new Map([
        ['student-1', metric(70)],
        ['student-2', metric(20)],
        ['student-3', metric(80)],
      ]),
    });

    const preview = await service.previewGroup(group());

    expect(preview.matchedStudentCount).toBe(2);
    expect(preview.students.map((item) => item.studentId)).toEqual([
      'student-1',
      'student-3',
    ]);
    expect(preview.exclusions.map((item) => item.studentId)).toContain(
      'student-2',
    );
    expect(preview.uniqueGuardianCount).toBe(2);
    expect(preview.guardians[0].qualifyingStudentIds).toEqual(['student-1']);
    expect(feeMetricService.calculateForStudents).toHaveBeenCalledWith(
      expect.objectContaining({
        studentIds: ['student-1', 'student-2', 'student-3'],
      }),
    );
  });

  it('records unavailable fee data instead of treating it as a non-match', async () => {
    setup({
      students: [student('student-1', -1)],
      links: [],
      metrics: new Map([['student-1', unavailableMetric()]]),
    });

    const preview = await service.previewGroup(group());

    expect(preview.unevaluableStudentCount).toBe(1);
    expect(preview.students[0].state).toBe(
      GuardianGroupMembershipState.UNEVALUABLE,
    );
    expect(preview.students[0].reason).toContain('No active term');
  });

  it('keeps fixed membership until it is explicitly changed', async () => {
    setup({
      students: [student('student-1', 100), student('student-2', 100)],
      links: parentLink('guardian-1', ['student-1', 'student-2']),
    });
    groupStudentRepo.find.mockResolvedValue([
      {
        id: 'membership-1',
        groupId: 'group-1',
        studentId: 'student-1',
        schoolId: 'school-1',
        source: GuardianGroupMembershipSource.FIXED,
        state: GuardianGroupMembershipState.ACTIVE,
      },
    ]);

    await service.syncFixedMembers(
      group(GuardianGroupType.FIXED),
      ['student-2'],
      'admin-1',
    );

    const saved = groupStudentRepo.save.mock.calls[0][0];
    expect(saved.find((item) => item.studentId === 'student-1')?.state).toBe(
      GuardianGroupMembershipState.INACTIVE,
    );
    expect(saved.find((item) => item.studentId === 'student-2')?.state).toBe(
      GuardianGroupMembershipState.ACTIVE,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      'school-1',
      'admin-1',
      expect.any(String),
      'GUARDIAN_GROUP',
      'group-1',
      expect.objectContaining({ studentIds: ['student-1'] }),
      expect.objectContaining({ studentIds: ['student-2'] }),
    );
  });

  it('rejects unsupported condition fields such as arm or attendance', async () => {
    setup({ students: [], links: [] });

    await expect(
      service.validateDraft('school-1', {
        name: 'Unsupported',
        type: GuardianGroupType.DYNAMIC,
        condition: {
          type: GuardianConditionNodeType.GROUP,
          combinator: GuardianConditionCombinator.AND,
          conditions: [
            {
              type: GuardianConditionNodeType.CONDITION,
              field: 'ATTENDANCE_PERCENTAGE',
              operator: GuardianConditionOperator.GREATER_THAN,
              value: 80,
            },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

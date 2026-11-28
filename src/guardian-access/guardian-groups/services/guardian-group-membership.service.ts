import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserRole } from '../../../common/enums';
import { ClassEntity } from '../../../classes/entities/class.entity';
import { Student } from '../../../students/entities/student.entity';
import { StudentParent } from '../../../students/entities/student-parent.entity';
import { User } from '../../../users/entities/user.entity';
import {
  GuardianConditionEvaluation,
  GuardianConditionGroup,
  GuardianStudentMetrics,
} from '../../interfaces/guardian-condition.interface';
import {
  GuardianFeeMetric,
  GuardianFeeFactsRequest,
} from '../../interfaces/guardian-fee-facts.interface';
import {
  DEFAULT_GUARDIAN_FEE_METRIC_KEY,
  collectGuardianFeeConditionConfigs,
  emptyGuardianFeeMetric,
} from '../../interfaces/guardian-fee-condition.util';
import { GuardianFeeMetricScope } from '../../enums/guardian-condition.enums';
import { GuardianAuditAction } from '../../enums/guardian-policy.enums';
import { GuardianAccessAuditService } from '../../services/guardian-access-audit.service';
import { GuardianConditionEvaluator } from '../../services/guardian-condition-evaluator.service';
import { GuardianConditionValidator } from '../../services/guardian-condition-validator.service';
import { GuardianFeeMetricService } from '../../services/guardian-fee-metric.service';
import {
  GuardianGroupConditionEvaluationType,
  GuardianGroupPreviewType,
  GuardianGroupGuardianPreviewType,
  GuardianGroupStudentPreviewType,
} from '../dto/guardian-group-output.dto';
import { GuardianGroupDraftInput } from '../dto/guardian-group.input';
import {
  GuardianGroupMembershipSource,
  GuardianGroupMembershipState,
  GuardianGroupType,
} from '../enums/guardian-group.enums';
import { GuardianGroup } from '../entities/guardian-group.entity';
import { GuardianGroupGuardian } from '../entities/guardian-group-guardian.entity';
import { GuardianGroupStudent } from '../entities/guardian-group-student.entity';

interface GroupEvaluationSpec {
  type: GuardianGroupType;
  condition?: GuardianConditionGroup | null;
  studentIds?: string[];
}

interface ValidatedDraft {
  type: GuardianGroupType;
  condition: GuardianConditionGroup | null;
  studentIds: string[];
}

type GuardianLink = {
  guardianId: string;
  guardianName: string;
  email: string | null;
  qualifyingStudentIds: string[];
};

@Injectable()
export class GuardianGroupMembershipService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(GuardianGroupStudent)
    private readonly groupStudentRepo: Repository<GuardianGroupStudent>,
    @InjectRepository(GuardianGroupGuardian)
    private readonly groupGuardianRepo: Repository<GuardianGroupGuardian>,
    private readonly feeMetricService: GuardianFeeMetricService,
    private readonly conditionValidator: GuardianConditionValidator,
    private readonly conditionEvaluator: GuardianConditionEvaluator,
    private readonly auditService: GuardianAccessAuditService,
  ) {}

  validateDraft = async (
    schoolId: string,
    draft: GuardianGroupDraftInput,
    options: { requireStudents?: boolean } = {},
  ): Promise<ValidatedDraft> => {
    if (draft.type === GuardianGroupType.DYNAMIC) {
      if (!draft.condition) {
        throw new BadRequestException(
          'A dynamic guardian group requires a condition',
        );
      }
      if (draft.studentIds?.length) {
        throw new BadRequestException(
          'A dynamic guardian group cannot have fixed student members',
        );
      }
      return {
        type: draft.type,
        condition: this.conditionValidator.validate(draft.condition),
        studentIds: [],
      };
    }
    if (draft.condition) {
      throw new BadRequestException(
        'A fixed guardian group cannot have a condition',
      );
    }
    const studentIds = Array.from(new Set(draft.studentIds ?? []));
    if (options.requireStudents && studentIds.length === 0) {
      throw new BadRequestException(
        'A fixed guardian group requires at least one student',
      );
    }
    await this.assertStudentsExist(schoolId, studentIds);
    return { type: draft.type, condition: null, studentIds };
  };

  validateUpdate = async (
    schoolId: string,
    group: GuardianGroup,
    updates: {
      type?: GuardianGroupType;
      condition?: Record<string, unknown>;
      clearCondition?: boolean;
      studentIds?: string[];
    },
  ): Promise<ValidatedDraft> => {
    const type = updates.type ?? group.type;
    const typeChanged =
      updates.type !== undefined && updates.type !== group.type;
    const hasCondition =
      type === GuardianGroupType.FIXED
        ? false
        : updates.condition !== undefined ||
          (updates.clearCondition === true || typeChanged
            ? false
            : Boolean(group.condition));
    const conditionInput =
      updates.condition === undefined
        ? hasCondition && group.condition
          ? group.condition
          : undefined
        : type === GuardianGroupType.FIXED
          ? undefined
          : updates.condition;
    const studentIds =
      updates.studentIds === undefined
        ? type === GuardianGroupType.FIXED
          ? await this.getActiveStudentIds(group.id)
          : []
        : Array.from(new Set(updates.studentIds ?? []));
    return this.validateDraft(schoolId, {
      name: group.name,
      type,
      ...(conditionInput ? { condition: conditionInput } : {}),
      ...(type === GuardianGroupType.FIXED ? { studentIds } : {}),
    });
  };

  previewDraft = async (
    schoolId: string,
    draft: GuardianGroupDraftInput,
  ): Promise<GuardianGroupPreviewType> => {
    const validated = await this.validateDraft(schoolId, draft);
    return this.evaluate(schoolId, validated);
  };

  previewGroup = async (
    group: GuardianGroup,
  ): Promise<GuardianGroupPreviewType> => {
    const spec = await this.specForGroup(group);
    return this.evaluate(group.schoolId, spec);
  };

  syncGroup = async (
    group: GuardianGroup,
    actorId: string,
  ): Promise<GuardianGroupPreviewType> => {
    const preview = await this.previewGroup(group);
    await this.persistPreview(group, preview, actorId);
    return preview;
  };

  syncFixedMembers = async (
    group: GuardianGroup,
    studentIds: string[],
    actorId: string,
  ): Promise<GuardianGroupPreviewType> => {
    const validated = await this.validateDraft(
      group.schoolId,
      {
        name: group.name,
        type: GuardianGroupType.FIXED,
        studentIds,
      },
      { requireStudents: false },
    );
    const preview = await this.evaluate(group.schoolId, validated);
    await this.persistPreview(group, preview, actorId);
    return preview;
  };

  getActiveStudentIds = async (groupId: string): Promise<string[]> => {
    const records = await this.groupStudentRepo.find({
      where: { groupId, state: GuardianGroupMembershipState.ACTIVE },
      select: { studentId: true },
    });
    return records.map((record) => record.studentId);
  };

  private specForGroup = async (
    group: GuardianGroup,
  ): Promise<GroupEvaluationSpec> => {
    if (group.type === GuardianGroupType.DYNAMIC) {
      return {
        type: group.type,
        condition: group.condition
          ? this.conditionValidator.validate(group.condition)
          : null,
      };
    }
    return {
      type: group.type,
      studentIds: await this.getActiveStudentIds(group.id),
    };
  };

  private assertStudentsExist = async (
    schoolId: string,
    studentIds: string[],
  ): Promise<void> => {
    if (studentIds.length === 0) return;
    const students = await this.studentRepo.find({
      where: { id: In(studentIds), schoolId },
      select: { id: true },
    });
    const found = new Set(students.map((student) => student.id));
    const missing = studentIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw new NotFoundException(
        `Student not found: ${missing.slice(0, 3).join(', ')}`,
      );
    }
  };

  private evaluate = async (
    schoolId: string,
    spec: GroupEvaluationSpec,
  ): Promise<GuardianGroupPreviewType> => {
    const students = await this.loadStudents(schoolId, spec);
    const feeMetrics = await this.buildFeeMetrics(
      schoolId,
      students.map((student) => student.id),
      spec.condition,
    );
    const classNames = await this.loadClassNames(
      schoolId,
      students.map((student) => student.currentClassId).filter(Boolean),
    );
    const evaluatedAt = new Date();
    const studentPreviews = students.map((student) =>
      this.buildStudentPreview(
        student,
        spec,
        feeMetrics.get(student.id) ?? {},
        classNames,
        evaluatedAt,
      ),
    );
    const qualifyingStudentIds = studentPreviews
      .filter(
        (student) => student.state === GuardianGroupMembershipState.ACTIVE,
      )
      .map((student) => student.studentId);
    const guardians = await this.resolveGuardians(
      schoolId,
      qualifyingStudentIds,
      evaluatedAt,
    );
    const activeStudents = studentPreviews.filter(
      (student) => student.state === GuardianGroupMembershipState.ACTIVE,
    );
    const unevaluable = studentPreviews.filter(
      (student) => student.state === GuardianGroupMembershipState.UNEVALUABLE,
    );
    const exclusions = studentPreviews.filter(
      (student) =>
        student.state === GuardianGroupMembershipState.INACTIVE ||
        student.state === GuardianGroupMembershipState.UNEVALUABLE,
    );
    const breakdown: Record<string, unknown> = {
      byClass: this.countBy(
        activeStudents.map((student) => student.className ?? 'Unassigned'),
      ),
      byStatus: this.countBy(
        activeStudents.map((student) => student.studentStatus),
      ),
      excludedByReason: this.countBy(
        exclusions.map(
          (student) => student.reason ?? 'Conditions did not match',
        ),
      ),
    };
    return {
      source:
        spec.type === GuardianGroupType.DYNAMIC
          ? GuardianGroupMembershipSource.DYNAMIC
          : GuardianGroupMembershipSource.FIXED,
      studentCount: students.length,
      matchedStudentCount: activeStudents.length,
      unevaluableStudentCount: unevaluable.length,
      uniqueGuardianCount: guardians.length,
      students: studentPreviews.filter(
        (student) => student.state !== GuardianGroupMembershipState.INACTIVE,
      ),
      exclusions,
      guardians,
      breakdown,
      generatedAt: evaluatedAt,
    };
  };

  private loadStudents = async (
    schoolId: string,
    spec: GroupEvaluationSpec,
  ): Promise<Student[]> => {
    if (spec.type === GuardianGroupType.FIXED) {
      const studentIds = Array.from(new Set(spec.studentIds ?? []));
      if (studentIds.length === 0) return [];
      return this.studentRepo.find({
        where: { id: In(studentIds), schoolId },
        order: { firstName: 'ASC', lastName: 'ASC' },
      });
    }
    return this.studentRepo.find({
      where: { schoolId, isArchived: false },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
  };

  private buildFeeMetrics = async (
    schoolId: string,
    studentIds: string[],
    condition: GuardianConditionGroup | null | undefined,
  ): Promise<Map<string, Record<string, GuardianFeeMetric>>> => {
    const byStudent = new Map<string, Record<string, GuardianFeeMetric>>();
    if (studentIds.length === 0) return byStudent;
    const configs = collectGuardianFeeConditionConfigs(condition);
    const results = await Promise.all(
      Array.from(configs.entries()).map(async ([key, config]) => {
        const request: GuardianFeeFactsRequest = {
          schoolId,
          studentIds,
          scope: GuardianFeeMetricScope.ACTIVE_TERM_AND_SESSION_INVOICES,
          feeSelectionMode: config.selectionMode,
          feeCategoryIds: config.categoryIds,
          amountBasis: config.amountBasis,
        };
        return {
          key,
          feeResults: await this.feeMetricService.calculateForStudents(request),
        };
      }),
    );
    studentIds.forEach((studentId) => {
      const metrics: Record<string, GuardianFeeMetric> = {};
      results.forEach(({ key, feeResults }) => {
        const metric = feeResults.get(studentId);
        if (metric) metrics[key] = metric;
      });
      byStudent.set(studentId, metrics);
    });
    return byStudent;
  };

  private buildStudentPreview = (
    student: Student,
    spec: GroupEvaluationSpec,
    feeMetrics: Record<string, GuardianFeeMetric>,
    classNames: Map<string, string>,
    evaluatedAt: Date,
  ): GuardianGroupStudentPreviewType => {
    const metrics = this.buildStudentMetrics(student, feeMetrics);
    if (spec.type === GuardianGroupType.FIXED) {
      return {
        studentId: student.id,
        studentName: student.fullName,
        classId: student.currentClassId ?? null,
        className: student.currentClassId
          ? (classNames.get(student.currentClassId) ?? null)
          : null,
        studentStatus: student.status,
        state: student.isArchived
          ? GuardianGroupMembershipState.INACTIVE
          : GuardianGroupMembershipState.ACTIVE,
        ...(student.isArchived ? { reason: 'Student is archived' } : {}),
        metrics: this.mapMetrics(metrics),
        evaluatedAt,
      };
    }
    const evaluation = this.conditionEvaluator.evaluate(
      spec.condition ?? null,
      metrics,
    );
    const state =
      evaluation.unavailableReasons.length > 0
        ? GuardianGroupMembershipState.UNEVALUABLE
        : evaluation.matched
          ? GuardianGroupMembershipState.ACTIVE
          : GuardianGroupMembershipState.INACTIVE;
    const reason =
      evaluation.unavailableReasons.length > 0
        ? evaluation.unavailableReasons.join('; ')
        : evaluation.matched
          ? undefined
          : 'Conditions did not match';
    return {
      studentId: student.id,
      studentName: student.fullName,
      classId: student.currentClassId ?? null,
      className: student.currentClassId
        ? (classNames.get(student.currentClassId) ?? null)
        : null,
      studentStatus: student.status,
      state,
      ...(reason ? { reason } : {}),
      conditionEvaluation: this.mapConditionEvaluation(evaluation),
      metrics: this.mapMetrics(metrics),
      evaluatedAt,
    };
  };

  private buildStudentMetrics = (
    student: Student,
    feeMetrics: Record<string, GuardianFeeMetric>,
  ): GuardianStudentMetrics => {
    const defaultFee =
      feeMetrics[DEFAULT_GUARDIAN_FEE_METRIC_KEY] ?? emptyGuardianFeeMetric();
    return {
      studentClassId: student.currentClassId ?? null,
      studentStatus: student.status,
      ...(defaultFee.feePaymentPercentage === undefined
        ? {}
        : { feePaymentPercentage: defaultFee.feePaymentPercentage }),
      ...(defaultFee.outstandingBalance === undefined
        ? {}
        : { outstandingBalance: defaultFee.outstandingBalance }),
      feeMetrics,
      unavailable: defaultFee.unavailable,
    };
  };

  private loadClassNames = async (
    schoolId: string,
    classIds: Array<string | null | undefined>,
  ): Promise<Map<string, string>> => {
    const ids = Array.from(new Set(classIds.filter(Boolean) as string[]));
    if (ids.length === 0) return new Map();
    const classes = await this.classRepo.find({
      where: { id: In(ids), schoolId },
      select: { id: true, name: true },
    });
    return new Map(
      classes.map((classEntity) => [classEntity.id, classEntity.name]),
    );
  };

  private resolveGuardians = async (
    schoolId: string,
    studentIds: string[],
    evaluatedAt: Date,
  ): Promise<GuardianGroupGuardianPreviewType[]> => {
    if (studentIds.length === 0) return [];
    const links = await this.studentParentRepo
      .createQueryBuilder('link')
      .innerJoinAndSelect('link.parent', 'parent')
      .where('link.studentId IN (:...studentIds)', { studentIds })
      .andWhere('parent.schoolId = :schoolId', { schoolId })
      .andWhere('parent.role = :role', { role: UserRole.PARENT })
      .andWhere('parent.isActive = :isActive', { isActive: true })
      .getMany();
    const byGuardian = new Map<string, GuardianLink>();
    for (const link of links) {
      const guardian = link.parent;
      const existing = byGuardian.get(guardian.id);
      if (existing) {
        existing.qualifyingStudentIds.push(link.studentId);
        continue;
      }
      byGuardian.set(guardian.id, {
        guardianId: guardian.id,
        guardianName: `${guardian.firstName} ${guardian.lastName}`.trim(),
        email: guardian.email ?? null,
        qualifyingStudentIds: [link.studentId],
      });
    }
    return Array.from(byGuardian.values()).map((guardian) => ({
      guardianId: guardian.guardianId,
      guardianName: guardian.guardianName,
      email: guardian.email,
      qualifyingStudentIds: Array.from(new Set(guardian.qualifyingStudentIds)),
      state: GuardianGroupMembershipState.ACTIVE,
      evaluatedAt,
    }));
  };

  private mapConditionEvaluation = (
    evaluation: GuardianConditionEvaluation,
  ): GuardianGroupConditionEvaluationType => ({
    matched: evaluation.matched,
    unavailableReasons: evaluation.unavailableReasons,
    details: evaluation.details.map((detail) => ({
      field: detail.field ?? null,
      operator: detail.operator ?? null,
      value: detail.value ?? null,
      ...(detail.fee
        ? { fee: detail.fee as unknown as Record<string, unknown> }
        : {}),
      matched: detail.matched,
      reason: detail.reason,
    })),
  });

  private mapMetrics = (
    metrics: GuardianStudentMetrics,
  ): Record<string, unknown> => ({
    studentClassId: metrics.studentClassId ?? null,
    studentStatus: metrics.studentStatus,
    feePaymentPercentage: metrics.feePaymentPercentage ?? null,
    outstandingBalance: metrics.outstandingBalance ?? null,
    feeMetrics: metrics.feeMetrics ?? {},
    unavailable: metrics.unavailable,
  });

  private countBy = (values: string[]): Record<string, number> =>
    values.reduce<Record<string, number>>((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {});

  private persistPreview = async (
    group: GuardianGroup,
    preview: GuardianGroupPreviewType,
    actorId: string,
  ): Promise<void> => {
    const beforeStudents = await this.groupStudentRepo.find({
      where: { groupId: group.id },
    });
    const beforeActiveIds = beforeStudents
      .filter((record) => record.state === GuardianGroupMembershipState.ACTIVE)
      .map((record) => record.studentId);
    const allStudentPreviews = new Map(
      [...preview.students, ...preview.exclusions].map((student) => [
        student.studentId,
        student,
      ]),
    );
    const previewStudentIds = new Set(allStudentPreviews.keys());
    const studentRecords = new Map(
      beforeStudents.map((record) => [record.studentId, record]),
    );
    for (const student of allStudentPreviews.values()) {
      const existing = studentRecords.get(student.studentId);
      const record =
        existing ??
        this.groupStudentRepo.create({
          groupId: group.id,
          schoolId: group.schoolId,
          studentId: student.studentId,
        });
      record.source =
        preview.source === GuardianGroupMembershipSource.DYNAMIC
          ? GuardianGroupMembershipSource.DYNAMIC
          : GuardianGroupMembershipSource.FIXED;
      record.state = student.state;
      record.reason = student.reason ?? null;
      record.evaluation = student.conditionEvaluation
        ? (student.conditionEvaluation as unknown as Record<string, unknown>)
        : null;
      record.evaluatedAt = student.evaluatedAt ?? preview.generatedAt;
      record.actorId = actorId;
      studentRecords.set(student.studentId, record);
    }
    for (const record of beforeStudents) {
      if (previewStudentIds.has(record.studentId)) continue;
      if (record.state === GuardianGroupMembershipState.INACTIVE) continue;
      record.state = GuardianGroupMembershipState.INACTIVE;
      record.reason = 'Student no longer matches the group';
      record.evaluatedAt = preview.generatedAt;
      record.actorId = actorId;
    }
    await this.groupStudentRepo.save(Array.from(studentRecords.values()));

    const beforeGuardians = await this.groupGuardianRepo.find({
      where: { groupId: group.id },
    });
    const beforeActiveGuardianIds = beforeGuardians
      .filter((record) => record.state === GuardianGroupMembershipState.ACTIVE)
      .map((record) => record.guardianId);
    const guardianRecords = new Map(
      beforeGuardians.map((record) => [record.guardianId, record]),
    );
    for (const guardian of preview.guardians) {
      const existing = guardianRecords.get(guardian.guardianId);
      const record =
        existing ??
        this.groupGuardianRepo.create({
          groupId: group.id,
          schoolId: group.schoolId,
          guardianId: guardian.guardianId,
        });
      record.qualifyingStudentIds = guardian.qualifyingStudentIds;
      record.source =
        preview.source === GuardianGroupMembershipSource.DYNAMIC
          ? GuardianGroupMembershipSource.DYNAMIC
          : GuardianGroupMembershipSource.FIXED;
      record.state = guardian.state;
      record.reason = guardian.reason ?? null;
      record.evaluatedAt = guardian.evaluatedAt ?? preview.generatedAt;
      record.actorId = actorId;
      guardianRecords.set(guardian.guardianId, record);
    }
    for (const record of beforeGuardians) {
      if (guardianRecords.has(record.guardianId)) continue;
      if (record.state === GuardianGroupMembershipState.INACTIVE) continue;
      record.state = GuardianGroupMembershipState.INACTIVE;
      record.qualifyingStudentIds = [];
      record.reason = 'Guardian no longer qualifies';
      record.evaluatedAt = preview.generatedAt;
      record.actorId = actorId;
    }
    await this.groupGuardianRepo.save(Array.from(guardianRecords.values()));

    const afterActiveIds = preview.students
      .filter(
        (student) => student.state === GuardianGroupMembershipState.ACTIVE,
      )
      .map((student) => student.studentId);
    const afterActiveGuardianIds = preview.guardians
      .filter(
        (guardian) => guardian.state === GuardianGroupMembershipState.ACTIVE,
      )
      .map((guardian) => guardian.guardianId);
    await this.auditService.record(
      group.schoolId,
      actorId,
      group.type === GuardianGroupType.FIXED
        ? GuardianAuditAction.GROUP_MEMBERS_UPDATED
        : GuardianAuditAction.GROUP_EVALUATED,
      'GUARDIAN_GROUP',
      group.id,
      {
        studentIds: beforeActiveIds,
        guardianIds: beforeActiveGuardianIds,
      },
      {
        studentIds: afterActiveIds,
        guardianIds: afterActiveGuardianIds,
        enteredStudentIds: afterActiveIds.filter(
          (id) => !beforeActiveIds.includes(id),
        ),
        leftStudentIds: beforeActiveIds.filter(
          (id) => !afterActiveIds.includes(id),
        ),
        unevaluableStudentIds: preview.students
          .filter(
            (student) =>
              student.state === GuardianGroupMembershipState.UNEVALUABLE,
          )
          .map((student) => student.studentId),
      },
    );
  };
}

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums';
import { Student } from '../../students/entities/student.entity';
import { StudentParent } from '../../students/entities/student-parent.entity';
import { User } from '../../users/entities/user.entity';
import { GuardianAccessException } from '../entities/guardian-access-exception.entity';
import { GuardianAccessPolicy } from '../entities/guardian-access-policy.entity';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import { GuardianFeeMetricScope } from '../enums/guardian-condition.enums';
import {
  GuardianEvaluateInput,
  GuardianPolicyDecision,
} from '../interfaces/guardian-decision.interface';
import { GuardianStudentMetrics } from '../interfaces/guardian-condition.interface';
import { GuardianAccessEvaluator } from './guardian-access-evaluator.service';
import { GuardianFeeMetricService } from './guardian-fee-metric.service';

@Injectable()
export class GuardianEnforcementService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(GuardianAccessPolicy)
    private readonly policyRepo: Repository<GuardianAccessPolicy>,
    @InjectRepository(GuardianAccessException)
    private readonly exceptionRepo: Repository<GuardianAccessException>,
    private readonly evaluator: GuardianAccessEvaluator,
    private readonly feeMetricService: GuardianFeeMetricService,
  ) {}

  getDecision = async (
    guardianId: string,
    schoolId: string,
    studentId: string,
    resource: GuardianResource,
    action: GuardianAction,
    now?: Date,
  ): Promise<GuardianPolicyDecision> => {
    const student = await this.loadStudent(studentId, schoolId);
    const linked = await this.studentParentRepo.findOne({
      where: { studentId, parentId: guardianId },
    });
    const [policies, exceptions, metrics] = await Promise.all([
      this.policyRepo.find({
        where: { schoolId },
        relations: ['rules'],
        order: { priority: 'DESC' },
      }),
      this.exceptionRepo.find({ where: { schoolId, studentId } }),
      this.buildMetrics(student, schoolId),
    ]);
    const input: GuardianEvaluateInput = {
      user: { sub: guardianId, role: UserRole.PARENT, schoolId },
      studentId: student.id,
      studentSchoolId: student.schoolId,
      guardianLinked: Boolean(linked),
      resource,
      action,
      policies,
      exceptions,
      metrics,
      now,
    };
    return this.evaluator.evaluate(input);
  };

  assertPermission = async (
    guardianId: string,
    schoolId: string,
    studentId: string,
    resource: GuardianResource,
    action: GuardianAction,
  ): Promise<void> => {
    const decision = await this.getDecision(
      guardianId,
      schoolId,
      studentId,
      resource,
      action,
    );
    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason);
    }
  };

  snapshot = async (guardianId: string, schoolId: string) => {
    const links = await this.studentParentRepo.find({
      where: { parentId: guardianId },
      relations: ['student', 'student.currentClass'],
    });
    const students = links
      .map((link) => link.student)
      .filter(
        (student) =>
          student && !student.isArchived && student.schoolId === schoolId,
      );
    const snapshots = await Promise.all(
      students.map((student) =>
        this.snapshotForStudent(student, guardianId, schoolId),
      ),
    );
    return snapshots;
  };

  preview = async (
    adminSchoolId: string,
    guardianId: string,
    studentId: string,
    resource: GuardianResource,
    action: GuardianAction,
  ) => {
    const guardian = await this.userRepo.findOne({ where: { id: guardianId } });
    if (!guardian || guardian.schoolId !== adminSchoolId) {
      throw new ForbiddenException('Guardian is outside your school');
    }
    if (guardian.role !== UserRole.PARENT) {
      throw new ForbiddenException('The selected user is not a parent');
    }
    const decision = await this.getDecision(
      guardianId,
      adminSchoolId,
      studentId,
      resource,
      action,
    );
    const student = await this.loadStudent(studentId, adminSchoolId);
    const metrics = await this.buildMetrics(student, adminSchoolId);
    return { decision, metrics };
  };

  private snapshotForStudent = async (
    student: Student,
    guardianId: string,
    schoolId: string,
  ) => {
    const metrics = await this.buildMetrics(student, schoolId);
    const [policies, exceptions] = await Promise.all([
      this.policyRepo.find({
        where: { schoolId },
        relations: ['rules'],
        order: { priority: 'DESC' },
      }),
      this.exceptionRepo.find({ where: { schoolId, studentId: student.id } }),
    ]);
    const permissions = Object.values(GuardianResource).flatMap((resource) =>
      Object.values(GuardianAction).map((action) => {
        const decision = this.evaluator.evaluate({
          user: {
            sub: guardianId,
            role: UserRole.PARENT,
            schoolId,
          },
          studentId: student.id,
          studentSchoolId: student.schoolId,
          guardianLinked: true,
          resource,
          action,
          policies,
          exceptions,
          metrics,
        });
        return {
          resource,
          action,
          allowed: decision.allowed,
          reason: decision.reason,
          sourceType: decision.sourceType,
          policyId: decision.policyId,
          ruleId: decision.ruleId,
          evaluatedAt: decision.evaluatedAt,
        };
      }),
    );
    return {
      studentId: student.id,
      schoolId: student.schoolId,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      permissions,
      generatedAt: new Date(),
    };
  };

  private buildMetrics = async (
    student: Student,
    schoolId: string,
  ): Promise<GuardianStudentMetrics> => {
    const fee = await this.feeMetricService.calculateForStudent(
      student.id,
      schoolId,
      GuardianFeeMetricScope.ACTIVE_TERM_AND_SESSION_INVOICES,
    );
    return {
      studentClassId: student.currentClassId ?? null,
      studentStatus: student.status,
      ...(fee.feePaymentPercentage === undefined
        ? {}
        : { feePaymentPercentage: fee.feePaymentPercentage }),
      ...(fee.outstandingBalance === undefined
        ? {}
        : { outstandingBalance: fee.outstandingBalance }),
      unavailable: fee.unavailable,
    };
  };

  private loadStudent = async (
    studentId: string,
    schoolId: string,
  ): Promise<Student> => {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, schoolId, isArchived: false },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  };
}

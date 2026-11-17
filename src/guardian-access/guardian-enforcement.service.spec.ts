import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StudentStatus, UserRole } from '../common/enums';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { User } from '../users/entities/user.entity';
import { GuardianAccessException } from './entities/guardian-access-exception.entity';
import { GuardianAccessPolicy } from './entities/guardian-access-policy.entity';
import {
  GuardianAction,
  GuardianResource,
} from './enums/guardian-permission.enums';
import { GuardianAccessEvaluator } from './services/guardian-access-evaluator.service';
import { GuardianConditionEvaluator } from './services/guardian-condition-evaluator.service';
import { GuardianConditionValidator } from './services/guardian-condition-validator.service';
import { GuardianEnforcementService } from './services/guardian-enforcement.service';
import { GuardianFeeMetricService } from './services/guardian-fee-metric.service';

describe('guardian enforcement service', () => {
  const buildService = (links: Partial<StudentParent>[] = []) => {
    const studentRepo = {
      findOne: jest.fn(),
    } as unknown as Repository<Student>;
    const studentParentRepo = {
      find: jest.fn().mockResolvedValue(links as StudentParent[]),
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<StudentParent>;
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<User>;
    const policyRepo = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<GuardianAccessPolicy>;
    const exceptionRepo = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<GuardianAccessException>;
    const feeMetricService = {
      calculateForStudent: jest.fn().mockResolvedValue({
        feePaymentPercentage: 50,
        outstandingBalance: 1000,
        unavailable: {},
      }),
    } as unknown as GuardianFeeMetricService;
    const evaluator = new GuardianAccessEvaluator(
      new GuardianConditionEvaluator(),
      new GuardianConditionValidator(),
    );
    const service = new GuardianEnforcementService(
      studentRepo,
      studentParentRepo,
      userRepo,
      policyRepo,
      exceptionRepo,
      evaluator,
      feeMetricService,
    );
    return { service, userRepo };
  };
  const student = (id: string, schoolId: string, isArchived = false) =>
    ({
      id,
      schoolId,
      isArchived,
      status: StudentStatus.ACTIVE,
      firstName: 'Test',
      lastName: 'Student',
      currentClassId: null,
    }) as Student;

  it('builds a default-deny snapshot only for in-school linked students', async () => {
    const { service } = buildService([
      { student: student('student-a', 'school-a') },
      { student: student('student-b', 'school-b') },
      { student: student('student-c', 'school-a', true) },
    ] as Partial<StudentParent>[]);
    const snapshot = await service.snapshot('parent-a', 'school-a');
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].studentId).toBe('student-a');
    expect(snapshot[0].permissions).toHaveLength(
      Object.values(GuardianResource).length *
        Object.values(GuardianAction).length,
    );
    expect(
      snapshot[0].permissions.every((item) => item.allowed === false),
    ).toBe(true);
  });

  it('rejects preview for a guardian outside the school', async () => {
    const { service, userRepo } = buildService();
    (userRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'parent-a',
      role: UserRole.PARENT,
      schoolId: 'school-b',
    });
    await expect(
      service.preview(
        'school-a',
        'parent-a',
        'student-a',
        GuardianResource.FEES,
        GuardianAction.VIEW,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

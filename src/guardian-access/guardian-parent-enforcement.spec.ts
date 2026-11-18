import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StudentStatus, UserRole } from '../common/enums';
import { AttendanceResolver } from '../attendance/attendance.resolver';
import { CommunicationResolver } from '../communication/communication.resolver';
import { AnnouncementAudience } from '../communication/entities/announcement.entity';
import { FeesResolver } from '../fees/fees.resolver';
import { ResultsResolver } from '../results/results.resolver';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { StudentsResolver } from '../students/students.resolver';
import { TimetableResolver } from '../timetable/resolvers/timetable.resolver';
import { User } from '../users/entities/user.entity';
import { GuardianAccessException } from './entities/guardian-access-exception.entity';
import { GuardianAccessPolicy } from './entities/guardian-access-policy.entity';
import {
  GuardianAction,
  GuardianResource,
} from './enums/guardian-permission.enums';
import {
  GuardianEffect,
  GuardianPolicyScope,
} from './enums/guardian-policy.enums';
import { GuardianAccessEvaluator } from './services/guardian-access-evaluator.service';
import { GuardianConditionEvaluator } from './services/guardian-condition-evaluator.service';
import { GuardianConditionValidator } from './services/guardian-condition-validator.service';
import { GuardianEnforcementService } from './services/guardian-enforcement.service';
import { GuardianFeeMetricService } from './services/guardian-fee-metric.service';

const PARENT = 'parent-a';
const ALLOWED_CHILD = 'student-a';
const DENIED_CHILD = 'student-b';
const SCHOOL_ID = 'school-a';

const parent = {
  sub: PARENT,
  schoolId: SCHOOL_ID,
  role: UserRole.PARENT,
};
const staff = {
  sub: 'staff-a',
  schoolId: SCHOOL_ID,
  role: UserRole.BURSAR,
};

const child = (id: string, classId = 'class-a') =>
  ({
    id,
    schoolId: SCHOOL_ID,
    isArchived: false,
    status: StudentStatus.ACTIVE,
    firstName: 'Test',
    lastName: id,
    currentClassId: classId,
  }) as unknown as Student;

const children = [child(ALLOWED_CHILD), child(DENIED_CHILD, 'class-b')];
const links = children.map((student) => ({
  parentId: PARENT,
  studentId: student.id,
  student,
})) as unknown as StudentParent[];

const rules = (effect: GuardianEffect) =>
  Object.values(GuardianResource).flatMap((resource) =>
    Object.values(GuardianAction).map((action) => ({
      id: `${resource}-${action}-${effect}`,
      resource,
      action,
      effect,
    })),
  );

const policies = [
  {
    id: 'allow-all',
    schoolId: SCHOOL_ID,
    name: 'Allow all',
    scope: GuardianPolicyScope.SCHOOL_DEFAULT,
    enabled: true,
    priority: 0,
    rules: rules(GuardianEffect.ALLOW),
  },
  {
    id: 'deny-child',
    schoolId: SCHOOL_ID,
    name: 'Denied child',
    scope: GuardianPolicyScope.STUDENT_OVERRIDE,
    studentId: DENIED_CHILD,
    enabled: true,
    priority: 10,
    rules: rules(GuardianEffect.DENY),
  },
] as unknown as GuardianAccessPolicy[];

const buildEnforcement = () => {
  const studentRepo = {
    findOne: jest.fn(({ where }: { where: { id: string; schoolId: string } }) =>
      Promise.resolve(
        children.find(
          (student) =>
            student.id === where.id && student.schoolId === where.schoolId,
        ) ?? null,
      ),
    ),
  };
  const studentParentRepo = {
    find: jest.fn(({ where }: { where: { parentId: string } }) =>
      Promise.resolve(links.filter((link) => link.parentId === where.parentId)),
    ),
    findOne: jest.fn(
      ({ where }: { where: { studentId: string; parentId: string } }) =>
        Promise.resolve(
          links.find(
            (link) =>
              link.studentId === where.studentId &&
              link.parentId === where.parentId,
          ) ?? null,
        ),
    ),
  };
  const userRepo = { findOne: jest.fn().mockResolvedValue(null) };
  const policyRepo = { find: jest.fn().mockResolvedValue(policies) };
  const exceptionRepo = { find: jest.fn().mockResolvedValue([]) };
  const feeMetricService = {
    calculateForStudent: jest.fn().mockResolvedValue({
      feePaymentPercentage: 100,
      outstandingBalance: 0,
      unavailable: {},
    }),
  };
  const evaluator = new GuardianAccessEvaluator(
    new GuardianConditionEvaluator(),
    new GuardianConditionValidator(),
  );
  return new GuardianEnforcementService(
    studentRepo as never,
    studentParentRepo as never,
    userRepo as unknown as Repository<User>,
    policyRepo as never,
    exceptionRepo as unknown as Repository<GuardianAccessException>,
    evaluator,
    feeMetricService as unknown as GuardianFeeMetricService,
  );
};

const announcement = (
  id: string,
  audience: AnnouncementAudience,
  targetClassId: string | null = null,
) => ({ id, audience, targetClassId, status: 'published' });

describe('guardian enforcement on parent-facing resolvers', () => {
  let enforcement: GuardianEnforcementService;
  let studentsResolver: StudentsResolver;
  let feesResolver: FeesResolver;
  let resultsResolver: ResultsResolver;
  let attendanceResolver: AttendanceResolver;
  let timetableResolver: TimetableResolver;
  let communicationResolver: CommunicationResolver;

  beforeEach(() => {
    enforcement = buildEnforcement();
    const studentsService = {
      getLinkedStudentById: jest.fn((id: string) => Promise.resolve(child(id))),
      getStudentById: jest.fn((id: string) => Promise.resolve(child(id))),
      getStudentsByParent: jest.fn().mockResolvedValue(children),
    };
    const feesService = {
      getBankAccounts: jest.fn().mockResolvedValue([{ id: 'bank-a' }]),
      getInvoiceById: jest.fn((id: string) =>
        Promise.resolve({
          id,
          studentId: id === 'invoice-denied' ? DENIED_CHILD : ALLOWED_CHILD,
        }),
      ),
      getStudentInvoicesForUser: jest.fn().mockResolvedValue([]),
      submitPaymentBatch: jest.fn().mockResolvedValue({ id: 'batch' }),
      getPaymentSubmissionById: jest.fn((id: string) =>
        Promise.resolve({
          id,
          shares: [
            {
              studentId: id === 'batch-denied' ? DENIED_CHILD : ALLOWED_CHILD,
            },
          ],
        }),
      ),
      getParentSubmissions: jest.fn().mockResolvedValue([
        { id: 'batch-allowed', shares: [{ studentId: ALLOWED_CHILD }] },
        { id: 'batch-denied', shares: [{ studentId: DENIED_CHILD }] },
        {
          id: 'batch-mixed',
          shares: [{ studentId: ALLOWED_CHILD }, { studentId: DENIED_CHILD }],
        },
      ]),
      getParentSubmissionsPaginated: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      }),
      getShareById: jest.fn((id: string) =>
        Promise.resolve({
          id,
          studentId: id === 'share-denied' ? DENIED_CHILD : ALLOWED_CHILD,
          batch: { schoolId: SCHOOL_ID },
        }),
      ),
      getReceipt: jest.fn().mockResolvedValue({ id: 'receipt' }),
    };
    const resultsService = {
      getStudentResult: jest.fn((studentId: string) =>
        Promise.resolve({ studentId }),
      ),
      getMyChildResults: jest.fn((studentId: string) =>
        Promise.resolve([{ studentId }]),
      ),
    };
    const attendanceService = {
      getStudentAttendance: jest.fn((studentId: string) =>
        Promise.resolve([{ studentId }]),
      ),
      getStudentAttendanceSummary: jest.fn((studentId: string) =>
        Promise.resolve({ studentId }),
      ),
    };
    const timetableService = {
      getChildTimetable: jest.fn((studentId: string) =>
        Promise.resolve({
          student: child(studentId),
          entries: [],
        }),
      ),
      getMyChildrenTimetables: jest
        .fn()
        .mockResolvedValue(
          children.map((student) => ({ student, entries: [] })),
        ),
    };
    const communicationService = {
      getVisibleById: jest.fn((id: string) =>
        Promise.resolve(
          announcement(
            id,
            AnnouncementAudience.CLASS,
            id === 'class-denied' ? 'class-b' : 'class-a',
          ),
        ),
      ),
      listVisible: jest
        .fn()
        .mockResolvedValue([
          announcement('school', AnnouncementAudience.SCHOOL),
          announcement('guardians', AnnouncementAudience.GUARDIANS),
          announcement('class-allowed', AnnouncementAudience.CLASS, 'class-a'),
          announcement('class-denied', AnnouncementAudience.CLASS, 'class-b'),
        ]),
      listVisiblePaginated: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      }),
    };
    studentsResolver = new StudentsResolver(
      studentsService as never,
      enforcement,
    );
    feesResolver = new FeesResolver(feesService as never, enforcement);
    resultsResolver = new ResultsResolver(resultsService as never, enforcement);
    attendanceResolver = new AttendanceResolver(
      attendanceService as never,
      enforcement,
    );
    timetableResolver = new TimetableResolver(
      timetableService as never,
      enforcement,
    );
    communicationResolver = new CommunicationResolver(
      communicationService as never,
      enforcement,
    );
  });

  it('allows and denies child profile reads for parents', async () => {
    await expect(
      studentsResolver.student(ALLOWED_CHILD, parent),
    ).resolves.toMatchObject({ id: ALLOWED_CHILD });
    await expect(
      studentsResolver.student(DENIED_CHILD, parent),
    ).rejects.toThrow(ForbiddenException);
  });

  it('filters myChildren to policy-allowed children', async () => {
    await expect(studentsResolver.myChildren(parent)).resolves.toEqual([
      child(ALLOWED_CHILD),
    ]);
  });

  it('enforces invoice and payment submission access per child', async () => {
    await expect(
      feesResolver.invoice('invoice-allowed', parent),
    ).resolves.toMatchObject({ studentId: ALLOWED_CHILD });
    await expect(
      feesResolver.invoice('invoice-denied', parent),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      feesResolver.myStudentInvoices(ALLOWED_CHILD, parent),
    ).resolves.toEqual([]);
    await expect(
      feesResolver.myStudentInvoices(DENIED_CHILD, parent),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      feesResolver.submitPaymentBatch(
        { shares: [{ studentId: ALLOWED_CHILD }] } as never,
        parent,
      ),
    ).resolves.toEqual({ id: 'batch' });
    await expect(
      feesResolver.submitPaymentBatch(
        {
          shares: [{ studentId: ALLOWED_CHILD }, { studentId: DENIED_CHILD }],
        } as never,
        parent,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('gates school-level bank accounts on at least one allowed linked child', async () => {
    await expect(feesResolver.bankAccounts(parent)).resolves.toEqual([
      { id: 'bank-a' },
    ]);
    const noChildren = { ...parent, sub: 'parent-without-allowed-children' };
    await expect(feesResolver.bankAccounts(noChildren)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('hides denied children from parent payment history and receipts', async () => {
    await expect(
      feesResolver.paymentSubmission('batch-allowed', parent),
    ).resolves.toMatchObject({ id: 'batch-allowed' });
    await expect(
      feesResolver.paymentSubmission('batch-denied', parent),
    ).rejects.toThrow(ForbiddenException);
    await expect(feesResolver.myPaymentSubmissions(parent)).resolves.toEqual([
      { id: 'batch-allowed', shares: [{ studentId: ALLOWED_CHILD }] },
    ]);
    const page = await feesResolver.myPaymentSubmissionsPage(
      { page: 1, limit: 50 },
      parent,
    );
    expect(page.total).toBe(1);
    expect(page.items).toEqual([
      { id: 'batch-allowed', shares: [{ studentId: ALLOWED_CHILD }] },
    ]);
    await expect(
      feesResolver.paymentReceipt('share-allowed', parent),
    ).resolves.toEqual({ id: 'receipt' });
    await expect(
      feesResolver.paymentReceipt('share-denied', parent),
    ).rejects.toThrow(ForbiddenException);
  });

  it('enforces results, attendance and timetable access for parents', async () => {
    await expect(
      resultsResolver.studentResult(ALLOWED_CHILD, 'term-a', parent),
    ).resolves.toEqual({ studentId: ALLOWED_CHILD });
    await expect(
      resultsResolver.studentResult(DENIED_CHILD, 'term-a', parent),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      resultsResolver.myChildResults(DENIED_CHILD, parent),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      attendanceResolver.studentAttendance(ALLOWED_CHILD, 'term-a', parent),
    ).resolves.toEqual([{ studentId: ALLOWED_CHILD }]);
    await expect(
      attendanceResolver.studentAttendanceSummary(
        DENIED_CHILD,
        'term-a',
        parent,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      timetableResolver.childTimetable(ALLOWED_CHILD, undefined, parent),
    ).resolves.toMatchObject({ student: child(ALLOWED_CHILD) });
    await expect(
      timetableResolver.childTimetable(DENIED_CHILD, undefined, parent),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      timetableResolver.myChildrenTimetables(undefined, parent),
    ).resolves.toHaveLength(1);
  });

  it('filters parent announcements by allowed children and audience', async () => {
    const visible = await communicationResolver.announcements(parent);
    expect(visible.map((item) => item.id)).toEqual([
      'school',
      'guardians',
      'class-allowed',
    ]);
    const page = await communicationResolver.announcementsPage(
      { page: 1, limit: 50 },
      parent,
    );
    expect(page.total).toBe(3);
    await expect(
      communicationResolver.announcement('class-denied', parent),
    ).rejects.toThrow('Announcement not found');
  });

  it('leaves staff workflows untouched', async () => {
    const assertSpy = jest.spyOn(enforcement, 'assertPermission');
    const allowedSpy = jest.spyOn(enforcement, 'getAllowedChildren');
    await expect(
      studentsResolver.student(DENIED_CHILD, staff),
    ).resolves.toMatchObject({ id: DENIED_CHILD });
    await expect(
      feesResolver.invoice('invoice-denied', staff),
    ).resolves.toMatchObject({ studentId: DENIED_CHILD });
    await expect(feesResolver.bankAccounts(staff)).resolves.toEqual([
      { id: 'bank-a' },
    ]);
    await expect(
      resultsResolver.studentResult(DENIED_CHILD, 'term-a', staff),
    ).resolves.toEqual({ studentId: DENIED_CHILD });
    await expect(
      attendanceResolver.studentAttendance(DENIED_CHILD, 'term-a', staff),
    ).resolves.toEqual([{ studentId: DENIED_CHILD }]);
    await expect(
      timetableResolver.childTimetable(DENIED_CHILD, undefined, staff),
    ).resolves.toMatchObject({ student: child(DENIED_CHILD) });
    await expect(
      timetableResolver.myChildrenTimetables(undefined, staff),
    ).resolves.toHaveLength(2);
    await expect(
      communicationResolver.announcements(staff),
    ).resolves.toHaveLength(4);
    expect(assertSpy).not.toHaveBeenCalled();
    expect(allowedSpy).not.toHaveBeenCalled();
  });
});

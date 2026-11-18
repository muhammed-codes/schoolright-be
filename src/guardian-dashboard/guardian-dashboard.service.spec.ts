import { ForbiddenException } from '@nestjs/common';
import { ResultStatus, UserRole } from '../common/enums';
import { InvoiceStatus } from '../fees/entities/student-invoice.entity';
import {
  PaymentShareStatus,
  PaymentSubmissionStudentShare,
} from '../fees/entities/payment-submission-student-share.entity';
import { GuardianResource } from '../guardian-access/enums/guardian-permission.enums';
import { AnnouncementAudience } from '../communication/entities/announcement.entity';
import { GuardianDashboardAttentionType } from './dto/guardian-dashboard.dto';
import { GuardianDashboardResolver } from './guardian-dashboard.resolver';
import {
  GuardianDashboardService,
  GuardianDashboardUser,
} from './guardian-dashboard.service';

const USER: GuardianDashboardUser = {
  sub: 'parent-a',
  schoolId: 'school-a',
  role: UserRole.PARENT,
};

const NOW = new Date('2026-11-18T09:00:00.000Z');

const term = () =>
  ({
    id: 'term-a',
    name: 'First Term',
    schoolId: 'school-a',
    sessionId: 'session-a',
    startDate: '2026-09-01',
    endDate: '2026-12-15',
    session: { id: 'session-a', name: '2026/2027' },
  }) as never;

const guardian = () =>
  ({
    id: 'parent-a',
    firstName: 'Ngozi',
    lastName: 'Okafor',
    fullName: 'Ngozi Okafor',
    role: UserRole.PARENT,
    schoolId: 'school-a',
    avatarUrl: null,
  }) as never;

const student = () =>
  ({
    id: 'student-a',
    firstName: 'Ada',
    lastName: 'Okafor',
    fullName: 'Ada Okafor',
    admissionNumber: 'ADM-001',
    schoolId: 'school-a',
    currentClassId: 'class-a',
    isArchived: false,
    passportPhotoUrl: 'student.png',
    currentClass: { name: 'JSS 1' },
  }) as never;

const result = (
  id: string,
  approvedAt: Date,
  status: ResultStatus = ResultStatus.PUBLISHED,
) =>
  ({
    id,
    percentage: 78.5,
    grade: 'B',
    position: 4,
    resultSheet: {
      status,
      approvedAt,
      createdAt: approvedAt,
      updatedAt: approvedAt,
      term: { name: 'First Term', session: { name: '2026/2027' } },
    },
  }) as never;

const timetableEntry = (
  id: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
) =>
  ({
    id,
    dayOfWeek,
    subjectId: 'subject-a',
    subject: { name: 'Mathematics' },
    teacher: { fullName: 'Mr Bello' },
    period: { startTime, endTime },
  }) as never;

const announcement = (id: string, publishedAt: Date) =>
  ({
    id,
    title: 'Sports day',
    body: 'Sports day will hold on Friday.',
    publishedAt,
    audience: AnnouncementAudience.SCHOOL,
    status: 'published',
  }) as never;

const pendingShare = (id: string, createdAt: Date) =>
  ({
    id,
    studentId: 'student-a',
    amount: 5000,
    status: PaymentShareStatus.PENDING,
    createdAt,
  }) as unknown as PaymentSubmissionStudentShare;

const build = () => {
  const userRepo = {
    findOne: jest.fn().mockResolvedValue(guardian()),
  };
  const studentRepo = {
    findOne: jest.fn().mockResolvedValue(student()),
  };
  const studentParentRepo = {
    findOne: jest.fn().mockResolvedValue({ studentId: 'student-a' }),
  };
  const enforcement = {
    assertPermission: jest.fn().mockResolvedValue(undefined),
    getAllowedChildren: jest
      .fn()
      .mockResolvedValue([{ studentId: 'student-a', classId: 'class-a' }]),
  };
  const feeMetricService = {
    calculateForStudent: jest.fn().mockResolvedValue({
      feePaymentPercentage: 50,
      totalAmount: 1000,
      totalPaid: 500,
      outstandingBalance: 500,
      paymentPercentage: 50,
      status: InvoiceStatus.PARTIALLY_PAID,
      unavailable: {},
    }),
  };
  const attendanceService = {
    getStudentAttendanceSummary: jest.fn().mockResolvedValue({
      attendancePercentage: 75,
      daysPresent: 6,
      daysAbsent: 1,
      daysLate: 1,
      totalMarkedDays: 8,
    }),
  };
  const resultsService = {
    getMyChildResults: jest.fn().mockResolvedValue([]),
  };
  const timetableService = {
    getChildTimetable: jest.fn().mockResolvedValue({ entries: [] }),
  };
  const communicationService = {
    listVisible: jest.fn().mockResolvedValue([]),
  };
  const feesService = {
    getParentSubmissions: jest.fn().mockResolvedValue([]),
  };
  const termsService = {
    getActiveTerm: jest.fn().mockResolvedValue(term()),
    getTermById: jest.fn().mockResolvedValue(term()),
  };
  const schoolsService = {
    findById: jest.fn().mockResolvedValue({ timezone: 'Africa/Lagos' }),
  };
  const service = new GuardianDashboardService(
    userRepo as never,
    studentRepo as never,
    studentParentRepo as never,
    enforcement as never,
    feeMetricService as never,
    attendanceService as never,
    resultsService as never,
    timetableService as never,
    communicationService as never,
    feesService as never,
    termsService as never,
    schoolsService as never,
  );
  return {
    service,
    userRepo,
    studentRepo,
    studentParentRepo,
    enforcement,
    feeMetricService,
    attendanceService,
    resultsService,
    timetableService,
    communicationService,
    feesService,
    termsService,
    schoolsService,
  };
};

describe('guardian dashboard service', () => {
  it('rejects a guardian whose school does not match the token', async () => {
    const deps = build();
    deps.userRepo.findOne.mockResolvedValue(null);

    await expect(
      deps.service.getDashboard(USER, 'student-a', undefined, NOW),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a non-parent caller', async () => {
    const deps = build();

    await expect(
      deps.service.getDashboard(
        { ...USER, role: UserRole.TEACHER },
        'student-a',
        undefined,
        NOW,
      ),
    ).rejects.toThrow('Parent access is required');
  });

  it('rejects a student outside the guardian school or not linked', async () => {
    const outside = build();
    outside.studentRepo.findOne.mockResolvedValue(null);
    await expect(
      outside.service.getDashboard(USER, 'student-b', undefined, NOW),
    ).rejects.toThrow(ForbiddenException);

    const unlinked = build();
    unlinked.studentParentRepo.findOne.mockResolvedValue(null);
    await expect(
      unlinked.service.getDashboard(USER, 'student-a', undefined, NOW),
    ).rejects.toThrow(ForbiddenException);
  });

  it('uses the active term when termId is omitted', async () => {
    const deps = build();

    const dashboard = await deps.service.getDashboard(
      USER,
      'student-a',
      undefined,
      NOW,
    );

    expect(deps.termsService.getActiveTerm).toHaveBeenCalledWith('school-a');
    expect(deps.termsService.getTermById).not.toHaveBeenCalled();
    expect(dashboard.term.id).toBe('term-a');
  });

  it('uses and validates an explicitly requested term', async () => {
    const deps = build();

    await deps.service.getDashboard(USER, 'student-a', 'term-a', NOW);

    expect(deps.termsService.getTermById).toHaveBeenCalledWith(
      'term-a',
      'school-a',
    );
    expect(deps.termsService.getActiveTerm).not.toHaveBeenCalled();
  });

  it('throws when profile access is denied', async () => {
    const deps = build();
    deps.enforcement.assertPermission.mockImplementation(
      (
        _guardianId: string,
        _schoolId: string,
        _studentId: string,
        resource: GuardianResource,
      ) =>
        resource === GuardianResource.CHILD_PROFILE
          ? Promise.reject(new ForbiddenException('denied'))
          : Promise.resolve(),
    );

    await expect(
      deps.service.getDashboard(USER, 'student-a', undefined, NOW),
    ).rejects.toThrow('You do not have access to this child profile');
  });

  const deniedSections: Array<{
    resource: GuardianResource;
    field: string;
    expected: unknown;
    attentionType?: GuardianDashboardAttentionType;
  }> = [
    {
      resource: GuardianResource.ATTENDANCE,
      field: 'attendance',
      expected: null,
    },
    {
      resource: GuardianResource.FEES,
      field: 'fees',
      expected: null,
      attentionType: GuardianDashboardAttentionType.FEES,
    },
    {
      resource: GuardianResource.RESULTS,
      field: 'result',
      expected: null,
      attentionType: GuardianDashboardAttentionType.RESULT,
    },
    { resource: GuardianResource.TIMETABLE, field: 'timetable', expected: [] },
    {
      resource: GuardianResource.COMMUNICATION,
      field: 'announcements',
      expected: [],
      attentionType: GuardianDashboardAttentionType.ANNOUNCEMENT,
    },
  ];

  it.each(deniedSections)(
    'returns no data when $resource view is denied',
    async ({ resource, field, expected, attentionType }) => {
      const deps = build();
      deps.feeMetricService.calculateForStudent.mockResolvedValue({
        totalAmount: 1000,
        totalPaid: 500,
        outstandingBalance: 500,
        paymentPercentage: 50,
        status: InvoiceStatus.PARTIALLY_PAID,
        unavailable: {},
      });
      deps.resultsService.getMyChildResults.mockResolvedValue([
        result('result-a', new Date(NOW.getTime() - DAY)),
      ]);
      deps.enforcement.assertPermission.mockImplementation(
        (
          _guardianId: string,
          _schoolId: string,
          _studentId: string,
          checked: GuardianResource,
        ) =>
          checked === resource
            ? Promise.reject(new ForbiddenException('denied'))
            : Promise.resolve(),
      );

      const dashboard = await deps.service.getDashboard(
        USER,
        'student-a',
        undefined,
        NOW,
      );

      expect(dashboard[field as keyof typeof dashboard]).toEqual(expected);
      const sectionName =
        resource === GuardianResource.COMMUNICATION
          ? 'ANNOUNCEMENTS'
          : String(resource);
      const state = dashboard.sectionStates.find(
        (item) => item.sectionName === sectionName,
      );
      expect(state).toMatchObject({
        available: false,
        permissionDenied: true,
      });
      expect(state?.unavailableReason).toBe(
        'You do not have access to this section.',
      );
      if (attentionType) {
        expect(
          dashboard.attentionItems.some((item) => item.type === attentionType),
        ).toBe(false);
      }
    },
  );

  it('denies payment history attention data when its view is denied', async () => {
    const deps = build();
    deps.feeMetricService.calculateForStudent.mockResolvedValue({
      totalAmount: 1000,
      totalPaid: 1000,
      outstandingBalance: 0,
      paymentPercentage: 100,
      status: InvoiceStatus.PAID,
      unavailable: {},
    });
    deps.feesService.getParentSubmissions.mockResolvedValue([
      { shares: [pendingShare('share-a', NOW)] },
    ]);
    deps.enforcement.assertPermission.mockImplementation(
      (
        _guardianId: string,
        _schoolId: string,
        _studentId: string,
        resource: GuardianResource,
      ) =>
        resource === GuardianResource.PAYMENT_HISTORY
          ? Promise.reject(new ForbiddenException('denied'))
          : Promise.resolve(),
    );

    const dashboard = await deps.service.getDashboard(
      USER,
      'student-a',
      undefined,
      NOW,
    );

    expect(deps.feesService.getParentSubmissions).not.toHaveBeenCalled();
    expect(dashboard.attentionItems).toEqual([]);
    expect(
      dashboard.sectionStates.find(
        (state) => state.sectionName === 'PAYMENT_HISTORY',
      ),
    ).toMatchObject({ available: false, permissionDenied: true });
  });

  it('uses only published results and picks the newest one', async () => {
    const deps = build();
    const newer = result('published-new', new Date(NOW.getTime() - DAY));
    const older = result('published-old', new Date(NOW.getTime() - 10 * DAY));
    const draft = result(
      'draft',
      new Date(NOW.getTime() - 12 * DAY),
      ResultStatus.DRAFT,
    );
    deps.resultsService.getMyChildResults.mockResolvedValue([
      older,
      draft,
      newer,
    ]);

    const dashboard = await deps.service.getDashboard(
      USER,
      'student-a',
      undefined,
      NOW,
    );

    expect(deps.resultsService.getMyChildResults).toHaveBeenCalledWith(
      'student-a',
      'parent-a',
      'school-a',
    );
    expect(dashboard.result?.id).toBe('published-new');
    expect(dashboard.result?.termName).toBe('First Term');
    expect(dashboard.result?.sessionName).toBe('2026/2027');
    expect(dashboard.result?.percentage).toBe(78.5);
    expect(dashboard.attentionItems).toContainEqual(
      expect.objectContaining({
        id: 'result-published-new',
        type: GuardianDashboardAttentionType.RESULT,
      }),
    );
    expect(
      dashboard.attentionItems.some((item) => item.id.includes('draft')),
    ).toBe(false);
  });

  it('creates no attention items when nothing qualifies', async () => {
    const deps = build();
    deps.feeMetricService.calculateForStudent.mockResolvedValue({
      totalAmount: 1000,
      totalPaid: 1000,
      outstandingBalance: 0,
      paymentPercentage: 100,
      status: InvoiceStatus.PAID,
      unavailable: {},
    });
    deps.resultsService.getMyChildResults.mockResolvedValue([
      result('published-old', new Date(NOW.getTime() - 30 * DAY)),
    ]);
    deps.communicationService.listVisible.mockResolvedValue([
      announcement('announcement-old', new Date(NOW.getTime() - 30 * DAY)),
    ]);

    const dashboard = await deps.service.getDashboard(
      USER,
      'student-a',
      undefined,
      NOW,
    );

    expect(dashboard.attentionItems).toEqual([]);
    expect(dashboard.announcements).toHaveLength(1);
  });

  it('composes one item per qualifying attention category', async () => {
    const deps = build();
    deps.feesService.getParentSubmissions.mockResolvedValue([
      {
        shares: [
          pendingShare('share-a', new Date(NOW.getTime() - 2 * DAY)),
          pendingShare('share-b', new Date(NOW.getTime() - DAY)),
        ],
      },
    ]);
    deps.resultsService.getMyChildResults.mockResolvedValue([
      result('published-new', new Date(NOW.getTime() - 2 * DAY)),
    ]);
    deps.communicationService.listVisible.mockResolvedValue([
      announcement('announcement-a', new Date(NOW.getTime() - DAY)),
      announcement('announcement-b', new Date(NOW.getTime() - 3 * DAY)),
    ]);

    const dashboard = await deps.service.getDashboard(
      USER,
      'student-a',
      undefined,
      NOW,
    );

    expect(dashboard.attentionItems.map((item) => item.id)).toEqual([
      'fees-outstanding',
      'pending-payment-submission',
      'result-published-new',
      'announcement-announcement-a',
    ]);
    expect(dashboard.attentionItems[1]).toMatchObject({
      description: '2 payment submissions are awaiting approval.',
      amount: 10000,
    });
    expect(new Set(dashboard.attentionItems.map((item) => item.id)).size).toBe(
      dashboard.attentionItems.length,
    );
    expect(dashboard.announcements).toHaveLength(2);
  });

  it('only includes class announcements for the selected child', async () => {
    const deps = build();
    deps.communicationService.listVisible.mockResolvedValue([
      {
        ...announcement('own-class', new Date(NOW.getTime() - DAY)),
        audience: AnnouncementAudience.CLASS,
        targetClassId: 'class-a',
      },
      {
        ...announcement('other-class', new Date(NOW.getTime() - DAY)),
        audience: AnnouncementAudience.CLASS,
        targetClassId: 'class-b',
      },
    ]);

    const dashboard = await deps.service.getDashboard(
      USER,
      'student-a',
      undefined,
      NOW,
    );

    expect(dashboard.announcements.map((item) => item.id)).toEqual([
      'own-class',
    ]);
    expect(deps.enforcement.getAllowedChildren).not.toHaveBeenCalled();
  });

  it('uses the school timezone for today and period status', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    try {
      const deps = build();
      deps.timetableService.getChildTimetable.mockResolvedValue({
        entries: [
          timetableEntry('entry-completed', 3, '08:00', '09:00'),
          timetableEntry('entry-current', 3, '09:30', '10:30'),
          timetableEntry('entry-upcoming', 3, '11:00', '12:00'),
          timetableEntry('entry-later', 3, '12:30', '13:30'),
          timetableEntry('entry-other-day', 4, '08:00', '09:00'),
        ],
      });

      const dashboard = await deps.service.getDashboard(
        USER,
        'student-a',
        undefined,
      );

      expect(deps.timetableService.getChildTimetable).toHaveBeenCalledWith(
        'student-a',
        'parent-a',
        UserRole.PARENT,
        'school-a',
        'term-a',
      );
      expect(dashboard.timetable.map((entry) => entry.id)).toEqual([
        'entry-completed',
        'entry-current',
        'entry-upcoming',
        'entry-later',
      ]);
      expect(dashboard.timetable.map((entry) => entry.status)).toEqual([
        'COMPLETED',
        'CURRENT',
        'UPCOMING',
        'UPCOMING',
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('omits timetable statuses and marks the section unavailable for an invalid timezone', async () => {
    const deps = build();
    deps.schoolsService.findById.mockResolvedValue({
      timezone: 'Invalid/Zone',
    });
    deps.timetableService.getChildTimetable.mockResolvedValue({
      entries: [timetableEntry('entry-a', 3, '08:00', '09:00')],
    });

    const dashboard = await deps.service.getDashboard(
      USER,
      'student-a',
      undefined,
      NOW,
    );

    expect(dashboard.timetable[0].status).toBeNull();
    expect(
      dashboard.sectionStates.find(
        (state) => state.sectionName === 'TIMETABLE',
      ),
    ).toMatchObject({
      available: false,
      permissionDenied: false,
      unavailableReason: 'This section is temporarily unavailable.',
    });
  });

  it('handles empty and unavailable data without throwing', async () => {
    const deps = build();
    deps.feeMetricService.calculateForStudent.mockResolvedValue({
      unavailable: { outstandingBalance: 'No active term' },
    });
    deps.attendanceService.getStudentAttendanceSummary.mockResolvedValue(null);
    deps.resultsService.getMyChildResults.mockResolvedValue([]);
    deps.timetableService.getChildTimetable.mockResolvedValue({ entries: [] });
    deps.communicationService.listVisible.mockResolvedValue([]);
    deps.feesService.getParentSubmissions.mockResolvedValue([]);

    const dashboard = await deps.service.getDashboard(
      USER,
      'student-a',
      undefined,
      NOW,
    );

    expect(dashboard.attendance).toBeNull();
    expect(dashboard.fees).toBeNull();
    expect(dashboard.result).toBeNull();
    expect(dashboard.timetable).toEqual([]);
    expect(dashboard.announcements).toEqual([]);
    expect(dashboard.attentionItems).toEqual([]);
    expect(dashboard.sectionStates).toHaveLength(7);
    expect(
      dashboard.sectionStates.find((state) => state.sectionName === 'FEES'),
    ).toMatchObject({
      available: false,
      permissionDenied: false,
      unavailableReason: 'This section is temporarily unavailable.',
    });
  });

  it('derives guardian identity from the current user in the resolver', async () => {
    const dashboardService = { getDashboard: jest.fn().mockResolvedValue({}) };
    const resolver = new GuardianDashboardResolver(dashboardService as never);

    await resolver.guardianDashboard(USER, 'student-a', undefined);

    expect(dashboardService.getDashboard).toHaveBeenCalledWith(
      USER,
      'student-a',
      undefined,
    );
  });
});

const DAY = 24 * 60 * 60 * 1000;

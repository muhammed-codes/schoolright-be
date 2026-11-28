import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResultStatus, UserRole } from '../common/enums';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { User } from '../users/entities/user.entity';
import { filterAnnouncementsForGuardian } from '../communication/communication.guardian-filter';
import { CommunicationService } from '../communication/communication.service';
import { Announcement } from '../communication/entities/announcement.entity';
import { FeesService } from '../fees/fees.service';
import {
  PaymentShareStatus,
  PaymentSubmissionStudentShare,
} from '../fees/entities/payment-submission-student-share.entity';
import { GuardianFeeMetricService } from '../guardian-access/services/guardian-fee-metric.service';
import {
  GuardianAction,
  GuardianResource,
} from '../guardian-access/enums/guardian-permission.enums';
import { GuardianEnforcementService } from '../guardian-access/services/guardian-enforcement.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ResultsService } from '../results/results.service';
import { StudentResult } from '../results/entities/student-result.entity';
import { SchoolsService } from '../schools/schools.service';
import { TermsService } from '../terms/terms.service';
import { Term } from '../terms/entities/term.entity';
import { TimetableService } from '../timetable/services/timetable.service';
import { TimetableEntry } from '../timetable/entities/timetable-entry.entity';
import {
  GuardianDashboard,
  GuardianDashboardAnnouncement,
  GuardianDashboardAttentionItem,
  GuardianDashboardAttentionStatus,
  GuardianDashboardAttentionType,
  GuardianDashboardSectionState,
  GuardianDashboardTimetableEntry,
  GuardianDashboardTimetableStatus,
} from './dto/guardian-dashboard.dto';

export type GuardianDashboardUser = {
  sub: string;
  schoolId?: string | null;
  role: UserRole;
};

type ZonedTime = {
  dayOfWeek: number;
  minutes: number;
  resolved: boolean;
};

type DashboardSectionResource = Exclude<
  GuardianResource,
  | GuardianResource.INVOICES
  | GuardianResource.PAYMENT_SUBMISSION
  | GuardianResource.RECEIPTS
>;

const PERMISSION_DENIED_REASON = 'You do not have access to this section.';
const UNAVAILABLE_REASON = 'This section is temporarily unavailable.';
const WEEKDAYS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};
const SECTION_NAMES: Record<DashboardSectionResource, string> = {
  [GuardianResource.CHILD_PROFILE]: 'CHILD_PROFILE',
  [GuardianResource.ATTENDANCE]: 'ATTENDANCE',
  [GuardianResource.FEES]: 'FEES',
  [GuardianResource.PAYMENT_HISTORY]: 'PAYMENT_HISTORY',
  [GuardianResource.RESULTS]: 'RESULTS',
  [GuardianResource.TIMETABLE]: 'TIMETABLE',
  [GuardianResource.COMMUNICATION]: 'ANNOUNCEMENTS',
};
const DASHBOARD_RESOURCES: DashboardSectionResource[] = [
  GuardianResource.ATTENDANCE,
  GuardianResource.FEES,
  GuardianResource.PAYMENT_HISTORY,
  GuardianResource.RESULTS,
  GuardianResource.TIMETABLE,
  GuardianResource.COMMUNICATION,
];
const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class GuardianDashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    private readonly enforcement: GuardianEnforcementService,
    private readonly feeMetricService: GuardianFeeMetricService,
    private readonly attendanceService: AttendanceService,
    private readonly resultsService: ResultsService,
    private readonly timetableService: TimetableService,
    private readonly communicationService: CommunicationService,
    private readonly feesService: FeesService,
    private readonly termsService: TermsService,
    private readonly schoolsService: SchoolsService,
  ) {}

  getDashboard = async (
    user: GuardianDashboardUser,
    studentId: string,
    termId?: string,
    now: Date = new Date(),
  ): Promise<GuardianDashboard> => {
    const { guardian, student, schoolId } = await this.loadContext(
      user,
      studentId,
    );
    const term = await this.resolveTerm(termId, schoolId);

    await this.assertPermission(
      guardian.id,
      schoolId,
      student.id,
      GuardianResource.CHILD_PROFILE,
      true,
    );
    const checks = await Promise.all(
      DASHBOARD_RESOURCES.map(async (resource) => ({
        resource,
        allowed: await this.assertPermission(
          guardian.id,
          schoolId,
          student.id,
          resource,
        ),
      })),
    );
    const allowed = new Map(
      checks.map(({ resource, allowed: permitted }) => [resource, permitted]),
    );
    const isAllowed = (resource: DashboardSectionResource) =>
      allowed.get(resource) === true;

    const [
      attendanceSummary,
      feeMetric,
      childResults,
      childTimetable,
      visibleAnnouncements,
      paymentBatches,
      school,
    ] = await Promise.all([
      this.optional(isAllowed(GuardianResource.ATTENDANCE), () =>
        this.attendanceService.getStudentAttendanceSummary(
          student.id,
          term.id,
          guardian.id,
          UserRole.PARENT,
          schoolId,
        ),
      ),
      this.optional(isAllowed(GuardianResource.FEES), () =>
        this.feeMetricService.calculateForStudent(student.id, schoolId),
      ),
      this.optional(isAllowed(GuardianResource.RESULTS), () =>
        this.resultsService.getMyChildResults(
          student.id,
          guardian.id,
          schoolId,
        ),
      ),
      this.optional(isAllowed(GuardianResource.TIMETABLE), () =>
        this.timetableService.getChildTimetable(
          student.id,
          guardian.id,
          UserRole.PARENT,
          schoolId,
          term.id,
        ),
      ),
      this.optional(isAllowed(GuardianResource.COMMUNICATION), () =>
        this.communicationService.listVisible(
          guardian.id,
          UserRole.PARENT,
          schoolId,
        ),
      ),
      this.optional(isAllowed(GuardianResource.PAYMENT_HISTORY), () =>
        this.feesService.getParentSubmissions(guardian.id, schoolId),
      ),
      this.optional(isAllowed(GuardianResource.TIMETABLE), async () => {
        try {
          return await this.schoolsService.findById(schoolId);
        } catch {
          return null;
        }
      }),
    ]);

    const fees =
      feeMetric?.paymentPercentage !== undefined &&
      feeMetric.status !== undefined
        ? {
            totalAmount: feeMetric.totalAmount ?? 0,
            totalPaid: feeMetric.totalPaid ?? 0,
            outstandingBalance: feeMetric.outstandingBalance ?? 0,
            paymentPercentage: feeMetric.paymentPercentage,
            status: feeMetric.status,
          }
        : null;

    const latestResult = this.latestPublishedResult(childResults ?? []);
    const result = latestResult ? this.mapResult(latestResult) : null;

    const zonedTime = this.resolveZonedTime(school?.timezone, now);
    const timetable = this.mapTimetable(
      childTimetable?.entries ?? [],
      zonedTime,
    );

    const selectedClassIds = new Set<string>();
    if (student.currentClassId) {
      selectedClassIds.add(student.currentClassId);
    }
    const targetedAnnouncementIds = isAllowed(GuardianResource.COMMUNICATION)
      ? await this.communicationService.getTargetedRecipientAnnouncementIds(
          guardian.id,
          schoolId,
        )
      : new Set<string>();
    const authorizedAnnouncements = filterAnnouncementsForGuardian(
      visibleAnnouncements ?? [],
      selectedClassIds,
      targetedAnnouncementIds,
    );
    const announcements = authorizedAnnouncements
      .slice(0, 3)
      .map((announcement) => this.mapAnnouncement(announcement));

    const pendingShares = (paymentBatches ?? [])
      .flatMap((batch) => batch.shares ?? [])
      .filter(
        (share) =>
          share.studentId === student.id &&
          share.status === PaymentShareStatus.PENDING,
      );
    const attentionItems = this.composeAttentionItems({
      fees,
      pendingShares,
      result,
      publishedResultAt: latestResult
        ? this.resultPublishedAt(latestResult)
        : null,
      announcements: authorizedAnnouncements,
      now,
    });

    return {
      generatedAt: now,
      guardian: {
        id: guardian.id,
        fullName:
          guardian.fullName ||
          [guardian.firstName, guardian.lastName].filter(Boolean).join(' '),
        avatarUrl: guardian.avatarUrl ?? null,
      },
      student: {
        id: student.id,
        fullName:
          student.fullName ||
          [student.firstName, student.lastName].filter(Boolean).join(' '),
        admissionNumber: student.admissionNumber,
        className: student.currentClass?.name ?? null,
        avatarUrl: student.passportPhotoUrl ?? null,
      },
      term: {
        id: term.id,
        name: term.name,
        sessionName: term.session?.name ?? null,
        startDate: this.formatDateOnly(term.startDate),
        endDate: this.formatDateOnly(term.endDate),
      },
      attendance: attendanceSummary
        ? {
            attendancePercentage: attendanceSummary.attendancePercentage,
            daysPresent: attendanceSummary.daysPresent,
            daysAbsent: attendanceSummary.daysAbsent,
            daysLate: attendanceSummary.daysLate,
            totalMarkedDays: attendanceSummary.totalMarkedDays,
          }
        : null,
      fees,
      result,
      timetable,
      announcements,
      attentionItems,
      sectionStates: this.buildSectionStates(
        checks,
        zonedTime.resolved,
        fees !== null,
      ),
    };
  };

  private loadContext = async (
    user: GuardianDashboardUser,
    studentId: string,
  ) => {
    const schoolId = user?.schoolId;
    if (!user?.sub || !schoolId || user.role !== UserRole.PARENT) {
      throw new ForbiddenException('Parent access is required');
    }
    const [guardian, student, link] = await Promise.all([
      this.userRepo.findOne({
        where: { id: user.sub, schoolId, role: UserRole.PARENT },
      }),
      this.studentRepo.findOne({
        where: { id: studentId, schoolId, isArchived: false },
        relations: ['currentClass'],
      }),
      this.studentParentRepo.findOne({
        where: { studentId, parentId: user.sub },
      }),
    ]);
    if (!guardian || !student || !link) {
      throw new ForbiddenException(
        'The selected student is not available to this guardian',
      );
    }
    return { guardian, student, schoolId };
  };

  private resolveTerm = async (
    termId: string | undefined,
    schoolId: string,
  ): Promise<Term> => {
    const term = termId
      ? await this.termsService.getTermById(termId, schoolId)
      : await this.termsService.getActiveTerm(schoolId);
    if (!term) throw new NotFoundException('Term not found');
    return term;
  };

  private assertPermission = async (
    guardianId: string,
    schoolId: string,
    studentId: string,
    resource: GuardianResource,
    critical = false,
  ): Promise<boolean> => {
    try {
      await this.enforcement.assertPermission(
        guardianId,
        schoolId,
        studentId,
        resource,
        GuardianAction.VIEW,
      );
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        if (critical) {
          throw new ForbiddenException(
            'You do not have access to this child profile',
          );
        }
        return false;
      }
      throw error;
    }
  };

  private optional = async <T>(
    enabled: boolean,
    loader: () => Promise<T>,
  ): Promise<T | null> => (enabled ? loader() : null);

  private buildSectionStates = (
    checks: Array<{ resource: DashboardSectionResource; allowed: boolean }>,
    timetableAvailable: boolean,
    feesAvailable: boolean,
  ): GuardianDashboardSectionState[] => [
    this.sectionState(SECTION_NAMES[GuardianResource.CHILD_PROFILE], true),
    ...checks.map(({ resource, allowed }) => {
      if (!allowed) {
        return this.sectionState(
          SECTION_NAMES[resource],
          false,
          true,
          PERMISSION_DENIED_REASON,
        );
      }
      if (resource === GuardianResource.TIMETABLE && !timetableAvailable) {
        return this.sectionState(
          SECTION_NAMES[resource],
          false,
          false,
          UNAVAILABLE_REASON,
        );
      }
      if (resource === GuardianResource.FEES && !feesAvailable) {
        return this.sectionState(
          SECTION_NAMES[resource],
          false,
          false,
          UNAVAILABLE_REASON,
        );
      }
      return this.sectionState(SECTION_NAMES[resource], true);
    }),
  ];

  private sectionState = (
    sectionName: string,
    available: boolean,
    permissionDenied = false,
    unavailableReason: string | null = null,
  ): GuardianDashboardSectionState => ({
    sectionName,
    available,
    permissionDenied,
    unavailableReason,
  });

  private resolveZonedTime = (
    timezone: string | null | undefined,
    now: Date,
  ): ZonedTime => {
    try {
      return { ...this.getZonedTime(timezone, now), resolved: true };
    } catch {
      return { ...this.getZonedTime(undefined, now), resolved: false };
    }
  };

  private getZonedTime = (
    timezone: string | null | undefined,
    now: Date,
  ): { dayOfWeek: number; minutes: number } => {
    const parts = new Intl.DateTimeFormat('en-US', {
      ...(timezone ? { timeZone: timezone } : {}),
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value ?? '';
    const dayOfWeek = WEEKDAYS[part('weekday')];
    const minutes = (Number(part('hour')) % 24) * 60 + Number(part('minute'));
    if (!dayOfWeek || !Number.isFinite(minutes)) {
      throw new Error('Unable to resolve school time');
    }
    return { dayOfWeek, minutes };
  };

  private mapTimetable = (
    entries: TimetableEntry[],
    zonedTime: ZonedTime,
  ): GuardianDashboardTimetableEntry[] =>
    entries
      .filter((entry) => entry.dayOfWeek === zonedTime.dayOfWeek)
      .slice()
      .sort((a, b) =>
        (a.period?.startTime ?? '').localeCompare(b.period?.startTime ?? ''),
      )
      .slice(0, 4)
      .map((entry) => {
        const start = this.parseTime(entry.period?.startTime);
        const end = this.parseTime(entry.period?.endTime);
        const status =
          zonedTime.resolved && start !== null && end !== null
            ? this.periodStatus(start, end, zonedTime.minutes)
            : null;
        return {
          id: entry.id,
          dayOfWeek: entry.dayOfWeek,
          subjectName: entry.subject?.name ?? '',
          teacherName:
            entry.teacher?.fullName ?? entry.teachers?.[0]?.fullName ?? null,
          startTime: entry.period?.startTime ?? '',
          endTime: entry.period?.endTime ?? '',
          status,
        };
      });

  private parseTime = (value: string | undefined): number | null => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  private periodStatus = (
    start: number,
    end: number,
    nowMinutes: number,
  ): GuardianDashboardTimetableStatus => {
    if (nowMinutes < start) {
      return GuardianDashboardTimetableStatus.UPCOMING;
    }
    if (nowMinutes > end) {
      return GuardianDashboardTimetableStatus.COMPLETED;
    }
    return GuardianDashboardTimetableStatus.CURRENT;
  };

  private latestPublishedResult = (
    results: StudentResult[],
  ): StudentResult | null =>
    results
      .filter((result) => result.resultSheet?.status === ResultStatus.PUBLISHED)
      .slice()
      .sort(
        (a, b) =>
          this.resultPublishedAt(b).getTime() -
          this.resultPublishedAt(a).getTime(),
      )[0] ?? null;

  private resultPublishedAt = (result: StudentResult): Date => {
    const sheet = result.resultSheet;
    const value = sheet?.approvedAt ?? sheet?.updatedAt ?? sheet?.createdAt;
    return value ? new Date(value) : new Date(0);
  };

  private mapResult = (result: StudentResult) => {
    const sheet = result.resultSheet;
    return {
      id: result.id,
      termName: sheet?.term?.name ?? null,
      sessionName: sheet?.term?.session?.name ?? null,
      percentage: result.percentage ?? null,
      grade: result.grade ?? null,
      position: result.position ?? null,
      publishedAt: this.toDate(
        sheet?.approvedAt ?? sheet?.updatedAt ?? sheet?.createdAt,
      ),
    };
  };

  private mapAnnouncement = (
    announcement: Announcement,
  ): GuardianDashboardAnnouncement => ({
    id: announcement.id,
    title: announcement.title,
    bodyPreview: this.bodyPreview(announcement.body),
    publishedAt: this.toDate(announcement.publishedAt),
    audience: announcement.audience,
  });

  private composeAttentionItems = (input: {
    fees: {
      totalAmount: number;
      totalPaid: number;
      outstandingBalance: number;
      paymentPercentage: number;
      status: unknown;
    } | null;
    pendingShares: PaymentSubmissionStudentShare[];
    result: ReturnType<GuardianDashboardService['mapResult']> | null;
    publishedResultAt: Date | null;
    announcements: Announcement[];
    now: Date;
  }): GuardianDashboardAttentionItem[] => {
    const items: GuardianDashboardAttentionItem[] = [];

    if (input.fees && input.fees.outstandingBalance > 0) {
      items.push({
        id: 'fees-outstanding',
        type: GuardianDashboardAttentionType.FEES,
        title: 'Outstanding fees',
        description: `Your active term balance is ${input.fees.outstandingBalance}.`,
        status: GuardianDashboardAttentionStatus.ACTION_REQUIRED,
        occurredAt: input.now,
        target: 'FEES',
        amount: input.fees.outstandingBalance,
      });
    }

    if (input.pendingShares.length > 0) {
      const amount = input.pendingShares.reduce(
        (sum, share) => sum + Number(share.amount ?? 0),
        0,
      );
      const occurredAt =
        input.pendingShares
          .map((share) => this.toDate(share.createdAt))
          .filter((date): date is Date => Boolean(date))
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
      items.push({
        id: 'pending-payment-submission',
        type: GuardianDashboardAttentionType.PAYMENT,
        title: 'Payment awaiting approval',
        description:
          input.pendingShares.length === 1
            ? 'A payment submission is awaiting approval.'
            : `${input.pendingShares.length} payment submissions are awaiting approval.`,
        status: GuardianDashboardAttentionStatus.PENDING,
        occurredAt,
        target: 'PAYMENT_HISTORY',
        amount,
      });
    }

    if (
      input.result &&
      input.publishedResultAt &&
      this.withinDays(input.publishedResultAt, input.now, 14)
    ) {
      items.push({
        id: `result-${input.result.id}`,
        type: GuardianDashboardAttentionType.RESULT,
        title: 'New result published',
        description: 'A published result is available to view.',
        status: GuardianDashboardAttentionStatus.INFO,
        occurredAt: input.publishedResultAt,
        target: 'RESULTS',
        amount: null,
      });
    }

    const recentAnnouncement = input.announcements.find((announcement) => {
      const publishedAt = this.toDate(announcement.publishedAt);
      return publishedAt && this.withinDays(publishedAt, input.now, 7);
    });
    if (recentAnnouncement) {
      items.push({
        id: `announcement-${recentAnnouncement.id}`,
        type: GuardianDashboardAttentionType.ANNOUNCEMENT,
        title: 'New school announcement',
        description: 'A new announcement is available to view.',
        status: GuardianDashboardAttentionStatus.INFO,
        occurredAt: this.toDate(recentAnnouncement.publishedAt),
        target: 'ANNOUNCEMENTS',
        amount: null,
      });
    }

    return Array.from(new Map(items.map((item) => [item.id, item])).values());
  };

  private withinDays = (date: Date, now: Date, days: number): boolean => {
    const diff = now.getTime() - date.getTime();
    return diff >= 0 && diff <= days * DAY_IN_MS;
  };

  private bodyPreview = (body: string): string => {
    const normalized = String(body ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized.length > 140
      ? `${normalized.slice(0, 137)}...`
      : normalized;
  };

  private toDate = (value: Date | string | null | undefined): Date | null =>
    value ? new Date(value) : null;

  private formatDateOnly = (value: Date | string): string => {
    const date = new Date(value);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
}

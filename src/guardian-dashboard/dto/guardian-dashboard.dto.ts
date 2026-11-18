import {
  Field,
  Float,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { AnnouncementAudience } from '../../communication/entities/announcement.entity';
import { InvoiceStatus } from '../../fees/entities/student-invoice.entity';

export enum GuardianDashboardAttentionType {
  FEES = 'FEES',
  PAYMENT = 'PAYMENT',
  RESULT = 'RESULT',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
}

export enum GuardianDashboardAttentionStatus {
  ACTION_REQUIRED = 'ACTION_REQUIRED',
  PENDING = 'PENDING',
  INFO = 'INFO',
}

export enum GuardianDashboardTimetableStatus {
  CURRENT = 'CURRENT',
  UPCOMING = 'UPCOMING',
  COMPLETED = 'COMPLETED',
}

registerEnumType(GuardianDashboardAttentionType, {
  name: 'GuardianDashboardAttentionType',
});
registerEnumType(GuardianDashboardAttentionStatus, {
  name: 'GuardianDashboardAttentionStatus',
});
registerEnumType(GuardianDashboardTimetableStatus, {
  name: 'GuardianDashboardTimetableStatus',
});

@ObjectType()
export class GuardianDashboardGuardian {
  @Field()
  id!: string;

  @Field()
  fullName!: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;
}

@ObjectType()
export class GuardianDashboardStudent {
  @Field()
  id!: string;

  @Field()
  fullName!: string;

  @Field()
  admissionNumber!: string;

  @Field(() => String, { nullable: true })
  className?: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;
}

@ObjectType()
export class GuardianDashboardTerm {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  sessionName?: string | null;

  @Field(() => String)
  startDate!: string;

  @Field(() => String)
  endDate!: string;
}

@ObjectType()
export class GuardianDashboardAttendance {
  @Field(() => Float)
  attendancePercentage!: number;

  @Field(() => Int)
  daysPresent!: number;

  @Field(() => Int)
  daysAbsent!: number;

  @Field(() => Int)
  daysLate!: number;

  @Field(() => Int)
  totalMarkedDays!: number;
}

@ObjectType()
export class GuardianDashboardFees {
  @Field(() => Int)
  totalAmount!: number;

  @Field(() => Int)
  totalPaid!: number;

  @Field(() => Int)
  outstandingBalance!: number;

  @Field(() => Float)
  paymentPercentage!: number;

  @Field(() => InvoiceStatus)
  status!: InvoiceStatus;
}

@ObjectType()
export class GuardianDashboardResult {
  @Field()
  id!: string;

  @Field(() => String, { nullable: true })
  termName?: string | null;

  @Field(() => String, { nullable: true })
  sessionName?: string | null;

  @Field(() => Float, { nullable: true })
  percentage?: number | null;

  @Field(() => String, { nullable: true })
  grade?: string | null;

  @Field(() => Int, { nullable: true })
  position?: number | null;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date | null;
}

@ObjectType()
export class GuardianDashboardTimetableEntry {
  @Field()
  id!: string;

  @Field(() => Int)
  dayOfWeek!: number;

  @Field()
  subjectName!: string;

  @Field(() => String, { nullable: true })
  teacherName?: string | null;

  @Field()
  startTime!: string;

  @Field()
  endTime!: string;

  @Field(() => GuardianDashboardTimetableStatus, { nullable: true })
  status?: GuardianDashboardTimetableStatus | null;
}

@ObjectType()
export class GuardianDashboardAnnouncement {
  @Field()
  id!: string;

  @Field()
  title!: string;

  @Field()
  bodyPreview!: string;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date | null;

  @Field(() => AnnouncementAudience)
  audience!: AnnouncementAudience;
}

@ObjectType()
export class GuardianDashboardAttentionItem {
  @Field()
  id!: string;

  @Field(() => GuardianDashboardAttentionType)
  type!: GuardianDashboardAttentionType;

  @Field()
  title!: string;

  @Field()
  description!: string;

  @Field(() => GuardianDashboardAttentionStatus)
  status!: GuardianDashboardAttentionStatus;

  @Field(() => Date, { nullable: true })
  occurredAt?: Date | null;

  @Field(() => String, { nullable: true })
  target?: string | null;

  @Field(() => Float, { nullable: true })
  amount?: number | null;
}

@ObjectType()
export class GuardianDashboardSectionState {
  @Field()
  sectionName!: string;

  @Field()
  available!: boolean;

  @Field()
  permissionDenied!: boolean;

  @Field(() => String, { nullable: true })
  unavailableReason?: string | null;
}

@ObjectType()
export class GuardianDashboard {
  @Field(() => Date)
  generatedAt!: Date;

  @Field(() => GuardianDashboardGuardian)
  guardian!: GuardianDashboardGuardian;

  @Field(() => GuardianDashboardStudent)
  student!: GuardianDashboardStudent;

  @Field(() => GuardianDashboardTerm)
  term!: GuardianDashboardTerm;

  @Field(() => GuardianDashboardAttendance, { nullable: true })
  attendance?: GuardianDashboardAttendance | null;

  @Field(() => GuardianDashboardFees, { nullable: true })
  fees?: GuardianDashboardFees | null;

  @Field(() => GuardianDashboardResult, { nullable: true })
  result?: GuardianDashboardResult | null;

  @Field(() => [GuardianDashboardTimetableEntry])
  timetable!: GuardianDashboardTimetableEntry[];

  @Field(() => [GuardianDashboardAnnouncement])
  announcements!: GuardianDashboardAnnouncement[];

  @Field(() => [GuardianDashboardAttentionItem])
  attentionItems!: GuardianDashboardAttentionItem[];

  @Field(() => [GuardianDashboardSectionState])
  sectionStates!: GuardianDashboardSectionState[];
}

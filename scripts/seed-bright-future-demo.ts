import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  AttendanceStatus,
  Gender,
  GradingSystem,
  ResultStatus,
  ScoreComponent,
  StudentStatus,
  UserRole,
} from '../src/common/enums';
import { School } from '../src/schools/entities/school.entity';
import { User } from '../src/users/entities/user.entity';
import { ClassEntity } from '../src/classes/entities/class.entity';
import { Subject } from '../src/subjects/entities/subject.entity';
import { Student } from '../src/students/entities/student.entity';
import { StudentParent } from '../src/students/entities/student-parent.entity';
import {
  FeeCategory,
  FeeRecurrence,
} from '../src/fees/entities/fee-category.entity';
import { FeeStructure } from '../src/fees/entities/fee-structure.entity';
import { StudentInvoice } from '../src/fees/entities/student-invoice.entity';
import { PaymentSubmissionStudentShare } from '../src/fees/entities/payment-submission-student-share.entity';
import { Receipt } from '../src/fees/entities/receipt.entity';
import { SchoolBankAccount } from '../src/fees/entities/school-bank-account.entity';
import { ResultSheet } from '../src/results/entities/result-sheet.entity';
import { StudentResult } from '../src/results/entities/student-result.entity';
import { SubjectScore } from '../src/results/entities/subject-score.entity';
import { TimetableEntry } from '../src/timetable/entities/timetable-entry.entity';
import { Room } from '../src/timetable/entities/room.entity';
import { Period } from '../src/timetable/entities/period.entity';
import {
  Announcement,
  AnnouncementAudience,
  AnnouncementStatus,
} from '../src/communication/entities/announcement.entity';
import { GuardianAccessException } from '../src/guardian-access/entities/guardian-access-exception.entity';
import { GuardianAccessPolicy } from '../src/guardian-access/entities/guardian-access-policy.entity';
import {
  GuardianAction,
  GuardianResource,
} from '../src/guardian-access/enums/guardian-permission.enums';
import {
  GuardianEffect,
  GuardianPolicyScope,
} from '../src/guardian-access/enums/guardian-policy.enums';
import { ExpenseCategory } from '../src/expenses/entities/expense-category.entity';
import { ExpenseDepartment } from '../src/expenses/entities/expense-department.entity';
import { ExpenseVendor } from '../src/expenses/entities/expense-vendor.entity';
import { Expense } from '../src/expenses/entities/expense.entity';
import { RecurringExpense } from '../src/expenses/entities/recurring-expense.entity';
import { RecurringFrequency } from '../src/expenses/enums/recurring-frequency.enum';
import {
  ExpensePaymentMethod,
  ExpensePaymentStatus,
} from '../src/expenses/enums';
import { AuthService } from '../src/auth/auth.service';
import { SchoolsService } from '../src/schools/schools.service';
import { UsersService } from '../src/users/users.service';
import { TermsService } from '../src/terms/terms.service';
import { ClassesService } from '../src/classes/classes.service';
import { SubjectsService } from '../src/subjects/subjects.service';
import { StudentsService } from '../src/students/students.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import { FeesService } from '../src/fees/fees.service';
import { ResultsService } from '../src/results/results.service';
import { ResultTemplatesService } from '../src/results/result-templates.service';
import { TimetableService } from '../src/timetable/services/timetable.service';
import { CommunicationService } from '../src/communication/communication.service';
import { GuardianPolicyManagementService } from '../src/guardian-access/services/guardian-policy-management.service';
import { GuardianExceptionService } from '../src/guardian-access/services/guardian-exception.service';
import { ExpensesService } from '../src/expenses/services/expenses.service';
import { ExpenseBudgetsService } from '../src/expenses/services/expense-budgets.service';
import { ExpenseVendorsService } from '../src/expenses/services/expense-vendors.service';
import { ExpenseRequestsService } from '../src/expenses/services/expense-requests.service';
import { ExpenseRecurringService } from '../src/expenses/services/expense-recurring.service';
import { PettyCashService } from '../src/expenses/services/petty-cash.service';
import { IdCardsService } from '../src/id-cards/id-cards.service';

const DEMO = {
  schoolName: 'Bright Future International School',
  schoolCode: 'BFIS-DEMO',
  email: 'info@bfisdemo.schoolright.com.ng',
  phone: '+2348020000001',
  address: '12 Unity Road, Tanke, Ilorin, Kwara State, Nigeria',
  state: 'Kwara',
  country: 'Nigeria',
  timezone: 'Africa/Lagos',
  schoolType: 'combined',
  schoolStartTime: '08:00',
  schoolCapacity: '1500',
  resultColor: '#2563EB',
  defaultReportTemplate: 'BFIS Official Report Card',
  sessionName: '2026/2027',
  firstTerm: 'First Term',
  secondTerm: 'Second Term',
  thirdTerm: 'Third Term',
  termStart: '2026-09-14',
  termEnd: '2026-12-18',
  demoNote: 'BFIS demo data - SchoolRight sales demonstration',
  password: 'DemoAdmin@2026',
  principalPassword: 'DemoPrincipal@2026',
  staffPassword: 'DemoStaff@2026',
  parentPassword: 'DemoParent@2026',
};
const DOMAIN = 'bfisdemo.schoolright.com.ng';
const email = (local: string) => `${local}@${DOMAIN}`;
const phone = (n: number) => `0802${String(1000000 + n).slice(-7)}`;

const adminUser = { sub: '', role: UserRole.SCHOOL_ADMIN, schoolId: '' } as any;

const log = (...args: unknown[]) => console.log('[BFIS SEED]', ...args);
const hash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
const dateISO = (value: string) => `${value}T00:00:00.000Z`;
const toNaira = (naira: number) => Math.round(naira);
const nairaToKobo = toNaira;
const weekdays = (startISO: string, endISO: string) => {
  const dates: string[] = [];
  const current = new Date(startISO);
  const end = new Date(endISO);
  while (current <= end) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
};

const maleNames = [
  'Adeolu',
  'Adebayo',
  'Chukwuma',
  'Emeka',
  'Tobiloba',
  'Olawale',
  'Ibrahim',
  'Musa',
  'Yusuf',
  'Daniel',
  'Samuel',
  'Joshua',
  'David',
  'Emmanuel',
  'Chidi',
  'Obinna',
  'Ifeanyi',
  'Segun',
  'Femi',
  'Bayo',
  'Kelechi',
  'Uche',
  'Nnamdi',
  'Abdullahi',
  'Sadiq',
  'Tunde',
  'Bamidele',
  'Ayodeji',
  'Victor',
  'Peter',
  'Olamide',
  'Seyi',
];
const femaleNames = [
  'Adebukola',
  'Folake',
  'Ngozi',
  'Chioma',
  'Adaeze',
  'Zainab',
  'Aisha',
  'Fatima',
  'Grace',
  'Mercy',
  'Blessing',
  'Chiamaka',
  'Ifeoma',
  'Tolulope',
  'Bukola',
  'Yewande',
  'Funmilayo',
  'Halima',
  'Hauwa',
  'Deborah',
  'Esther',
  'Ruth',
  'Peace',
  'Amaka',
  'Nkechi',
  'Simisola',
  'Oluwaseun',
  'Titilayo',
  'Maryam',
  'Amina',
  'Cecilia',
  'Temitope',
];
const surnames = [
  'Ogunleye',
  'Adeyemi',
  'Balogun',
  'Ojo',
  'Afolabi',
  'Oke',
  'Olawale',
  'Ibrahim',
  'Bello',
  'Musa',
  'Yusuf',
  'Adebayo',
  'Chukwu',
  'Okafor',
  'Eze',
  'Nwosu',
  'Obi',
  'Adekunle',
  'Alabi',
  'Lawal',
  'Sanni',
  'Garba',
  'Abdullahi',
  'Ogunwale',
  'Fashola',
  'Ashafa',
  'Agbaje',
  'Oloruntoba',
  'Oladele',
  'Bakare',
  'Onyeka',
  'Danladi',
  'Yakubu',
];
const lgAs = [
  'Ilorin West',
  'Ilorin South',
  'Ilorin East',
  'Moro',
  'Asa',
  'Ifedayo',
  'Patigi',
  'Edu',
  'Kaiama',
  'Baruten',
];
const states = [
  'Kwara',
  'Kogi',
  'Osun',
  'Oyo',
  'Ogun',
  'Lagos',
  'FCT',
  'Niger',
  'Ekiti',
  'Kaduna',
];

const classesPlan = [
  { name: 'JSS 1 - A', count: 15, level: 'junior' as const },
  { name: 'JSS 1 - B', count: 14, level: 'junior' as const },
  { name: 'JSS 2 - A', count: 14, level: 'junior' as const },
  { name: 'JSS 2 - B', count: 13, level: 'junior' as const },
  { name: 'JSS 3 - A', count: 13, level: 'junior' as const },
  { name: 'SS 1 - A', count: 14, level: 'senior' as const },
  { name: 'SS 1 - B', count: 13, level: 'senior' as const },
  { name: 'SS 2 - A', count: 12, level: 'senior' as const },
  { name: 'SS 3 - A', count: 12, level: 'senior' as const },
];

const juniorSubjects = [
  'English Language',
  'Mathematics',
  'Basic Science',
  'Social Studies',
  'Civic Education',
  'French Language',
  'Computer Studies',
  'Physical and Health Education',
  'Agricultural Science',
  'Home Economics',
  'Fine Art',
];
const seniorSubjects = [
  'English Language',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Economics',
  'Financial Accounting',
  'Government',
  'Geography',
  'Literature in English',
  'Computer Studies',
  'Physical and Health Education',
];

const teacherPlan = [
  {
    first: 'Mrs. Adebola',
    last: 'Ogunleye',
    role: UserRole.CLASS_TEACHER,
    subject: 'English Language',
  },
  {
    first: 'Mr. Chukwuemeka',
    last: 'Okafor',
    role: UserRole.CLASS_TEACHER,
    subject: 'Mathematics',
  },
  {
    first: 'Mrs. Ngozi',
    last: 'Eze',
    role: UserRole.CLASS_TEACHER,
    subject: 'Basic Science',
  },
  {
    first: 'Mr. Sulaimon',
    last: 'Bello',
    role: UserRole.CLASS_TEACHER,
    subject: 'Social Studies',
  },
  {
    first: 'Mrs. Fatima',
    last: 'Musa',
    role: UserRole.CLASS_TEACHER,
    subject: 'English Language',
  },
  {
    first: 'Mr. Tobi',
    last: 'Adeyemi',
    role: UserRole.CLASS_TEACHER,
    subject: 'Mathematics',
  },
  {
    first: 'Mrs. Bukola',
    last: 'Balogun',
    role: UserRole.CLASS_TEACHER,
    subject: 'Biology',
  },
  {
    first: 'Mr. Kelechi',
    last: 'Nwosu',
    role: UserRole.CLASS_TEACHER,
    subject: 'Economics',
  },
  {
    first: 'Mrs. Yewande',
    last: 'Fashola',
    role: UserRole.CLASS_TEACHER,
    subject: 'Government',
  },
  {
    first: 'Mr. Segun',
    last: 'Alabi',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Physics',
  },
  {
    first: 'Mrs. Halima',
    last: 'Garba',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Chemistry',
  },
  {
    first: 'Mr. Ifeanyi',
    last: 'Obi',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Financial Accounting',
  },
  {
    first: 'Mrs. Mercy',
    last: 'Ojo',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Literature in English',
  },
  {
    first: 'Mr. Abdullahi',
    last: 'Sanni',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Geography',
  },
  {
    first: 'Mrs. Simisola',
    last: 'Afolabi',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'French Language',
  },
  {
    first: 'Mr. Uche',
    last: 'Chukwu',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Computer Studies',
  },
  {
    first: 'Mrs. Deborah',
    last: 'Oladele',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Fine Art',
  },
  {
    first: 'Mr. Chidi',
    last: 'Agbaje',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Agricultural Science',
  },
  {
    first: 'Mrs. Amina',
    last: 'Yakubu',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Home Economics',
  },
  {
    first: 'Mr. Victor',
    last: 'Danladi',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Civic Education',
  },
  {
    first: 'Mrs. Blessing',
    last: 'Onyeka',
    role: UserRole.SUBJECT_TEACHER,
    subject: 'Physical and Health Education',
  },
];

export async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const ds = app.get(DataSource);
  const repo = <T extends ObjectLiteral>(
    entity: EntityTarget<T>,
  ): Repository<T> =>
    ds.getRepository(entity as EntityTarget<ObjectLiteral>) as Repository<T>;

  const schoolsService = app.get(SchoolsService);
  const usersService = app.get(UsersService);
  const termsService = app.get(TermsService);
  const classesService = app.get(ClassesService);
  const subjectsService = app.get(SubjectsService);
  const studentsService = app.get(StudentsService);
  const attendanceService = app.get(AttendanceService);
  const feesService = app.get(FeesService);
  const resultsService = app.get(ResultsService);
  const resultTemplatesService = app.get(ResultTemplatesService);
  const timetableService = app.get(TimetableService);
  const communicationService = app.get(CommunicationService);
  const policyService = app.get(GuardianPolicyManagementService);
  const exceptionService = app.get(GuardianExceptionService);
  const expensesService = app.get(ExpensesService);
  const expenseBudgetsService = app.get(ExpenseBudgetsService);
  const expenseVendorsService = app.get(ExpenseVendorsService);
  const expenseRequestsService = app.get(ExpenseRequestsService);
  const expenseRecurringService = app.get(ExpenseRecurringService);
  const pettyCashService = app.get(PettyCashService);
  const idCardsService = app.get(IdCardsService);
  const authService = app.get(AuthService);

  const summary: Record<string, any> = {};

  try {
    log('Starting Bright Future International School demo seed');

    let school = await repo(School).findOne({
      where: { schoolCode: DEMO.schoolCode },
    });
    if (!school) {
      school = await schoolsService.createSchool({
        name: DEMO.schoolName,
        schoolCode: DEMO.schoolCode,
        email: DEMO.email,
        phone: DEMO.phone,
        address: DEMO.address,
        schoolType: DEMO.schoolType,
        schoolStartTime: DEMO.schoolStartTime,
        resultColor: DEMO.resultColor,
        defaultReportTemplate: DEMO.defaultReportTemplate,
      } as any);
      await repo(School).update(school.id, {
        state: DEMO.state,
        country: DEMO.country,
        timezone: DEMO.timezone,
        schoolCapacity: DEMO.schoolCapacity,
        whatsappNumber: DEMO.phone,
        contactPersonName: 'Dr. Adebayo Ogunleye',
        contactPersonRole: 'School Administrator',
      } as any);
      await schoolsService.activateSchool(school.id);
      log('Created school', school.id);
    } else {
      log('Reusing existing demo school', school.id);
    }
    const schoolId = school.id;
    adminUser.schoolId = schoolId;

    const ensureUser = async (
      local: string,
      firstName: string,
      lastName: string,
      role: UserRole,
      password: string,
    ) => {
      const userEmail = email(local);
      const existing = await repo(User).findOne({
        where: { email: userEmail },
      });
      if (existing) {
        if (existing.schoolId !== schoolId)
          throw new Error(`Email ${userEmail} belongs to another school`);
        return existing;
      }
      const created = await usersService.createUser(
        {
          email: userEmail,
          firstName,
          lastName,
          password,
          phone: phone((hash(local) % 9000000) + 1000000),
          role,
          schoolId,
        } as any,
        schoolId,
      );
      return created;
    };

    const admin = await ensureUser(
      'admin',
      'Adebayo',
      'Ogunleye',
      UserRole.SCHOOL_ADMIN,
      DEMO.password,
    );
    const principal = await ensureUser(
      'principal',
      'Ngozi',
      'Adeyemi',
      UserRole.PRINCIPAL,
      DEMO.principalPassword,
    );
    await ensureUser(
      'vice-principal',
      'Musa',
      'Bello',
      UserRole.VICE_PRINCIPAL,
      DEMO.staffPassword,
    );
    await ensureUser(
      'head-teacher',
      'Fatima',
      'Okafor',
      UserRole.HEAD_TEACHER,
      DEMO.staffPassword,
    );
    const bursar1 = await ensureUser(
      'bursar1',
      'Halima',
      'Garba',
      UserRole.BURSAR,
      DEMO.staffPassword,
    );
    await ensureUser(
      'bursar2',
      'Seyi',
      'Balogun',
      UserRole.BURSAR,
      DEMO.staffPassword,
    );
    adminUser.sub = admin.id;
    summary.users = {
      admin: admin.email,
      principal: principal.email,
      bursar: bursar1.email,
    };

    const loginCheck = await authService.login({
      email: admin.email,
      password: DEMO.password,
    } as any);
    if (!loginCheck?.accessToken)
      throw new Error('Demo admin login validation failed');
    summary.auth = 'Demo admin login validated via AuthService';

    const sessionRepo = ds.getRepository('Session') as Repository<any>;
    let session = await sessionRepo.findOne({
      where: { schoolId, name: DEMO.sessionName },
    });
    if (!session) {
      session = await termsService.createSession(
        { name: DEMO.sessionName } as any,
        schoolId,
      );
      log('Created session', session.id);
    }
    const termRepo = ds.getRepository('Term') as Repository<any>;
    const termIds: string[] = [];
    const termPlan = [
      { name: DEMO.firstTerm, start: '2026-09-14', end: '2026-12-18' },
      { name: DEMO.secondTerm, start: '2027-01-11', end: '2027-04-02' },
      { name: DEMO.thirdTerm, start: '2027-04-19', end: '2027-07-09' },
    ];
    for (const plan of termPlan) {
      let term = await termRepo.findOne({
        where: { schoolId, sessionId: session.id, name: plan.name },
      });
      if (!term) {
        term = await termsService.createTerm(
          {
            name: plan.name,
            sessionId: session.id,
            startDate: dateISO(plan.start),
            endDate: dateISO(plan.end),
          } as any,
          schoolId,
        );
      }
      termIds.push(term.id);
    }
    const firstTermId = termIds[0];
    await termsService.activateTerm(firstTermId, schoolId);
    summary.terms = { session: session.id, firstTermId, count: termIds.length };

    const classEntities: Array<{
      id: string;
      name: string;
      level: 'junior' | 'senior';
      count: number;
    }> = [];
    for (const plan of classesPlan) {
      let cls = await repo(ClassEntity).findOne({
        where: { schoolId, name: plan.name },
      });
      if (!cls)
        cls = await classesService.createClass(
          { name: plan.name } as any,
          schoolId,
        );
      classEntities.push({
        id: cls.id,
        name: cls.name,
        level: plan.level,
        count: plan.count,
      });
    }

    const allSubjectNames = Array.from(
      new Set([...juniorSubjects, ...seniorSubjects]),
    );
    const subjects: Subject[] = [];
    for (
      let subjectIndex = 0;
      subjectIndex < allSubjectNames.length;
      subjectIndex += 1
    ) {
      const name = allSubjectNames[subjectIndex];
      let subject = await repo(Subject).findOne({ where: { schoolId, name } });
      if (!subject) {
        const code = `BFIS-${String(subjectIndex + 1).padStart(3, '0')}`;
        subject = await subjectsService.createSubject(name, schoolId, code);
      }
      subjects.push(subject);
    }
    const subjectByName = new Map(subjects.map((s) => [s.name, s]));
    summary.academics = {
      classes: classEntities.length,
      subjects: subjects.length,
    };

    const teachers: User[] = [];
    for (let i = 0; i < teacherPlan.length; i += 1) {
      const t = teacherPlan[i];
      const teacher = await ensureUser(
        `teacher${String(i + 1).padStart(2, '0')}`,
        t.first,
        t.last,
        t.role,
        DEMO.staffPassword,
      );
      teachers.push(teacher);
      if (i < classesPlan.length)
        await classesService.assignClassTeacher(
          classEntities[i].id,
          teacher.id,
          schoolId,
        );
    }
    for (let i = 0; i < classEntities.length; i += 1) {
      const cls = classEntities[i];
      const names = cls.level === 'junior' ? juniorSubjects : seniorSubjects;
      const subjectIds = names.map((n) => subjectByName.get(n)!.id);
      await classesService.assignSubjectsToClass(cls.id, subjectIds, schoolId);
      for (const name of names) {
        const subj = subjectByName.get(name)!;
        const pool = teachers.filter((t) => {
          const plan = teacherPlan[teachers.findIndex((x) => x.id === t.id)];
          return plan?.subject === name;
        });
        const chosen = pool.length
          ? pool[hash(`${cls.id}:${name}`) % pool.length]
          : teachers[hash(`${cls.id}:${name}`) % teachers.length];
        await classesService.assignSubjectTeacher(
          cls.id,
          subj.id,
          chosen.id,
          schoolId,
        );
      }
    }
    summary.teachers = teachers.length;

    const parentCount = 40;
    const parents: User[] = [];
    for (let i = 0; i < parentCount; i += 1) {
      const first =
        i % 2 === 0
          ? maleNames[(i * 3) % maleNames.length]
          : femaleNames[(i * 3) % femaleNames.length];
      const last = surnames[(i * 5) % surnames.length];
      parents.push(
        await ensureUser(
          `parent${String(i + 1).padStart(2, '0')}`,
          first,
          last,
          UserRole.PARENT,
          DEMO.parentPassword,
        ),
      );
    }
    summary.parents = parents.length;

    const students: Student[] = [];
    const studentRepo = repo(Student);
    let studentIndex = 0;
    for (const cls of classEntities) {
      for (let j = 0; j < cls.count; j += 1) {
        const i = studentIndex;
        const isMale = i % 2 === 0;
        const first = isMale
          ? maleNames[(i * 7) % maleNames.length]
          : femaleNames[(i * 7) % femaleNames.length];
        const last = surnames[(i * 11) % surnames.length];
        const middle =
          i % 3 === 0 ? (isMale ? 'Oluwasegun' : 'Chinelo') : undefined;
        const dobYear =
          cls.level === 'junior' ? 2011 + (i % 3) : 2008 + (i % 3);
        const dob = `${dobYear}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`;
        const parent = parents[Math.floor(i / 3) % parents.length];
        const studentNote = `${DEMO.demoNote} | BFIS-STU-${String(i + 1).padStart(3, '0')}`;
        let student = await studentRepo.findOne({
          where: { schoolId, notes: studentNote },
        });
        if (!student) {
          student = await studentsService.createStudent(
            {
              firstName: first,
              middleName: middle,
              lastName: last,
              dateOfBirth: dob,
              gender: isMale ? Gender.MALE : Gender.FEMALE,
              nationality: 'Nigerian',
              stateOfOrigin: states[i % states.length],
              lga: lgAs[i % lgAs.length],
              status: StudentStatus.ACTIVE,
              dateOfAdmission: DEMO.termStart,
              classId: cls.id,
              admissionClassId: cls.id,
              address: `${(i % 90) + 1} ${['Unity', 'Stadium', 'Government', 'Challenge', 'Sangotedo'][i % 5]} Road, Ilorin, Kwara State`,
              medicalInfo:
                i % 17 === 0
                  ? 'Mild asthma; inhaler kept in school clinic'
                  : 'No known allergies',
              notes: studentNote,
              guardians: [
                {
                  name: `${parent.firstName} ${parent.lastName}`,
                  email: parent.email,
                  phone: parent.phone || phone(i + 100),
                  relationship: isMale ? 'Father' : 'Mother',
                  address: `${(i % 90) + 1} Unity Road, Ilorin`,
                  occupation: i % 3 === 0 ? 'Trader' : 'Civil Servant',
                },
              ],
            } as any,
            schoolId,
          );
        }
        const existingLink = await repo(StudentParent).findOne({
          where: { studentId: student.id, parentId: parent.id },
        });
        if (!existingLink)
          await studentsService.linkParent(student.id, parent.id, schoolId);
        students.push(student);
        studentIndex += 1;
      }
    }
    summary.students = students.length;

    const attendanceDates = weekdays(DEMO.termStart, '2026-10-09');
    let attendanceRecords = 0;
    for (let d = 0; d < attendanceDates.length; d += 1) {
      const date = attendanceDates[d];
      for (const cls of classEntities) {
        const classStudents = students.slice(
          classEntities
            .slice(0, classEntities.indexOf(cls))
            .reduce((sum, c) => sum + c.count, 0),
          classEntities
            .slice(0, classEntities.indexOf(cls) + 1)
            .reduce((sum, c) => sum + c.count, 0),
        );
        const records = classStudents.map((student, idx) => {
          const h = hash(`${student.id}:${date}`) % 100;
          const status =
            h >= 94
              ? AttendanceStatus.ABSENT
              : h >= 88
                ? AttendanceStatus.LATE
                : AttendanceStatus.PRESENT;
          return {
            studentId: student.id,
            status,
            remark:
              status === AttendanceStatus.LATE
                ? 'Arrived after assembly'
                : undefined,
          };
        });
        await attendanceService.markStudentAttendance(
          { classId: cls.id, date, records } as any,
          admin.id,
          schoolId,
        );
        attendanceRecords += records.length;
      }
    }
    summary.attendance = {
      days: attendanceDates.length,
      records: attendanceRecords,
    };

    const feeCategoryPlan = [
      {
        name: 'Tuition Fee',
        recurrence: FeeRecurrence.PER_TERM,
        junior: 85000,
        senior: 95000,
      },
      {
        name: 'Development Levy',
        recurrence: FeeRecurrence.PER_SESSION,
        junior: 15000,
        senior: 18000,
      },
      {
        name: 'Examination Fee',
        recurrence: FeeRecurrence.PER_TERM,
        junior: 8000,
        senior: 10000,
      },
      {
        name: 'PTA Levy',
        recurrence: FeeRecurrence.PER_SESSION,
        junior: 5000,
        senior: 5000,
      },
      {
        name: 'Textbook Fee',
        recurrence: FeeRecurrence.PER_SESSION,
        junior: 12000,
        senior: 15000,
      },
      {
        name: 'ICT Fee',
        recurrence: FeeRecurrence.PER_TERM,
        junior: 7500,
        senior: 9000,
      },
      {
        name: 'Laboratory Fee',
        recurrence: FeeRecurrence.PER_TERM,
        junior: 5000,
        senior: 10000,
      },
    ];
    const feeCategories: FeeCategory[] = [];
    for (const plan of feeCategoryPlan) {
      let category = await repo(FeeCategory).findOne({
        where: { schoolId, name: plan.name },
      });
      if (!category)
        category = await feesService.createFeeCategory(
          { name: plan.name, recurrence: plan.recurrence } as any,
          schoolId,
          admin.id,
        );
      feeCategories.push(category);
      for (const cls of classEntities) {
        const existingStructure = await repo(FeeStructure).findOne({
          where: {
            schoolId,
            classId: cls.id,
            feeCategoryId: category.id,
            sessionId: session.id,
            termId: firstTermId,
          },
        });
        if (!existingStructure) {
          await feesService.createFeeStructure(
            {
              feeCategoryId: category.id,
              classId: cls.id,
              sessionId: session.id,
              termId: firstTermId,
              amount: nairaToKobo(
                cls.level === 'junior' ? plan.junior : plan.senior,
              ),
            } as any,
            schoolId,
            admin.id,
          );
        }
      }
    }
    const invoiceResult = await feesService.generateInvoices(
      {
        sessionId: session.id,
        termId: firstTermId,
        forceRegenerate: false,
      } as any,
      schoolId,
    );
    summary.fees = {
      categories: feeCategories.length,
      invoicesGenerated: invoiceResult.generated,
      invoicesSkipped: invoiceResult.skipped,
    };

    let bankAccount = await repo(SchoolBankAccount).findOne({
      where: { schoolId, accountNumber: '0123456789' },
    });
    if (!bankAccount) {
      bankAccount = await feesService.createBankAccount(
        {
          bankName: 'GTBank',
          accountNumber: '0123456789',
          accountName: DEMO.schoolName,
        } as any,
        schoolId,
        admin.id,
      );
    }
    const shareRepo = repo(PaymentSubmissionStudentShare);
    let payments = 0;
    for (let i = 0; i < students.length; i += 1) {
      const student = students[i];
      const bucket = i % 8;
      if (bucket >= 4) continue;
      const invoice = await repo(StudentInvoice).findOne({
        where: { schoolId, studentId: student.id, termId: firstTermId },
      });
      if (!invoice) continue;
      const total = Number(invoice.totalAmount || 0);
      const ratio = bucket <= 2 ? 1 : 0.5 + (i % 3) * 0.1;
      const amount = Math.round(total * ratio);
      const note = `BFIS demo offline payment - ${student.id}`;
      const alreadyPaid = await shareRepo
        .createQueryBuilder('share')
        .innerJoin('share.batch', 'batch')
        .where('share.studentId = :studentId', { studentId: student.id })
        .andWhere('batch.note = :note', { note })
        .getCount();
      if (alreadyPaid > 0) continue;
      await feesService.recordOfflinePayment(
        {
          studentId: student.id,
          amount,
          paymentMethod: bucket === 0 ? 'BANK_TRANSFER' : 'CASH',
          bankAccountId: bankAccount.id,
          note,
          paidAt: new Date(Date.UTC(2026, 8, 20 + (i % 15))).toISOString(),
          reference: `BFIS-DEMO-PAY-${String(i + 1).padStart(3, '0')}`,
        } as any,
        admin.id,
        schoolId,
      );
      payments += 1;
    }
    summary.fees.paymentsRecorded = payments;
    summary.fees.receipts = await repo(Receipt)
      .createQueryBuilder('receipt')
      .innerJoin(
        PaymentSubmissionStudentShare,
        'share',
        'share.id = receipt.studentShareId',
      )
      .where('share.studentId IN (:...studentIds)', {
        studentIds: students.map((s) => s.id),
      })
      .getCount();

    await resultTemplatesService.ensureDefaultTemplateExists(schoolId);
    const templateCount = await ds
      .getRepository('ResultTemplate')
      .count({ where: { schoolId } });
    if (templateCount < 2) {
      await resultTemplatesService.createTemplate(
        {
          name: 'BFIS First Term Report',
          description: 'Branded report card for the 2026/2027 First Term',
          isDefault: false,
        } as any,
        schoolId,
      );
    }

    let resultsCount = 0;
    for (const cls of classEntities) {
      let sheet = await repo(ResultSheet).findOne({
        where: { schoolId, classId: cls.id, termId: firstTermId },
      });
      const components = [
        { component: ScoreComponent.CA1, maxScore: 20 },
        { component: ScoreComponent.CA2, maxScore: 20 },
        { component: ScoreComponent.PROJECT, maxScore: 10 },
        { component: ScoreComponent.EXAM, maxScore: 50 },
      ];
      if (!sheet) {
        sheet = await resultsService.createResultSheet(
          {
            classId: cls.id,
            termId: firstTermId,
            gradingSystem: GradingSystem.NIGERIAN_BASIC,
            scoreComponents: components,
          } as any,
          admin.id,
          schoolId,
        );
      }
      const totalScores = await repo(SubjectScore).count({
        where: { resultSheetId: sheet.id },
      });
      const submittedScores = await repo(SubjectScore).count({
        where: { resultSheetId: sheet.id, isSubmitted: true },
      });
      if (submittedScores < totalScores) {
        const classStudents = students.slice(
          classEntities
            .slice(0, classEntities.indexOf(cls))
            .reduce((sum, c) => sum + c.count, 0),
          classEntities
            .slice(0, classEntities.indexOf(cls) + 1)
            .reduce((sum, c) => sum + c.count, 0),
        );
        const names = cls.level === 'junior' ? juniorSubjects : seniorSubjects;
        for (const name of names) {
          const subject = subjectByName.get(name)!;
          const scores = classStudents.map((student, idx) => {
            const target = clamp(
              48 + (hash(`${student.id}:${name}`) % 52) - 8 + (idx % 5),
              25,
              98,
            );
            const ca1 = Math.round(target * 0.2);
            const ca2 = Math.round(target * 0.2);
            const project = Math.round(target * 0.1);
            const exam = target - ca1 - ca2 - project;
            return {
              studentId: student.id,
              componentScores: [
                { component: ScoreComponent.CA1, score: ca1 },
                { component: ScoreComponent.CA2, score: ca2 },
                { component: ScoreComponent.PROJECT, score: project },
                { component: ScoreComponent.EXAM, score: exam },
              ],
            };
          });
          await resultsService.saveAdminScores(
            {
              resultSheetId: sheet.id,
              subjectId: subject.id,
              scores,
              submit: true,
            } as any,
            admin.id,
            schoolId,
          );
        }
        const studentResults = await repo(StudentResult).find({
          where: { schoolId, resultSheetId: sheet.id },
        });
        for (const result of studentResults) {
          const avg = Number(result.totalScore || 0);
          const principalRemark =
            avg >= 75
              ? 'An excellent term. Keep up the outstanding discipline and academic focus.'
              : avg >= 60
                ? 'A very good term. Continue to strengthen your study habits.'
                : avg >= 50
                  ? 'Satisfactory progress. More consistent practice will improve your results.'
                  : 'Needs improvement. Please work closely with your subject teachers next term.';
          const classRemark =
            avg >= 70
              ? 'A commendable performance across the term.'
              : 'Steady progress with room for improvement.';
          await resultsService.savePrincipalRemark(
            result.id,
            principalRemark,
            schoolId,
          );
          await resultsService.saveClassTeacherRemark(
            result.id,
            classRemark,
            admin.id,
            schoolId,
          );
        }
      }
      const freshSheet = await repo(ResultSheet).findOne({
        where: { id: sheet.id },
      });
      if (freshSheet?.status !== ResultStatus.PUBLISHED) {
        await resultsService.publishResultSheet(sheet.id, admin.id, schoolId);
      }
      resultsCount += 1;
    }
    summary.results = {
      publishedSheets: resultsCount,
      studentResults: await repo(StudentResult).count({ where: { schoolId } }),
    };

    await timetableService.initDefaultSchoolDays(schoolId);
    await timetableService.initDefaultPeriods(schoolId);
    const periods = await repo(Period).find({
      where: { schoolId, isActive: true },
      order: { orderIndex: 'ASC' },
    });
    for (let i = 0; i < 9; i += 1) {
      const name = `Room ${String.fromCharCode(65 + i)}`;
      let room = await repo(Room).findOne({ where: { schoolId, name } });
      if (!room)
        room = await timetableService.createRoom(
          { name, capacity: 40, type: 'CLASSROOM' } as any,
          schoolId,
        );
    }
    const periodPool = periods.slice(0, 6);
    let timetableEntries = 0;
    for (let day = 1; day <= 5; day += 1) {
      for (let p = 0; p < periodPool.length; p += 1) {
        const period = periodPool[p];
        for (let c = 0; c < classEntities.length; c += 1) {
          const cls = classEntities[c];
          const names =
            cls.level === 'junior' ? juniorSubjects : seniorSubjects;
          const subjectName = names[(c + p + day) % names.length];
          const subject = subjectByName.get(subjectName)!;
          const roomName = `Room ${String.fromCharCode(65 + c)}`;
          const room = await repo(Room).findOne({
            where: { schoolId, name: roomName },
          });
          const teacher = teachers[(day * 11 + p * 7 + c) % teachers.length];
          const existing = await repo(TimetableEntry).findOne({
            where: {
              schoolId,
              termId: firstTermId,
              classId: cls.id,
              dayOfWeek: day,
              periodId: period.id,
              subjectId: subject.id,
            },
          });
          if (existing) continue;
          try {
            await timetableService.createTimetableEntry(
              {
                classId: cls.id,
                termId: firstTermId,
                dayOfWeek: day,
                periodId: period.id,
                subjectId: subject.id,
                teacherId: teacher.id,
                roomId: room?.id,
                allowOverride: false,
              } as any,
              schoolId,
            );
            timetableEntries += 1;
          } catch (error) {
            log(
              'Timetable conflict skipped',
              cls.name,
              day,
              period.name,
              (error as Error).message,
            );
          }
        }
      }
    }
    summary.timetable = {
      periods: periodPool.length,
      entriesCreated: timetableEntries,
      total: await repo(TimetableEntry).count({
        where: { schoolId, termId: firstTermId },
      }),
    };

    const announcements = [
      {
        audience: AnnouncementAudience.SCHOOL,
        title: 'Welcome to the 2026/2027 Session',
        body: 'Dear families, welcome back to Bright Future International School. First Term begins on Monday, 14 September 2026. Assembly starts promptly at 8:00am.',
      },
      {
        audience: AnnouncementAudience.GUARDIANS,
        title: 'First Term Fee Payment Reminder',
        body: 'Please log in to the Guardian app to view your child’s invoice and submit payment evidence on or before 30 September 2026.',
      },
      {
        audience: AnnouncementAudience.STAFF,
        title: 'Staff Meeting - Curriculum Planning',
        body: 'All teaching staff are to attend the curriculum planning meeting in the conference room at 3:30pm on Friday, 18 September 2026.',
      },
      {
        audience: AnnouncementAudience.CLASS,
        title: 'JSS 1 - A: Orientation Programme',
        body: 'JSS 1 - A pupils should report to the school hall at 9:00am on Tuesday for the orientation programme. Bring your notebooks and writing materials.',
      },
      {
        audience: AnnouncementAudience.GUARDIANS,
        title: 'Mid-Term Break Notice',
        body: 'The school will close for the mid-term break from 12 October to 16 October 2026. Normal classes resume on Monday, 19 October.',
      },
      {
        audience: AnnouncementAudience.SCHOOL,
        title: 'Inter-House Sports Day',
        body: 'Our annual Inter-House Sports Day will hold on 6 November 2026. Parents and guardians are warmly invited to attend.',
      },
    ];
    let publishedAnnouncements = 0;
    for (const data of announcements) {
      let announcement = await repo(Announcement).findOne({
        where: { schoolId, title: data.title },
      });
      if (!announcement) {
        announcement = await communicationService.create(
          {
            audience: data.audience as any,
            title: data.title,
            body: data.body,
            targetClassId:
              data.audience === AnnouncementAudience.CLASS
                ? classEntities[0].id
                : undefined,
          } as any,
          schoolId,
          admin.id,
        );
      }
      if ((announcement as any).status !== AnnouncementStatus.PUBLISHED) {
        await communicationService.publish(announcement.id, schoolId);
        publishedAnnouncements += 1;
      }
    }
    summary.communication = {
      total: announcements.length,
      published: publishedAnnouncements,
    };

    const policyRepo = repo(GuardianAccessPolicy);
    let policy = await policyRepo.findOne({
      where: { schoolId, scope: GuardianPolicyScope.SCHOOL_DEFAULT },
    });
    if (!policy) {
      policy = await policyService.create(
        {
          name: 'BFIS Default Guardian Access',
          description:
            'Allows guardians to view their child’s academic, attendance, timetable and fee information and submit payment evidence.',
          scope: GuardianPolicyScope.SCHOOL_DEFAULT,
          enabled: true,
          priority: 100,
          rules: (Object.values(GuardianResource) as string[]).flatMap(
            (resource) => [
              {
                resource,
                action: GuardianAction.VIEW,
                effect: GuardianEffect.ALLOW,
              },
              {
                resource,
                action: GuardianAction.SUBMIT,
                effect: GuardianEffect.ALLOW,
              },
            ],
          ),
        } as any,
        adminUser,
        schoolId,
      );
    }
    const exceptionRepo = repo(GuardianAccessException);
    const demoStudent = students[0];
    const demoParent = parents[0];
    let exception = await exceptionRepo.findOne({
      where: {
        schoolId,
        studentId: demoStudent.id,
        guardianId: demoParent.id,
        resource: GuardianResource.TIMETABLE,
        action: GuardianAction.VIEW,
      },
    });
    if (!exception) {
      exception = await exceptionService.create(
        {
          studentId: demoStudent.id,
          guardianId: demoParent.id,
          resource: GuardianResource.TIMETABLE,
          action: GuardianAction.VIEW,
          effect: GuardianEffect.DENY,
          reason: 'Demonstration of a targeted guardian access restriction',
        } as any,
        adminUser,
        schoolId,
      );
    }
    summary.guardianAccess = { policyId: policy.id, exceptionId: exception.id };

    const categoryRepo = repo(ExpenseCategory);
    const expenseCategories: ExpenseCategory[] = [];
    for (const name of [
      'Utilities',
      'Maintenance',
      'Stationery',
      'Transport',
      'Staff Welfare',
      'Catering',
      'Internet',
    ]) {
      let category = await categoryRepo.findOne({ where: { schoolId, name } });
      if (!category)
        category = await expensesService.createCategory(
          {
            name,
            description: `BFIS demo ${name.toLowerCase()} budget line`,
          } as any,
          schoolId,
        );
      expenseCategories.push(category);
    }
    let department = await repo(ExpenseDepartment).findOne({
      where: { schoolId, name: 'Admin' },
    });
    if (!department)
      department = await expensesService.createDepartment(
        { name: 'Admin', code: 'ADM' } as any,
        schoolId,
      );
    const vendors: ExpenseVendor[] = [];
    for (const [name, contact] of [
      ['Ilorin Water Board', '08053111111'],
      ['Glow Electricals', '08053222222'],
      ['Prime Office Supplies', '08053333333'],
      ['Swift Travels Ltd', '08053444444'],
    ] as const) {
      let vendor = await repo(ExpenseVendor).findOne({
        where: { schoolId, name },
      });
      if (!vendor)
        vendor = await expenseVendorsService.createVendor(
          {
            name,
            contactPerson: 'Accounts Desk',
            phone: contact,
            email: `contact@${name.split(' ')[0].toLowerCase()}.ng`,
          } as any,
          schoolId,
        );
      vendors.push(vendor);
    }
    for (const category of expenseCategories.slice(0, 5)) {
      const existingBudget = await ds.getRepository('ExpenseBudget').findOne({
        where: {
          schoolId,
          sessionId: session.id,
          termId: firstTermId,
          categoryId: category.id,
        },
      });
      if (!existingBudget) {
        await expenseBudgetsService.setBudget(
          {
            sessionId: session.id,
            termId: firstTermId,
            categoryId: category.id,
            budgetAmount: 500000 + (hash(category.id) % 1500000),
          } as any,
          schoolId,
        );
      }
    }
    let expenses = 0;
    const expensePlan = [
      ['Electricity bill - September', 185000, 0, 0],
      ['Water supply and filtration', 96000, 0, 1],
      ['Classroom furniture repair', 145000, 1, 2],
      ['Printing and stationery', 78000, 2, 2],
      ['Staff bus fuel and maintenance', 220000, 3, 3],
      ['Teachers’ welfare package', 310000, 4, null],
      ['Parent-teacher meeting catering', 132000, 5, null],
      ['School internet subscription', 180000, 6, null],
      ['Generator servicing', 87500, 1, 1],
      ['Sports equipment replacement', 156000, 1, 2],
    ] as const;
    for (let i = 0; i < expensePlan.length; i += 1) {
      const [title, amount, categoryIdx, vendorIdx] = expensePlan[i];
      const reference = `BFIS-EXP-${String(i + 1).padStart(3, '0')}`;
      const existing = await repo(Expense).findOne({
        where: { schoolId, referenceNumber: reference },
      });
      if (existing) continue;
      await expensesService.createExpense(
        {
          title,
          amount,
          expenseDate: new Date(Date.UTC(2026, 8, 15 + i)).toISOString(),
          categoryId: expenseCategories[categoryIdx].id,
          departmentId: department.id,
          vendorId: vendorIdx === null ? undefined : vendors[vendorIdx].id,
          vendorName: vendorIdx === null ? 'Walk-in Purchase' : undefined,
          paymentMethod:
            i % 3 === 0
              ? ExpensePaymentMethod.BANK_TRANSFER
              : ExpensePaymentMethod.CASH,
          paymentStatus:
            i % 4 === 3
              ? ExpensePaymentStatus.PARTIALLY_PAID
              : ExpensePaymentStatus.PAID,
          amountPaid: i % 4 === 3 ? amount * 0.6 : undefined,
          sessionId: session.id,
          termId: firstTermId,
          notes: DEMO.demoNote,
          referenceNumber: reference,
        } as any,
        bursar1 as any,
      );
      expenses += 1;
    }
    let recurring = await repo(RecurringExpense).findOne({
      where: { schoolId, title: 'Monthly Electricity Bill' },
    });
    if (!recurring) {
      await expenseRecurringService.createRecurringExpense(
        {
          title: 'Monthly Electricity Bill',
          categoryId: expenseCategories[0].id,
          estimatedAmount: 185000,
          frequency: RecurringFrequency.MONTHLY,
          nextDueDate: '2026-11-15',
          vendorId: vendors[0].id,
          notes: DEMO.demoNote,
        } as any,
        schoolId,
      );
    }
    const existingRequest = await ds
      .getRepository('ExpenseRequest')
      .findOne({ where: { schoolId, title: 'Library Books Restock' } });
    if (!existingRequest) {
      await expenseRequestsService.createRequest(
        {
          title: 'Library Books Restock',
          reason:
            'Replace damaged textbooks and expand the JSS and SS reading collection.',
          categoryId: expenseCategories[2].id,
          departmentId: department.id,
          estimatedAmount: 275000,
          neededByDate: '2026-11-30',
          preferredVendor: 'Prime Office Supplies',
          requestType: 'MATERIALS_PURCHASE',
          sessionId: session.id,
          termId: firstTermId,
        } as any,
        bursar1 as any,
      );
    }
    const pettyTransactions = await ds
      .getRepository('PettyCashTransaction')
      .count({ where: { schoolId } });
    if (pettyTransactions === 0) {
      await pettyCashService.replenish(
        {
          amount: 250000,
          description: 'BFIS demo petty cash float',
          transactionDate: '2026-09-15T00:00:00.000Z',
        } as any,
        bursar1 as any,
      );
    }
    summary.expenses = {
      categories: expenseCategories.length,
      vendors: vendors.length,
      expensesCreated: expenses,
    };

    await idCardsService.getSchoolSettings(schoolId);
    await idCardsService.updateSchoolSettings(schoolId, {
      showQrCode: true,
      showSchoolAddress: true,
      showPrincipalSignature: true,
      customNote: 'Bright Future International School - Official ID Card',
    } as any);
    summary.idCards = 'School ID card settings configured';

    log('Seed completed');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('[BFIS SEED] FAILED', error);
  process.exit(1);
});

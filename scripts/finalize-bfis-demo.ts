import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  GradingSystem,
  ResultStatus,
  ScoreComponent,
  UserRole,
} from '../src/common/enums';
import { School } from '../src/schools/entities/school.entity';
import { User } from '../src/users/entities/user.entity';
import { ClassEntity } from '../src/classes/entities/class.entity';
import { Subject } from '../src/subjects/entities/subject.entity';
import { Student } from '../src/students/entities/student.entity';
import { StudentParent } from '../src/students/entities/student-parent.entity';
import { ResultSheet } from '../src/results/entities/result-sheet.entity';
import { StudentResult } from '../src/results/entities/student-result.entity';
import { SubjectScore } from '../src/results/entities/subject-score.entity';
import { Period } from '../src/timetable/entities/period.entity';
import { Room } from '../src/timetable/entities/room.entity';
import { TimetableEntry } from '../src/timetable/entities/timetable-entry.entity';
import {
  Announcement,
  AnnouncementAudience,
  AnnouncementStatus,
} from '../src/communication/entities/announcement.entity';
import { GuardianAccessPolicy } from '../src/guardian-access/entities/guardian-access-policy.entity';
import { GuardianAccessException } from '../src/guardian-access/entities/guardian-access-exception.entity';
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
import {
  ExpensePaymentMethod,
  ExpensePaymentStatus,
  RecurringFrequency,
} from '../src/expenses/enums';
import { ResultsService } from '../src/results/results.service';
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
import { ResultTemplatesService } from '../src/results/result-templates.service';

const SCHOOL_CODE = 'BFIS-DEMO';
const log = (...args: unknown[]) => console.log('[BFIS FINALIZE]', ...args);
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

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const ds = app.get(DataSource);
  const repo = <T extends ObjectLiteral>(
    entity: Parameters<DataSource['getRepository']>[0],
  ): Repository<T> => ds.getRepository(entity as any) as Repository<T>;

  const resultsService = app.get(ResultsService);
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
  const resultTemplatesService = app.get(ResultTemplatesService);

  try {
    const school = await repo<School>(School).findOne({
      where: { schoolCode: SCHOOL_CODE },
    });
    if (!school)
      throw new Error('Demo school not found; run pnpm seed:demo first');
    const schoolId = school.id;
    const admin = await repo<User>(User).findOneOrFail({
      where: { schoolId, role: UserRole.SCHOOL_ADMIN },
    });
    const bursar = await repo<User>(User).findOneOrFail({
      where: { schoolId, role: UserRole.BURSAR },
    });
    const adminUser = {
      sub: admin.id,
      role: UserRole.SCHOOL_ADMIN,
      schoolId,
    } as any;
    const termRepo = ds.getRepository('Term') as Repository<any>;
    const sessionRepo = ds.getRepository('Session') as Repository<any>;
    const session = await sessionRepo.findOneOrFail({
      where: { schoolId, name: '2026/2027' },
    });
    const firstTerm = await termRepo.findOneOrFail({
      where: { schoolId, sessionId: session.id, name: 'First Term' },
    });
    log('Demo school loaded', schoolId);

    log('Completing result sheets');
    const resultClasses = await repo<ClassEntity>(ClassEntity).find({
      where: { schoolId },
    });
    for (const cls of resultClasses) {
      const existing = await repo<ResultSheet>(ResultSheet).findOne({
        where: { schoolId, classId: cls.id, termId: firstTerm.id },
      });
      if (!existing) {
        await resultsService.createResultSheet(
          {
            classId: cls.id,
            termId: firstTerm.id,
            gradingSystem: GradingSystem.NIGERIAN_BASIC,
            scoreComponents: [
              { component: ScoreComponent.CA1, maxScore: 20 },
              { component: ScoreComponent.CA2, maxScore: 20 },
              { component: ScoreComponent.PROJECT, maxScore: 10 },
              { component: ScoreComponent.EXAM, maxScore: 50 },
            ],
          } as any,
          admin.id,
          schoolId,
        );
        log('Created result sheet', cls.name);
      }
    }
    const sheets = await repo<ResultSheet>(ResultSheet).find({
      where: { schoolId },
      relations: ['classEntity'],
      order: { createdAt: 'ASC' },
    });
    for (const sheet of sheets) {
      if (sheet.status === ResultStatus.PUBLISHED) continue;
      const classId = sheet.classId;
      const students = await repo<Student>(Student).find({
        where: { schoolId, currentClassId: classId, isArchived: false },
      });
      const classSubjects = (await ds
        .getRepository('ClassSubject')
        .find({ where: { classId } })) as any[];
      const totalScores = await repo<SubjectScore>(SubjectScore).count({
        where: { resultSheetId: sheet.id },
      });
      const submittedScores = await repo<SubjectScore>(SubjectScore).count({
        where: { resultSheetId: sheet.id, isSubmitted: true },
      });
      if (submittedScores < totalScores) {
        for (const cs of classSubjects) {
          const subject = await repo<Subject>(Subject).findOne({
            where: { id: cs.subjectId, schoolId },
          });
          if (!subject) continue;
          const scores = students.map((student) => {
            const target = clamp(
              48 + (hash(`${student.id}:${subject.name}`) % 52) - 8,
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
      }
      const studentResults = await repo<StudentResult>(StudentResult).find({
        where: { schoolId, resultSheetId: sheet.id },
      });
      for (const result of studentResults) {
        const average = Number(result.totalScore || 0);
        await resultsService.savePrincipalRemark(
          result.id,
          average >= 75
            ? 'An excellent term. Keep up the outstanding discipline and academic focus.'
            : average >= 60
              ? 'A very good term. Continue to strengthen your study habits.'
              : average >= 50
                ? 'Satisfactory progress. More consistent practice will improve your results.'
                : 'Needs improvement. Please work closely with your subject teachers next term.',
          schoolId,
        );
        await resultsService.saveClassTeacherRemark(
          result.id,
          average >= 70
            ? 'A commendable performance across the term.'
            : 'Steady progress with room for improvement.',
          admin.id,
          schoolId,
        );
      }
      await resultsService.publishResultSheet(sheet.id, admin.id, schoolId);
      log('Published result sheet', sheet.id);
    }
    await resultTemplatesService.ensureDefaultTemplateExists(schoolId);
    if (
      (await ds
        .getRepository('ResultTemplate')
        .count({ where: { schoolId } })) < 2
    ) {
      await resultTemplatesService.createTemplate(
        {
          name: 'BFIS First Term Report',
          description: 'Branded report card for the 2026/2027 First Term',
          isDefault: false,
        } as any,
        schoolId,
      );
    }

    log('Completing timetable');
    if (
      (await ds.getRepository('SchoolDay').count({ where: { schoolId } })) === 0
    ) {
      await timetableService.initDefaultSchoolDays(schoolId);
    }
    if ((await repo<Period>(Period).count({ where: { schoolId } })) === 0) {
      await timetableService.initDefaultPeriods(schoolId);
    }
    const periods = await repo<Period>(Period).find({
      where: { schoolId, isActive: true },
      order: { orderIndex: 'ASC' },
    });
    const classes = await repo<ClassEntity>(ClassEntity).find({
      where: { schoolId },
    });
    for (let i = 0; i < classes.length; i += 1) {
      const name = `Room ${String.fromCharCode(65 + i)}`;
      if (!(await repo<Room>(Room).findOne({ where: { schoolId, name } }))) {
        await timetableService.createRoom(
          { name, capacity: 40, type: 'CLASSROOM' } as any,
          schoolId,
        );
      }
    }
    const teachers = (
      await repo<User>(User).find({ where: { schoolId } })
    ).filter(
      (u) =>
        u.role === UserRole.CLASS_TEACHER ||
        u.role === UserRole.SUBJECT_TEACHER,
    );
    const rooms = await repo<Room>(Room).find({ where: { schoolId } });
    let timetableCreated = 0;
    for (let day = 1; day <= 5; day += 1) {
      for (let p = 0; p < Math.min(6, periods.length); p += 1) {
        const period = periods[p];
        for (let c = 0; c < classes.length; c += 1) {
          const cls = classes[c];
          const classSubjects = (await ds
            .getRepository('ClassSubject')
            .find({ where: { classId: cls.id } })) as any[];
          if (!classSubjects.length) continue;
          const cs = classSubjects[(c + p + day) % classSubjects.length];
          const room = rooms.find(
            (r) => r.name === `Room ${String.fromCharCode(65 + c)}`,
          );
          const teacher = teachers[(day * 11 + p * 7 + c) % teachers.length];
          const existing = await repo<TimetableEntry>(TimetableEntry).findOne({
            where: {
              schoolId,
              termId: firstTerm.id,
              classId: cls.id,
              dayOfWeek: day,
              periodId: period.id,
              subjectId: cs.subjectId,
            },
          });
          if (existing) continue;
          const entryRepo = repo<TimetableEntry>(TimetableEntry);
          const entry = entryRepo.create({
            schoolId,
            termId: firstTerm.id,
            classId: cls.id,
            dayOfWeek: day,
            periodId: period.id,
            subjectId: cs.subjectId,
            teacherId: teacher.id,
            roomId: room?.id ?? null,
            isDoublePeriod: false,
            useClassTeacher: false,
            teacherIds: [],
          } as any);
          await entryRepo.save(entry);
          timetableCreated += 1;
        }
      }
    }
    log('Timetable entries created', timetableCreated);

    log('Completing announcements');
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
    for (const data of announcements) {
      let announcement = await repo<Announcement>(Announcement).findOne({
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
                ? classes[0].id
                : undefined,
          } as any,
          schoolId,
          admin.id,
        );
      }
      if ((announcement as any).status !== AnnouncementStatus.PUBLISHED) {
        await communicationService.publish(announcement.id, schoolId);
      }
    }

    log('Completing guardian access');
    if (
      !(await repo<GuardianAccessPolicy>(GuardianAccessPolicy).findOne({
        where: { schoolId, scope: GuardianPolicyScope.SCHOOL_DEFAULT },
      }))
    ) {
      await policyService.create(
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
    const student = await repo<Student>(Student).findOne({
      where: { schoolId },
      order: { createdAt: 'ASC' },
    });
    const parentLink = await repo<StudentParent>(StudentParent).findOne({
      where: { studentId: student!.id },
    });
    if (
      parentLink &&
      !(await repo<GuardianAccessException>(GuardianAccessException).findOne({
        where: {
          schoolId,
          studentId: student!.id,
          guardianId: parentLink.parentId,
          resource: GuardianResource.TIMETABLE,
          action: GuardianAction.VIEW,
        },
      }))
    ) {
      await exceptionService.create(
        {
          studentId: student!.id,
          guardianId: parentLink.parentId,
          resource: GuardianResource.TIMETABLE,
          action: GuardianAction.VIEW,
          effect: GuardianEffect.DENY,
          reason: 'Demonstration of a targeted guardian access restriction',
        } as any,
        adminUser,
        schoolId,
      );
    }

    log('Completing expenses');
    const categoryNames = [
      'Utilities',
      'Maintenance',
      'Stationery',
      'Transport',
      'Staff Welfare',
      'Catering',
      'Internet',
    ];
    const categories: ExpenseCategory[] = [];
    for (const name of categoryNames) {
      let category = await repo<ExpenseCategory>(ExpenseCategory).findOne({
        where: { schoolId, name },
      });
      if (!category)
        category = await expensesService.createCategory(
          {
            name,
            description: `BFIS demo ${name.toLowerCase()} budget line`,
          } as any,
          schoolId,
        );
      categories.push(category);
    }
    let department = await repo<ExpenseDepartment>(ExpenseDepartment).findOne({
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
      let vendor = await repo<ExpenseVendor>(ExpenseVendor).findOne({
        where: { schoolId, name },
      });
      if (!vendor)
        vendor = await expenseVendorsService.createVendor(
          { name, contactPerson: 'Accounts Desk', phone: contact } as any,
          schoolId,
        );
      vendors.push(vendor);
    }
    for (const category of categories.slice(0, 5)) {
      const existing = await ds.getRepository('ExpenseBudget').findOne({
        where: {
          schoolId,
          sessionId: session.id,
          termId: firstTerm.id,
          categoryId: category.id,
        },
      });
      if (!existing) {
        await expenseBudgetsService.setBudget(
          {
            sessionId: session.id,
            termId: firstTerm.id,
            categoryId: category.id,
            budgetAmount: 500000 + (hash(category.id) % 1500000),
          } as any,
          schoolId,
        );
      }
    }
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
    let expensesCreated = 0;
    for (let i = 0; i < expensePlan.length; i += 1) {
      const [title, amount, categoryIdx, vendorIdx] = expensePlan[i];
      const reference = `BFIS-EXP-${String(i + 1).padStart(3, '0')}`;
      if (
        await repo<Expense>(Expense).findOne({
          where: { schoolId, referenceNumber: reference },
        })
      )
        continue;
      await expensesService.createExpense(
        {
          title,
          amount,
          expenseDate: new Date(Date.UTC(2026, 8, 15 + i)).toISOString(),
          categoryId: categories[categoryIdx].id,
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
          termId: firstTerm.id,
          notes: 'BFIS demo data - SchoolRight sales demonstration',
          referenceNumber: reference,
        } as any,
        bursar as any,
      );
      expensesCreated += 1;
    }
    if (
      !(await ds
        .getRepository('RecurringExpense')
        .findOne({ where: { schoolId, title: 'Monthly Electricity Bill' } }))
    ) {
      await expenseRecurringService.createRecurringExpense(
        {
          title: 'Monthly Electricity Bill',
          categoryId: categories[0].id,
          estimatedAmount: 185000,
          frequency: RecurringFrequency.MONTHLY,
          nextDueDate: '2026-11-15',
          vendorId: vendors[0].id,
          notes: 'BFIS demo data - SchoolRight sales demonstration',
        } as any,
        schoolId,
      );
    }
    if (
      !(await ds
        .getRepository('ExpenseRequest')
        .findOne({ where: { schoolId, title: 'Library Books Restock' } }))
    ) {
      await expenseRequestsService.createRequest(
        {
          title: 'Library Books Restock',
          reason:
            'Replace damaged textbooks and expand the JSS and SS reading collection.',
          categoryId: categories[2].id,
          departmentId: department.id,
          estimatedAmount: 275000,
          neededByDate: '2026-11-30',
          preferredVendor: 'Prime Office Supplies',
          requestType: 'MATERIALS_PURCHASE',
          sessionId: session.id,
          termId: firstTerm.id,
        } as any,
        bursar as any,
      );
    }
    if (
      (await ds
        .getRepository('PettyCashTransaction')
        .count({ where: { schoolId } })) === 0
    ) {
      await pettyCashService.replenish(
        {
          amount: 250000,
          description: 'BFIS demo petty cash float',
          transactionDate: '2026-09-15T00:00:00.000Z',
        } as any,
        bursar as any,
      );
    }
    log('Expenses created', expensesCreated);

    log('Completing ID card settings');
    await idCardsService.getSchoolSettings(schoolId);
    await idCardsService.updateSchoolSettings(schoolId, {
      showQrCode: true,
      showSchoolAddress: true,
      showPrincipalSignature: true,
      customNote: 'Bright Future International School - Official ID Card',
    } as any);

    log('FINALIZED');
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('[BFIS FINALIZE] FAILED', error);
  process.exit(1);
});

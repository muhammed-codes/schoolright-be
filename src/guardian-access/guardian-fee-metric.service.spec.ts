import { Repository } from 'typeorm';
import { TermStatus } from '../common/enums';
import {
  FeeOverrideApprovalStatus,
  FeeOverrideType,
} from '../fees/entities/student-fee-override.entity';
import { FeeCategory } from '../fees/entities/fee-category.entity';
import {
  InvoiceStatus,
  StudentInvoice,
} from '../fees/entities/student-invoice.entity';
import { StudentInvoiceItem } from '../fees/entities/student-invoice-item.entity';
import { Term } from '../terms/entities/term.entity';
import { TermsService } from '../terms/terms.service';
import { GuardianFeeMetricService } from './services/guardian-fee-metric.service';
import {
  GuardianFeeAmountBasis,
  GuardianFeeCategorySelectionMode,
  GuardianFeeEvaluationStatus,
} from './interfaces/guardian-fee-facts.interface';

const ACTIVE_TERM: Partial<Term> = {
  id: 'term-a',
  sessionId: 'session-a',
  status: TermStatus.ACTIVE,
};

const DEFAULT_CATEGORIES: Partial<FeeCategory>[] = [
  { id: 'cat-tuition', name: 'Tuition', schoolId: 'school-a' },
  { id: 'cat-transport', name: 'Transport', schoolId: 'school-a' },
];

interface BuildServiceOptions {
  term?: Partial<Term> | null;
  reason?: string;
  categories?: Partial<FeeCategory>[];
}

describe('guardian fee metric service', () => {
  const buildService = (
    invoices: Partial<StudentInvoice>[] = [],
    options: BuildServiceOptions = {},
  ) => {
    const findInvoices = jest
      .fn()
      .mockResolvedValue(invoices as StudentInvoice[]);
    const findCategories = jest
      .fn()
      .mockImplementation(
        (args: { where?: { id?: { _value?: string[] } } }) => {
          const available = options.categories ?? DEFAULT_CATEGORIES;
          const requestedIds = args?.where?.id?._value;
          const matching = Array.isArray(requestedIds)
            ? available.filter((category) =>
                requestedIds.includes(category.id!),
              )
            : available;
          return Promise.resolve(matching as FeeCategory[]);
        },
      );
    const resolveActiveTermForMetrics = jest.fn().mockResolvedValue(
      options.term === undefined && !options.reason
        ? { term: ACTIVE_TERM }
        : options.term
          ? { term: options.term }
          : {
              term: null,
              reason:
                options.reason ??
                'No active term is configured for this school',
            },
    );
    const service = new GuardianFeeMetricService(
      { find: findInvoices } as unknown as Repository<StudentInvoice>,
      { find: findCategories } as unknown as Repository<FeeCategory>,
      { resolveActiveTermForMetrics } as unknown as TermsService,
    );
    return {
      service,
      findInvoices,
      findCategories,
      resolveActiveTermForMetrics,
    };
  };

  const makeItem = (values: Partial<StudentInvoiceItem>): StudentInvoiceItem =>
    ({
      feeCategoryId: 'cat-tuition',
      description: 'Tuition',
      originalAmount: 1000,
      amount: 1000,
      amountPaid: 0,
      balance: 1000,
      overrideId: null,
      overrideAmount: 0,
      overrideType: null,
      overrideApprovalStatus: null,
      ...values,
    }) as StudentInvoiceItem;

  const makeInvoice = (
    values: Partial<StudentInvoice> = {},
  ): StudentInvoice => {
    const items = values.items ?? [];
    const totalAmount =
      values.totalAmount ??
      items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const totalPaid =
      values.totalPaid ??
      items.reduce((sum, item) => sum + Number(item.amountPaid ?? 0), 0);
    return {
      id: 'invoice-a',
      schoolId: 'school-a',
      studentId: 'student-a',
      sessionId: 'session-a',
      termId: 'term-a',
      status: InvoiceStatus.OPEN,
      items,
      totalAmount,
      totalPaid,
      balance: values.balance ?? Math.max(0, totalAmount - totalPaid),
      ...values,
    } as StudentInvoice;
  };

  it('combines active term and session invoices using invoice totals', async () => {
    const { service, findInvoices } = buildService([
      { totalAmount: 1000, totalPaid: 500, balance: 500 },
      { totalAmount: 2000, totalPaid: 1000, balance: 1000 },
    ]);
    const result = await service.calculateForStudent('student-a', 'school-a');
    expect(result.feePaymentPercentage).toBe(50);
    expect(result.outstandingBalance).toBe(1500);
    expect(result.totalAmount).toBe(3000);
    expect(result.totalPaid).toBe(1500);
    expect(result.paymentPercentage).toBe(50);
    expect(result.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(result.unavailable).toEqual({});
    expect(findInvoices).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          {
            schoolId: 'school-a',
            studentId: expect.anything(),
            termId: 'term-a',
          },
          {
            schoolId: 'school-a',
            studentId: expect.anything(),
            sessionId: 'session-a',
            termId: expect.anything(),
          },
        ],
      }),
    );
  });

  it('returns unavailable state when no applicable invoices exist', async () => {
    const { service } = buildService([]);
    const result = await service.calculateForStudent('student-a', 'school-a');
    expect(result.feePaymentPercentage).toBeUndefined();
    expect(result.unavailable.feePaymentPercentage).toContain(
      'No applicable invoices',
    );
    expect(result.evaluationStatus).toBe(
      GuardianFeeEvaluationStatus.NO_APPLICABLE_INVOICES,
    );
  });

  it('returns unavailable state when there is no active term', async () => {
    const { service } = buildService([], { term: null });
    const result = await service.calculateForStudent('student-a', 'school-a');
    expect(result.unavailable.outstandingBalance).toContain('No active term');
    expect(result.evaluationStatus).toBe(
      GuardianFeeEvaluationStatus.NO_ACTIVE_TERM,
    );
  });

  it('derives a paid status when invoices are fully settled', async () => {
    const { service } = buildService([
      { totalAmount: 1000, totalPaid: 1000, balance: 0 },
    ]);
    const result = await service.calculateForStudent('student-a', 'school-a');
    expect(result.status).toBe(InvoiceStatus.PAID);
    expect(result.paymentPercentage).toBe(100);
    expect(result.outstandingBalance).toBe(0);
  });

  it('derives an open status when no payment has been made', async () => {
    const { service } = buildService([
      { totalAmount: 1000, totalPaid: 0, balance: 1000 },
    ]);
    const result = await service.calculateForStudent('student-a', 'school-a');
    expect(result.status).toBe(InvoiceStatus.OPEN);
    expect(result.paymentPercentage).toBe(0);
  });

  it('A: ALL includes categorized and uncategorized invoice amounts', async () => {
    const { service } = buildService([
      makeInvoice({
        items: [
          makeItem({ amount: 1000, amountPaid: 250, balance: 750 }),
          makeItem({
            feeCategoryId: 'cat-transport',
            description: 'Transport',
            originalAmount: 200,
            amount: 200,
            amountPaid: 100,
            balance: 100,
          }),
        ],
      }),
    ]);
    const result = await service.calculateForStudent('student-a', 'school-a', {
      feeSelectionMode: GuardianFeeCategorySelectionMode.ALL,
    });
    expect(result.aggregate?.grossAmount).toBe(1200);
    expect(result.totalAmount).toBe(1200);
    expect(result.totalPaid).toBe(350);
    expect(
      result.categories?.map((category) => category.feeCategoryId),
    ).toEqual(['cat-tuition', 'cat-transport']);
  });

  it('B: INCLUDE limits facts to selected categories', async () => {
    const { service } = buildService([
      makeInvoice({
        items: [
          makeItem({
            amount: 900,
            amountPaid: 400,
            balance: 500,
            overrideAmount: 100,
            overrideType: FeeOverrideType.DISCOUNT,
            overrideApprovalStatus: FeeOverrideApprovalStatus.APPROVED,
          }),
          makeItem({
            feeCategoryId: 'cat-transport',
            description: 'Transport',
            originalAmount: 200,
            amount: 200,
            amountPaid: 100,
            balance: 100,
          }),
        ],
      }),
    ]);
    const result = await service.calculateForStudent('student-a', 'school-a', {
      feeSelectionMode: GuardianFeeCategorySelectionMode.INCLUDE,
      feeCategoryIds: ['cat-tuition'],
    });
    expect(
      result.categories?.map((category) => category.feeCategoryId),
    ).toEqual(['cat-tuition']);
    expect(result.aggregate?.grossAmount).toBe(1000);
    expect(result.aggregate?.netPayableAmount).toBe(900);
    expect(result.aggregate?.discountAmount).toBe(100);
    expect(result.totalPaid).toBe(400);
    expect(result.outstandingBalance).toBe(500);
    expect(result.feePaymentPercentage).toBeCloseTo(44.44, 2);
  });

  it('C: EXCLUDE removes selected categories from all facts', async () => {
    const { service } = buildService([
      makeInvoice({
        items: [
          makeItem({ amount: 900, amountPaid: 400, balance: 500 }),
          makeItem({
            feeCategoryId: 'cat-transport',
            description: 'Transport',
            originalAmount: 200,
            amount: 200,
            amountPaid: 100,
            balance: 100,
          }),
        ],
      }),
    ]);
    const result = await service.calculateForStudent('student-a', 'school-a', {
      feeSelectionMode: GuardianFeeCategorySelectionMode.EXCLUDE,
      feeCategoryIds: ['cat-transport'],
    });
    expect(
      result.categories?.map((category) => category.feeCategoryId),
    ).toEqual(['cat-tuition']);
    expect(result.totalAmount).toBe(900);
    expect(result.totalPaid).toBe(400);
  });

  it('D: INDIVIDUAL reports only the requested category', async () => {
    const { service } = buildService([
      makeInvoice({
        items: [
          makeItem({ amount: 1000, amountPaid: 500, balance: 500 }),
          makeItem({
            feeCategoryId: 'cat-transport',
            description: 'Transport',
            originalAmount: 400,
            amount: 400,
            amountPaid: 200,
            balance: 200,
          }),
        ],
      }),
    ]);
    const result = await service.calculateForStudent('student-a', 'school-a', {
      feeSelectionMode: GuardianFeeCategorySelectionMode.INDIVIDUAL,
      feeCategoryIds: ['cat-transport'],
    });
    expect(result.selectedCategories).toEqual([
      { id: 'cat-transport', name: 'Transport' },
    ]);
    expect(result.totalAmount).toBe(400);
    expect(result.totalPaid).toBe(200);
    expect(result.categories).toHaveLength(1);
  });

  it('E: fully waived obligations expose settled but not actual percentages', async () => {
    const { service } = buildService([
      makeInvoice({
        items: [
          makeItem({
            originalAmount: 1000,
            amount: 0,
            amountPaid: 0,
            balance: 0,
            overrideAmount: 1000,
            overrideType: FeeOverrideType.WAIVER,
            overrideApprovalStatus: FeeOverrideApprovalStatus.APPROVED,
          }),
        ],
      }),
    ]);
    const actual = await service.calculateForStudent('student-a', 'school-a');
    expect(actual.feePaymentPercentage).toBeUndefined();
    expect(actual.settledObligationPercentage).toBe(100);
    expect(actual.outstandingBalance).toBe(0);
    expect(actual.evaluationStatus).toBe(
      GuardianFeeEvaluationStatus.FULLY_WAIVED,
    );

    const settled = await service.calculateForStudent('student-a', 'school-a', {
      amountBasis: GuardianFeeAmountBasis.SETTLED_OBLIGATION,
    });
    expect(settled.feePaymentPercentage).toBe(100);
    expect(settled.paymentPercentage).toBe(100);
    expect(settled.outstandingBalance).toBe(0);
  });

  it('F: actual and settled bases keep distinct partial amounts', async () => {
    const { service } = buildService([
      makeInvoice({
        items: [
          makeItem({
            originalAmount: 1000,
            amount: 800,
            amountPaid: 200,
            balance: 600,
            overrideAmount: 200,
            overrideType: FeeOverrideType.DISCOUNT,
            overrideApprovalStatus: FeeOverrideApprovalStatus.APPROVED,
          }),
        ],
      }),
    ]);
    const actual = await service.calculateForStudent('student-a', 'school-a');
    expect(actual.feePaymentPercentage).toBeCloseTo(25, 2);
    expect(actual.outstandingBalance).toBe(600);
    expect(actual.aggregate?.settledObligationPercentage).toBeCloseTo(50, 2);
    expect(actual.aggregate?.obligationOutstandingBalance).toBe(400);

    const settled = await service.calculateForStudent('student-a', 'school-a', {
      amountBasis: GuardianFeeAmountBasis.SETTLED_OBLIGATION,
    });
    expect(settled.feePaymentPercentage).toBeCloseTo(50, 2);
    expect(settled.outstandingBalance).toBe(400);
  });

  it('G: pending, rejected, and adjustment overrides are not settled', async () => {
    const { service } = buildService([
      makeInvoice({
        items: [
          makeItem({
            feeCategoryId: 'cat-tuition',
            originalAmount: 1000,
            amount: 900,
            amountPaid: 0,
            overrideAmount: 100,
            overrideType: FeeOverrideType.ADJUSTMENT,
            overrideApprovalStatus: FeeOverrideApprovalStatus.APPROVED,
          }),
          makeItem({
            feeCategoryId: 'cat-transport',
            description: 'Transport',
            originalAmount: 500,
            amount: 450,
            amountPaid: 0,
            overrideAmount: 50,
            overrideType: FeeOverrideType.DISCOUNT,
            overrideApprovalStatus: FeeOverrideApprovalStatus.PENDING,
          }),
        ],
      }),
    ]);
    const result = await service.calculateForStudent('student-a', 'school-a');
    expect(result.aggregate?.adjustmentAmount).toBe(100);
    expect(result.aggregate?.discountAmount).toBe(0);
    expect(result.aggregate?.nonCashSettledAmount).toBe(0);
    expect(result.aggregate?.settledAmount).toBe(0);
    expect(result.aggregate?.settledObligationPercentage).toBe(0);
  });

  it('H: overpayments are tracked but percentages remain capped', async () => {
    const { service } = buildService([
      makeInvoice({
        items: [
          makeItem({
            originalAmount: 1000,
            amount: 800,
            amountPaid: 950,
            balance: 0,
            overrideAmount: 200,
            overrideType: FeeOverrideType.WAIVER,
            overrideApprovalStatus: FeeOverrideApprovalStatus.APPROVED,
          }),
        ],
      }),
    ]);
    const result = await service.calculateForStudent('student-a', 'school-a');
    expect(result.aggregate?.approvedPaymentAmount).toBe(800);
    expect(result.aggregate?.overpaymentAmount).toBe(150);
    expect(result.feePaymentPercentage).toBe(100);
    expect(result.outstandingBalance).toBe(0);
  });

  it('I: batch calculation returns per-student metrics with one invoice query', async () => {
    const { service, findInvoices } = buildService([
      makeInvoice({
        studentId: 'student-a',
        totalAmount: 1000,
        totalPaid: 500,
      }),
      makeInvoice({ studentId: 'student-b', totalAmount: 600, totalPaid: 600 }),
    ]);
    const results = await service.calculateForStudents({
      schoolId: 'school-a',
      studentIds: ['student-a', 'student-b'],
    });
    expect(findInvoices).toHaveBeenCalledTimes(1);
    expect(results.size).toBe(2);
    expect(results.get('student-a')?.totalPaid).toBe(500);
    expect(results.get('student-a')?.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(results.get('student-b')?.status).toBe(InvoiceStatus.PAID);
  });

  it('J: invalid categories and ambiguous active terms are explicit', async () => {
    const invalidService = buildService([], {
      categories: [
        { id: 'cat-tuition', name: 'Tuition', schoolId: 'school-a' },
      ],
    });
    const invalid = await invalidService.service.calculateForStudent(
      'student-a',
      'school-a',
      {
        feeSelectionMode: GuardianFeeCategorySelectionMode.INCLUDE,
        feeCategoryIds: ['cat-tuition', 'cat-other-school'],
      },
    );
    expect(invalid.evaluationStatus).toBe(
      GuardianFeeEvaluationStatus.INVALID_FEE_CATEGORY,
    );
    expect(invalid.unavailable.feePaymentPercentage).toContain('invalid');

    const ambiguousService = buildService([], {
      reason: 'Multiple active terms are configured for this school',
    });
    const ambiguous = await ambiguousService.service.calculateForStudent(
      'student-a',
      'school-a',
    );
    expect(ambiguous.evaluationStatus).toBe(
      GuardianFeeEvaluationStatus.AMBIGUOUS_ACTIVE_TERM,
    );
  });
});

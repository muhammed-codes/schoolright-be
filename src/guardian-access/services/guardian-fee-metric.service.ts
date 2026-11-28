import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { FeeCategory } from '../../fees/entities/fee-category.entity';
import {
  FeeOverrideApprovalStatus,
  FeeOverrideType,
} from '../../fees/entities/student-fee-override.entity';
import {
  InvoiceStatus,
  StudentInvoice,
} from '../../fees/entities/student-invoice.entity';
import { ActiveTermResolution, TermsService } from '../../terms/terms.service';
import { GuardianFeeMetricScope } from '../enums/guardian-condition.enums';
import {
  GuardianFeeAggregateFact,
  GuardianFeeAmountBasis,
  GuardianFeeAmounts,
  GuardianFeeCategoryFact,
  GuardianFeeCategorySelectionMode,
  GuardianFeeEvaluationStatus,
  GuardianFeeFactsRequest,
  GuardianFeeMetric,
  GuardianFeeMetricRequest,
  GuardianFeeUnavailable,
} from '../interfaces/guardian-fee-facts.interface';

export type { GuardianFeeMetric } from '../interfaces/guardian-fee-facts.interface';

interface ResolvedPeriod {
  termId?: string | null;
  sessionId?: string | null;
  status?: GuardianFeeEvaluationStatus;
  reason?: string;
}

interface CategoryResolution {
  mode: GuardianFeeCategorySelectionMode;
  ids: string[];
  categories: Array<{ id: string; name: string }>;
  reason?: string;
}

type MutableFeeAmounts = GuardianFeeAmounts;

interface FeeBucket extends MutableFeeAmounts {
  feeCategoryId: string;
  description: string;
}

const UNCATEGORIZED_FEE_ID = 'UNCATEGORIZED';

@Injectable()
export class GuardianFeeMetricService {
  constructor(
    @InjectRepository(StudentInvoice)
    private readonly invoiceRepo: Repository<StudentInvoice>,
    @InjectRepository(FeeCategory)
    private readonly feeCategoryRepo: Repository<FeeCategory>,
    private readonly termsService: TermsService,
  ) {}

  calculateForStudent = async (
    studentId: string,
    schoolId: string,
    scopeOrOptions:
      | GuardianFeeMetricScope
      | Partial<GuardianFeeMetricRequest> = GuardianFeeMetricScope.ACTIVE_TERM_AND_SESSION_INVOICES,
    amountBasis: GuardianFeeAmountBasis = GuardianFeeAmountBasis.ACTUAL_PAYMENT,
  ): Promise<GuardianFeeMetric> => {
    const options =
      typeof scopeOrOptions === 'string' ? {} : (scopeOrOptions ?? {});
    const request: GuardianFeeMetricRequest = {
      ...options,
      schoolId,
      studentId,
      scope:
        typeof scopeOrOptions === 'string' ? scopeOrOptions : options.scope,
      amountBasis: options.amountBasis ?? amountBasis,
    };
    const results = await this.calculateForStudents({
      ...request,
      studentIds: [studentId],
    });
    return (
      results.get(studentId) ??
      this.unavailableMetric(
        GuardianFeeEvaluationStatus.NO_APPLICABLE_INVOICES,
        'No applicable invoices',
        options.amountBasis ?? amountBasis,
      )
    );
  };

  calculateForStudents = async (
    request: GuardianFeeFactsRequest,
  ): Promise<Map<string, GuardianFeeMetric>> => {
    const results = new Map<string, GuardianFeeMetric>();
    const studentIds = Array.from(
      new Set((request.studentIds ?? []).filter((id) => Boolean(id))),
    );
    if (studentIds.length === 0) return results;

    const amountBasis =
      request.amountBasis ?? GuardianFeeAmountBasis.ACTUAL_PAYMENT;
    const period = await this.resolvePeriod(request);
    const categories = await this.resolveSelectedCategories(request);

    if (period.reason || categories.reason) {
      const status =
        period.status ??
        (categories.reason
          ? GuardianFeeEvaluationStatus.INVALID_FEE_CATEGORY
          : GuardianFeeEvaluationStatus.NO_ACTIVE_TERM);
      const reason = period.reason ?? categories.reason ?? 'Metric unavailable';
      for (const studentId of studentIds) {
        results.set(
          studentId,
          this.unavailableMetric(
            status,
            reason,
            amountBasis,
            categories.categories,
          ),
        );
      }
      return results;
    }

    const where = this.buildInvoiceWhere(request.schoolId, studentIds, period);
    if (where.length === 0) {
      for (const studentId of studentIds) {
        results.set(
          studentId,
          this.unavailableMetric(
            GuardianFeeEvaluationStatus.NO_ACTIVE_SESSION,
            'No active session or term is configured for this school',
            amountBasis,
            categories.categories,
          ),
        );
      }
      return results;
    }

    const invoices = await this.invoiceRepo.find({
      where,
      relations: ['items'],
    });
    const invoicesByStudent = new Map<string, StudentInvoice[]>();
    for (const studentId of studentIds) invoicesByStudent.set(studentId, []);
    for (const invoice of invoices) {
      const invoiceStudentId =
        invoicesByStudent.has(invoice.studentId) || studentIds.length !== 1
          ? invoice.studentId
          : studentIds[0];
      const studentInvoices = invoicesByStudent.get(invoiceStudentId);
      if (studentInvoices) studentInvoices.push(invoice);
    }

    for (const studentId of studentIds) {
      results.set(
        studentId,
        this.buildMetric(
          invoicesByStudent.get(studentId) ?? [],
          categories,
          amountBasis,
        ),
      );
    }
    return results;
  };

  private resolvePeriod = async (
    request: GuardianFeeFactsRequest,
  ): Promise<ResolvedPeriod> => {
    if (
      request.scope &&
      request.scope !== GuardianFeeMetricScope.ACTIVE_TERM_AND_SESSION_INVOICES
    ) {
      throw new BadRequestException('Unsupported fee metric scope');
    }
    if (request.sessionId || request.termId) {
      return {
        sessionId: request.sessionId ?? null,
        termId: request.termId ?? null,
      };
    }

    const activeTerm = await this.termsService.resolveActiveTermForMetrics(
      request.schoolId,
    );
    if (activeTerm.reason || !activeTerm.term) {
      return {
        status: this.resolveTermStatus(activeTerm),
        reason:
          activeTerm.reason ?? 'No active term is configured for this school',
      };
    }
    return {
      sessionId: activeTerm.term.sessionId,
      termId: activeTerm.term.id,
    };
  };

  private resolveTermStatus = (
    resolution: ActiveTermResolution,
  ): GuardianFeeEvaluationStatus => {
    if (!resolution.reason) return GuardianFeeEvaluationStatus.NO_ACTIVE_TERM;
    if (resolution.reason.includes('Multiple active terms')) {
      return GuardianFeeEvaluationStatus.AMBIGUOUS_ACTIVE_TERM;
    }
    if (resolution.reason.includes('session')) {
      return GuardianFeeEvaluationStatus.NO_ACTIVE_SESSION;
    }
    return GuardianFeeEvaluationStatus.NO_ACTIVE_TERM;
  };

  private resolveSelectedCategories = async (
    request: GuardianFeeFactsRequest,
  ): Promise<CategoryResolution> => {
    const mode =
      request.feeSelectionMode ?? GuardianFeeCategorySelectionMode.ALL;
    const ids = Array.from(
      new Set((request.feeCategoryIds ?? []).filter((id) => Boolean(id))),
    );
    if (
      (mode === GuardianFeeCategorySelectionMode.INCLUDE ||
        mode === GuardianFeeCategorySelectionMode.INDIVIDUAL) &&
      ids.length === 0
    ) {
      return {
        mode,
        ids,
        categories: [],
        reason: 'At least one fee category ID is required',
      };
    }
    if (ids.length === 0) {
      return { mode, ids, categories: [] };
    }

    const categories = await this.feeCategoryRepo.find({
      where: { id: In(ids), schoolId: request.schoolId },
    });
    if (categories.length !== ids.length) {
      return {
        mode,
        ids,
        categories: [],
        reason: 'One or more fee category IDs are invalid for this school',
      };
    }
    return {
      mode,
      ids,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
      })),
    };
  };

  private buildInvoiceWhere = (
    schoolId: string,
    studentIds: string[],
    period: ResolvedPeriod,
  ): FindOptionsWhere<StudentInvoice>[] => {
    const base: FindOptionsWhere<StudentInvoice> = {
      schoolId,
      studentId: In(studentIds),
    };
    if (period.termId && period.sessionId) {
      return [
        { ...base, termId: period.termId },
        { ...base, sessionId: period.sessionId, termId: IsNull() },
      ];
    }
    if (period.termId) return [{ ...base, termId: period.termId }];
    if (period.sessionId) return [{ ...base, sessionId: period.sessionId }];
    return [];
  };

  private buildMetric = (
    invoices: StudentInvoice[],
    categories: CategoryResolution,
    amountBasis: GuardianFeeAmountBasis,
  ): GuardianFeeMetric => {
    const buckets = new Map<string, FeeBucket>();
    const ensureBucket = (id: string, description: string): FeeBucket => {
      const existing = buckets.get(id);
      if (existing) return existing;
      const bucket: FeeBucket = {
        feeCategoryId: id,
        description,
        ...this.emptyAmounts(),
      };
      buckets.set(id, bucket);
      return bucket;
    };

    for (const invoice of invoices) {
      let itemTotal = 0;
      let itemPaid = 0;
      for (const item of invoice.items ?? []) {
        const grossAmount = this.toAmount(item.originalAmount ?? item.amount);
        const netPayableAmount = Math.max(0, this.toAmount(item.amount));
        const rawPaidAmount = Math.max(0, this.toAmount(item.amountPaid));
        const approvedPaymentAmount = Math.min(rawPaidAmount, netPayableAmount);
        const bucket = ensureBucket(
          item.feeCategoryId,
          item.description || 'Fee',
        );
        this.accumulate(bucket, {
          grossAmount,
          netPayableAmount,
          rawPaidAmount,
          approvedPaymentAmount,
          overrideAmount: this.toAmount(item.overrideAmount),
          overrideType: item.overrideType ?? null,
          overrideApprovalStatus: item.overrideApprovalStatus ?? null,
        });
        itemTotal += netPayableAmount;
        itemPaid += rawPaidAmount;
      }

      const uncoveredGross = Math.max(
        0,
        this.toAmount(invoice.totalAmount) - itemTotal,
      );
      const uncoveredPaid = Math.max(
        0,
        this.toAmount(invoice.totalPaid) - itemPaid,
      );
      if (uncoveredGross > 0 || uncoveredPaid > 0) {
        const bucket = ensureBucket(UNCATEGORIZED_FEE_ID, 'Uncategorized fees');
        this.accumulate(bucket, {
          grossAmount: uncoveredGross,
          netPayableAmount: uncoveredGross,
          rawPaidAmount: uncoveredPaid,
          approvedPaymentAmount: Math.min(uncoveredPaid, uncoveredGross),
          overrideAmount: 0,
          overrideType: null,
          overrideApprovalStatus: null,
        });
      }
    }

    const selectedBuckets = this.selectBuckets(
      Array.from(buckets.values()),
      categories,
    );
    if (selectedBuckets.length === 0) {
      if (buckets.size === 0) {
        return this.unavailableMetric(
          GuardianFeeEvaluationStatus.NO_APPLICABLE_INVOICES,
          'No applicable invoices',
          amountBasis,
          categories.categories,
        );
      }
      return this.unavailableMetric(
        GuardianFeeEvaluationStatus.NO_MATCHING_CATEGORIES,
        'No applicable fee categories matched the selection',
        amountBasis,
        categories.categories,
      );
    }

    for (const bucket of selectedBuckets) this.finalizeAmounts(bucket);
    const aggregate = this.aggregateAmounts(selectedBuckets, amountBasis);
    const categoryFacts: GuardianFeeCategoryFact[] = selectedBuckets
      .filter((bucket) => bucket.feeCategoryId !== UNCATEGORIZED_FEE_ID)
      .map((bucket) => this.toCategoryFact(bucket));
    const uncategorized = selectedBuckets.find(
      (bucket) => bucket.feeCategoryId === UNCATEGORIZED_FEE_ID,
    );

    const fullyWaived =
      aggregate.grossAmount > 0 &&
      aggregate.netPayableAmount === 0 &&
      aggregate.nonCashSettledAmount > 0;
    const zeroValue = aggregate.grossAmount === 0;
    const status = fullyWaived
      ? GuardianFeeEvaluationStatus.FULLY_WAIVED
      : zeroValue
        ? GuardianFeeEvaluationStatus.ZERO_VALUE_OBLIGATION
        : GuardianFeeEvaluationStatus.AVAILABLE;
    const reasons: string[] = [];
    if (fullyWaived) {
      reasons.push(
        'Obligation is fully settled by approved non-cash adjustments',
      );
    }
    if (zeroValue) {
      reasons.push('No positive fee obligation was found');
    }
    if (uncategorized) {
      reasons.push(
        'Invoice-level amounts without a fee category were included',
      );
    }

    const unavailable: GuardianFeeUnavailable = {};
    if (aggregate.actualPaymentPercentage === undefined) {
      unavailable.feePaymentPercentage =
        'Actual payment percentage is unavailable for a zero cash obligation';
      unavailable.actualPaymentPercentage = unavailable.feePaymentPercentage;
    }
    if (aggregate.settledObligationPercentage === undefined) {
      unavailable.settledObligationPercentage =
        'Settled obligation percentage is unavailable for a zero value obligation';
    }
    if (status === GuardianFeeEvaluationStatus.ZERO_VALUE_OBLIGATION) {
      unavailable.outstandingBalance = reasons[0];
    }

    const legacyPercentage =
      amountBasis === GuardianFeeAmountBasis.SETTLED_OBLIGATION
        ? aggregate.settledObligationPercentage
        : aggregate.actualPaymentPercentage;
    const legacyOutstanding =
      amountBasis === GuardianFeeAmountBasis.SETTLED_OBLIGATION
        ? aggregate.obligationOutstandingBalance
        : aggregate.cashOutstandingBalance;

    return {
      ...aggregate,
      totalAmount: aggregate.totalAmount,
      totalPaid: aggregate.totalPaid,
      outstandingBalance: legacyOutstanding,
      feePaymentPercentage: legacyPercentage,
      paymentPercentage: legacyPercentage,
      status: aggregate.status,
      aggregate,
      unavailable,
      evaluationStatus: status,
      reasons,
      amountBasis,
      selectedCategories: categories.categories,
      categories: categoryFacts,
      uncategorized: uncategorized
        ? this.toCategoryFact(uncategorized)
        : undefined,
    };
  };

  private selectBuckets = (
    buckets: FeeBucket[],
    categories: CategoryResolution,
  ): FeeBucket[] => {
    if (categories.mode === GuardianFeeCategorySelectionMode.ALL) {
      return buckets;
    }
    const ids = new Set(categories.ids);
    if (
      categories.mode === GuardianFeeCategorySelectionMode.INCLUDE ||
      categories.mode === GuardianFeeCategorySelectionMode.INDIVIDUAL
    ) {
      return buckets.filter((bucket) => ids.has(bucket.feeCategoryId));
    }
    return buckets.filter((bucket) => !ids.has(bucket.feeCategoryId));
  };

  private accumulate = (
    bucket: FeeBucket,
    input: {
      grossAmount: number;
      netPayableAmount: number;
      rawPaidAmount: number;
      approvedPaymentAmount: number;
      overrideAmount: number;
      overrideType: FeeOverrideType | null;
      overrideApprovalStatus: FeeOverrideApprovalStatus | null;
    },
  ): void => {
    bucket.grossAmount += input.grossAmount;
    bucket.netPayableAmount += input.netPayableAmount;
    bucket.approvedPaymentAmount += input.approvedPaymentAmount;
    bucket.overpaymentAmount += Math.max(
      0,
      input.rawPaidAmount - input.netPayableAmount,
    );

    const approvedOverride =
      input.overrideApprovalStatus === FeeOverrideApprovalStatus.APPROVED;
    const reduction = Math.min(
      Math.max(0, input.overrideAmount),
      Math.max(0, input.grossAmount - input.netPayableAmount),
    );
    if (approvedOverride && input.overrideType === FeeOverrideType.DISCOUNT) {
      bucket.discountAmount += reduction;
    } else if (
      approvedOverride &&
      input.overrideType === FeeOverrideType.SCHOLARSHIP
    ) {
      bucket.scholarshipAmount += reduction;
    } else if (
      approvedOverride &&
      input.overrideType === FeeOverrideType.WAIVER
    ) {
      bucket.waiverAmount += reduction;
    } else if (
      approvedOverride &&
      input.overrideType === FeeOverrideType.ADJUSTMENT
    ) {
      bucket.adjustmentAmount += reduction;
    }
    bucket.nonCashSettledAmount =
      bucket.discountAmount + bucket.scholarshipAmount + bucket.waiverAmount;
    bucket.settledAmount = Math.min(
      bucket.netPayableAmount,
      bucket.approvedPaymentAmount + bucket.nonCashSettledAmount,
    );
    bucket.cashOutstandingBalance = Math.max(
      0,
      bucket.netPayableAmount - bucket.approvedPaymentAmount,
    );
    bucket.obligationOutstandingBalance = Math.max(
      0,
      bucket.netPayableAmount -
        bucket.approvedPaymentAmount -
        bucket.nonCashSettledAmount,
    );
  };

  private finalizeAmounts = (amounts: MutableFeeAmounts): void => {
    amounts.actualPaymentPercentage =
      amounts.netPayableAmount > 0
        ? this.toPercentage(
            amounts.approvedPaymentAmount,
            amounts.netPayableAmount,
          )
        : undefined;
    amounts.settledObligationPercentage =
      amounts.netPayableAmount > 0
        ? this.toPercentage(amounts.settledAmount, amounts.netPayableAmount)
        : amounts.grossAmount > 0 && amounts.nonCashSettledAmount > 0
          ? 100
          : undefined;
  };

  private aggregateAmounts = (
    buckets: FeeBucket[],
    amountBasis: GuardianFeeAmountBasis,
  ): GuardianFeeAggregateFact => {
    const aggregate: GuardianFeeAggregateFact = {
      totalAmount: 0,
      totalPaid: 0,
      status: InvoiceStatus.OPEN,
      ...this.emptyAmounts(),
    };
    for (const bucket of buckets) {
      aggregate.grossAmount += bucket.grossAmount;
      aggregate.netPayableAmount += bucket.netPayableAmount;
      aggregate.discountAmount += bucket.discountAmount;
      aggregate.scholarshipAmount += bucket.scholarshipAmount;
      aggregate.waiverAmount += bucket.waiverAmount;
      aggregate.adjustmentAmount += bucket.adjustmentAmount;
      aggregate.nonCashSettledAmount += bucket.nonCashSettledAmount;
      aggregate.approvedPaymentAmount += bucket.approvedPaymentAmount;
      aggregate.settledAmount += bucket.settledAmount;
      aggregate.cashOutstandingBalance += bucket.cashOutstandingBalance;
      aggregate.obligationOutstandingBalance +=
        bucket.obligationOutstandingBalance;
      aggregate.overpaymentAmount += bucket.overpaymentAmount;
    }
    aggregate.totalAmount = aggregate.netPayableAmount;
    aggregate.totalPaid = aggregate.approvedPaymentAmount;
    this.finalizeAmounts(aggregate);
    const outstanding =
      amountBasis === GuardianFeeAmountBasis.SETTLED_OBLIGATION
        ? aggregate.obligationOutstandingBalance
        : aggregate.cashOutstandingBalance;
    const madePayment =
      amountBasis === GuardianFeeAmountBasis.SETTLED_OBLIGATION
        ? aggregate.settledAmount
        : aggregate.approvedPaymentAmount;
    aggregate.status =
      outstanding <= 0 && aggregate.netPayableAmount > 0
        ? InvoiceStatus.PAID
        : madePayment > 0
          ? InvoiceStatus.PARTIALLY_PAID
          : InvoiceStatus.OPEN;
    return aggregate;
  };

  private toCategoryFact = (bucket: FeeBucket): GuardianFeeCategoryFact => ({
    feeCategoryId: bucket.feeCategoryId,
    description: bucket.description,
    grossAmount: bucket.grossAmount,
    netPayableAmount: bucket.netPayableAmount,
    discountAmount: bucket.discountAmount,
    scholarshipAmount: bucket.scholarshipAmount,
    waiverAmount: bucket.waiverAmount,
    adjustmentAmount: bucket.adjustmentAmount,
    nonCashSettledAmount: bucket.nonCashSettledAmount,
    approvedPaymentAmount: bucket.approvedPaymentAmount,
    settledAmount: bucket.settledAmount,
    cashOutstandingBalance: bucket.cashOutstandingBalance,
    obligationOutstandingBalance: bucket.obligationOutstandingBalance,
    overpaymentAmount: bucket.overpaymentAmount,
    actualPaymentPercentage: bucket.actualPaymentPercentage,
    settledObligationPercentage: bucket.settledObligationPercentage,
  });

  private unavailableMetric = (
    status: GuardianFeeEvaluationStatus,
    reason: string,
    amountBasis: GuardianFeeAmountBasis,
    selectedCategories: Array<{ id: string; name: string }> = [],
  ): GuardianFeeMetric => ({
    ...this.emptyAmounts(),
    unavailable: {
      feePaymentPercentage: reason,
      outstandingBalance: reason,
      actualPaymentPercentage: reason,
      settledObligationPercentage: reason,
    },
    evaluationStatus: status,
    reasons: [reason],
    amountBasis,
    selectedCategories,
    categories: [],
  });

  private emptyAmounts = (): GuardianFeeAmounts => ({
    grossAmount: 0,
    netPayableAmount: 0,
    discountAmount: 0,
    scholarshipAmount: 0,
    waiverAmount: 0,
    adjustmentAmount: 0,
    nonCashSettledAmount: 0,
    approvedPaymentAmount: 0,
    settledAmount: 0,
    cashOutstandingBalance: 0,
    obligationOutstandingBalance: 0,
    overpaymentAmount: 0,
  });

  private toAmount = (value: number | string | null | undefined): number => {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  private toPercentage = (numerator: number, denominator: number): number => {
    if (denominator <= 0) return 0;
    const scaled =
      (BigInt(Math.round(numerator)) * 10000n) / BigInt(denominator);
    const percentage = Number(scaled) / 100;
    return Math.min(100, Math.max(0, percentage));
  };
}

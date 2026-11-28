import { InvoiceStatus } from '../../fees/entities/student-invoice.entity';
import { GuardianFeeMetricScope } from '../enums/guardian-condition.enums';

export enum GuardianFeeCategorySelectionMode {
  ALL = 'ALL',
  INCLUDE = 'INCLUDE',
  EXCLUDE = 'EXCLUDE',
  INDIVIDUAL = 'INDIVIDUAL',
}

export enum GuardianFeeAmountBasis {
  ACTUAL_PAYMENT = 'ACTUAL_PAYMENT',
  SETTLED_OBLIGATION = 'SETTLED_OBLIGATION',
}

export enum GuardianFeeEvaluationStatus {
  AVAILABLE = 'AVAILABLE',
  NO_ACTIVE_TERM = 'NO_ACTIVE_TERM',
  AMBIGUOUS_ACTIVE_TERM = 'AMBIGUOUS_ACTIVE_TERM',
  NO_ACTIVE_SESSION = 'NO_ACTIVE_SESSION',
  NO_APPLICABLE_INVOICES = 'NO_APPLICABLE_INVOICES',
  NO_MATCHING_CATEGORIES = 'NO_MATCHING_CATEGORIES',
  INVALID_FEE_CATEGORY = 'INVALID_FEE_CATEGORY',
  ZERO_VALUE_OBLIGATION = 'ZERO_VALUE_OBLIGATION',
  FULLY_WAIVED = 'FULLY_WAIVED',
}

export interface GuardianFeeUnavailable {
  feePaymentPercentage?: string;
  outstandingBalance?: string;
  actualPaymentPercentage?: string;
  settledObligationPercentage?: string;
}

export interface GuardianFeeAmounts {
  grossAmount: number;
  netPayableAmount: number;
  discountAmount: number;
  scholarshipAmount: number;
  waiverAmount: number;
  adjustmentAmount: number;
  nonCashSettledAmount: number;
  approvedPaymentAmount: number;
  settledAmount: number;
  cashOutstandingBalance: number;
  obligationOutstandingBalance: number;
  overpaymentAmount: number;
  actualPaymentPercentage?: number;
  settledObligationPercentage?: number;
}

export interface GuardianFeeCategoryFact extends GuardianFeeAmounts {
  feeCategoryId: string;
  description: string;
}

export interface GuardianFeeAggregateFact extends GuardianFeeAmounts {
  totalAmount: number;
  totalPaid: number;
  status: InvoiceStatus;
}

export interface GuardianFeeMetric extends GuardianFeeAmounts {
  totalAmount?: number;
  totalPaid?: number;
  outstandingBalance?: number;
  feePaymentPercentage?: number;
  paymentPercentage?: number;
  status?: InvoiceStatus;
  unavailable: GuardianFeeUnavailable;
  evaluationStatus?: GuardianFeeEvaluationStatus;
  reasons?: string[];
  amountBasis?: GuardianFeeAmountBasis;
  selectedCategories?: Array<{ id: string; name: string }>;
  categories?: GuardianFeeCategoryFact[];
  aggregate?: GuardianFeeAggregateFact;
  uncategorized?: GuardianFeeCategoryFact;
}

export interface GuardianFeeMetricRequest {
  schoolId: string;
  studentId: string;
  sessionId?: string | null;
  termId?: string | null;
  scope?: GuardianFeeMetricScope;
  feeSelectionMode?: GuardianFeeCategorySelectionMode;
  feeCategoryIds?: string[];
  amountBasis?: GuardianFeeAmountBasis;
}

export interface GuardianFeeFactsRequest {
  schoolId: string;
  studentIds: string[];
  sessionId?: string | null;
  termId?: string | null;
  scope?: GuardianFeeMetricScope;
  feeSelectionMode?: GuardianFeeCategorySelectionMode;
  feeCategoryIds?: string[];
  amountBasis?: GuardianFeeAmountBasis;
}

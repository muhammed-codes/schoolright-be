import {
  GuardianConditionField,
  GuardianConditionNodeType,
} from '../enums/guardian-condition.enums';
import {
  GuardianFeeAmountBasis,
  GuardianFeeCategorySelectionMode,
  GuardianFeeEvaluationStatus,
  GuardianFeeMetric,
  GuardianFeeUnavailable,
} from './guardian-fee-facts.interface';
import {
  GuardianConditionGroup,
  GuardianConditionLeaf,
  GuardianConditionNode,
  GuardianFeeConditionConfig,
  GuardianStudentMetrics,
} from './guardian-condition.interface';

export const DEFAULT_GUARDIAN_FEE_METRIC_KEY = 'ALL|ACTUAL_PAYMENT|';

const HARD_UNAVAILABLE_STATUSES = new Set([
  GuardianFeeEvaluationStatus.NO_ACTIVE_TERM,
  GuardianFeeEvaluationStatus.AMBIGUOUS_ACTIVE_TERM,
  GuardianFeeEvaluationStatus.NO_ACTIVE_SESSION,
  GuardianFeeEvaluationStatus.NO_APPLICABLE_INVOICES,
  GuardianFeeEvaluationStatus.NO_MATCHING_CATEGORIES,
  GuardianFeeEvaluationStatus.INVALID_FEE_CATEGORY,
]);

export const defaultAmountBasisForField = (
  field: GuardianConditionField,
): GuardianFeeAmountBasis =>
  field === GuardianConditionField.FEE_SETTLED_PERCENTAGE
    ? GuardianFeeAmountBasis.SETTLED_OBLIGATION
    : GuardianFeeAmountBasis.ACTUAL_PAYMENT;

export const normalizeGuardianFeeConditionConfig = (
  config?: Partial<GuardianFeeConditionConfig> | null,
  fallbackBasis: GuardianFeeAmountBasis = GuardianFeeAmountBasis.ACTUAL_PAYMENT,
): GuardianFeeConditionConfig => {
  const selectionMode =
    config?.selectionMode ?? GuardianFeeCategorySelectionMode.ALL;
  const categoryIds = Array.from(
    new Set((config?.categoryIds ?? []).filter((id) => Boolean(id))),
  ).sort();
  return {
    selectionMode,
    categoryIds:
      selectionMode === GuardianFeeCategorySelectionMode.ALL ? [] : categoryIds,
    amountBasis: config?.amountBasis ?? fallbackBasis,
  };
};

export const guardianFeeMetricKey = (
  config?: Partial<GuardianFeeConditionConfig> | null,
  fallbackBasis: GuardianFeeAmountBasis = GuardianFeeAmountBasis.ACTUAL_PAYMENT,
): string => {
  const normalized = normalizeGuardianFeeConditionConfig(config, fallbackBasis);
  return `${normalized.selectionMode}|${normalized.amountBasis}|${normalized.categoryIds.join(',')}`;
};

export const guardianFeeConfigForLeaf = (
  leaf: GuardianConditionLeaf,
): GuardianFeeConditionConfig =>
  normalizeGuardianFeeConditionConfig(
    leaf.fee,
    defaultAmountBasisForField(leaf.field),
  );

export const collectGuardianFeeConditionConfigs = (
  condition: GuardianConditionGroup | null | undefined,
): Map<string, GuardianFeeConditionConfig> => {
  const configs = new Map<string, GuardianFeeConditionConfig>([
    [DEFAULT_GUARDIAN_FEE_METRIC_KEY, normalizeGuardianFeeConditionConfig()],
  ]);
  if (!condition) return configs;

  const visit = (node: GuardianConditionNode): void => {
    if (node.type === GuardianConditionNodeType.CONDITION) {
      const config = guardianFeeConfigForLeaf(node);
      configs.set(guardianFeeMetricKey(config), config);
      return;
    }
    node.conditions.forEach(visit);
  };
  visit(condition);
  return configs;
};

export const isHardUnavailableFeeMetric = (
  metric: GuardianFeeMetric | undefined,
): boolean =>
  Boolean(
    metric?.evaluationStatus &&
    HARD_UNAVAILABLE_STATUSES.has(metric.evaluationStatus),
  );

export const emptyGuardianFeeMetric = (): GuardianFeeMetric => ({
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
  unavailable: {},
});

export const legacyGuardianFeeMetric = (
  metrics: GuardianStudentMetrics,
): GuardianFeeMetric => {
  const unavailable: GuardianFeeUnavailable = {
    ...(metrics.unavailable ?? {}),
  };
  return {
    ...emptyGuardianFeeMetric(),
    feePaymentPercentage: metrics.feePaymentPercentage,
    outstandingBalance: metrics.outstandingBalance,
    unavailable,
  };
};

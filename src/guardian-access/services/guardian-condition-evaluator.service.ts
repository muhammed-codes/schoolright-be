import { Injectable } from '@nestjs/common';
import {
  GuardianConditionCombinator,
  GuardianConditionField,
  GuardianConditionNodeType,
  GuardianConditionOperator,
} from '../enums/guardian-condition.enums';
import {
  GuardianConditionDetail,
  GuardianConditionEvaluation,
  GuardianConditionGroup,
  GuardianConditionLeaf,
  GuardianConditionNode,
  GuardianConditionValue,
  GuardianStudentMetrics,
} from '../interfaces/guardian-condition.interface';
import { GuardianFeeMetric } from '../interfaces/guardian-fee-facts.interface';
import {
  DEFAULT_GUARDIAN_FEE_METRIC_KEY,
  guardianFeeConfigForLeaf,
  guardianFeeMetricKey,
  isHardUnavailableFeeMetric,
  legacyGuardianFeeMetric,
} from '../interfaces/guardian-fee-condition.util';

@Injectable()
export class GuardianConditionEvaluator {
  evaluate = (
    condition: GuardianConditionGroup | null | undefined,
    metrics: GuardianStudentMetrics,
  ): GuardianConditionEvaluation => {
    if (!condition) {
      return { matched: true, unavailableReasons: [], details: [] };
    }
    return this.evaluateNode(condition, metrics);
  };

  private evaluateNode = (
    node: GuardianConditionNode,
    metrics: GuardianStudentMetrics,
  ): GuardianConditionEvaluation => {
    if (node.type === GuardianConditionNodeType.CONDITION) {
      return this.evaluateLeaf(node, metrics);
    }
    const childResults = node.conditions.map((child) =>
      this.evaluateNode(child, metrics),
    );
    const unavailableReasons = childResults.flatMap(
      (result) => result.unavailableReasons,
    );
    const details = childResults.flatMap((result) => result.details);
    const matched =
      node.combinator === GuardianConditionCombinator.AND
        ? childResults.every((result) => result.matched) &&
          unavailableReasons.length === 0
        : childResults.some((result) => result.matched);
    const effectiveUnavailableReasons =
      node.combinator === GuardianConditionCombinator.OR && matched
        ? []
        : unavailableReasons;
    return {
      matched,
      unavailableReasons: effectiveUnavailableReasons,
      details,
    };
  };

  private evaluateLeaf = (
    leaf: GuardianConditionLeaf,
    metrics: GuardianStudentMetrics,
  ): GuardianConditionEvaluation => {
    const feeConfig = this.isFeeField(leaf.field)
      ? guardianFeeConfigForLeaf(leaf)
      : undefined;
    const actualValue = this.resolveFieldValue(leaf, metrics);
    const detail = (
      matched: boolean,
      reason?: string,
    ): GuardianConditionDetail => ({
      field: leaf.field,
      operator: leaf.operator,
      value: leaf.value,
      ...(feeConfig ? { fee: feeConfig } : {}),
      matched,
      ...(reason ? { reason } : {}),
    });
    if (actualValue.unavailableReason) {
      return {
        matched: false,
        unavailableReasons: [actualValue.unavailableReason],
        details: [detail(false, actualValue.unavailableReason)],
      };
    }
    const matched = this.compare(actualValue.value, leaf.operator, leaf.value);
    return {
      matched,
      unavailableReasons: [],
      details: [detail(matched)],
    };
  };

  private isFeeField = (field: GuardianConditionField): boolean =>
    field !== GuardianConditionField.STUDENT_CLASS &&
    field !== GuardianConditionField.STUDENT_STATUS;

  private resolveFieldValue = (
    leaf: GuardianConditionLeaf,
    metrics: GuardianStudentMetrics,
  ): { value?: string | number | null; unavailableReason?: string } => {
    switch (leaf.field) {
      case GuardianConditionField.STUDENT_CLASS:
        return { value: metrics.studentClassId ?? null };
      case GuardianConditionField.STUDENT_STATUS:
        return { value: metrics.studentStatus };
      default:
        return this.resolveFeeFieldValue(leaf, metrics);
    }
  };

  private resolveFeeFieldValue = (
    leaf: GuardianConditionLeaf,
    metrics: GuardianStudentMetrics,
  ): { value?: string | number | null; unavailableReason?: string } => {
    const config = guardianFeeConfigForLeaf(leaf);
    const key = guardianFeeMetricKey(config);
    const metric =
      metrics.feeMetrics?.[key] ??
      (key === DEFAULT_GUARDIAN_FEE_METRIC_KEY
        ? legacyGuardianFeeMetric(metrics)
        : undefined);
    if (!metric) {
      return {
        unavailableReason: `Fee condition was not evaluated for ${key}`,
      };
    }
    if (isHardUnavailableFeeMetric(metric)) {
      return {
        unavailableReason:
          metric.reasons?.[0] ?? 'Fee information is unavailable',
      };
    }
    const value = this.readFeeField(leaf.field, metric);
    if (value === undefined) {
      return {
        unavailableReason: this.resolveFeeUnavailableReason(leaf.field, metric),
      };
    }
    return { value };
  };

  private readFeeField = (
    field: GuardianConditionField,
    metric: GuardianFeeMetric,
  ): string | number | undefined => {
    switch (field) {
      case GuardianConditionField.FEE_PAYMENT_PERCENTAGE:
        return metric.feePaymentPercentage;
      case GuardianConditionField.FEE_SETTLED_PERCENTAGE:
        return metric.settledObligationPercentage;
      case GuardianConditionField.OUTSTANDING_BALANCE:
      case GuardianConditionField.FEE_OUTSTANDING_BALANCE:
        return metric.outstandingBalance;
      case GuardianConditionField.FEE_PAID_AMOUNT:
        return metric.approvedPaymentAmount;
      case GuardianConditionField.FEE_TOTAL_AMOUNT:
        return metric.totalAmount ?? metric.netPayableAmount;
      case GuardianConditionField.FEE_NET_PAYABLE_AMOUNT:
        return metric.netPayableAmount;
      case GuardianConditionField.FEE_GROSS_AMOUNT:
        return metric.grossAmount;
      case GuardianConditionField.FEE_SETTLED_AMOUNT:
        return metric.settledAmount;
      case GuardianConditionField.FEE_EVALUATION_STATUS:
        return metric.evaluationStatus;
      default:
        return undefined;
    }
  };

  private resolveFeeUnavailableReason = (
    field: GuardianConditionField,
    metric: GuardianFeeMetric,
  ): string => {
    if (
      field === GuardianConditionField.FEE_PAYMENT_PERCENTAGE ||
      field === GuardianConditionField.FEE_SETTLED_PERCENTAGE
    ) {
      return (
        (field === GuardianConditionField.FEE_SETTLED_PERCENTAGE
          ? metric.unavailable.settledObligationPercentage
          : (metric.unavailable.feePaymentPercentage ??
            metric.unavailable.actualPaymentPercentage)) ??
        'Fee percentage is unavailable'
      );
    }
    if (
      field === GuardianConditionField.OUTSTANDING_BALANCE ||
      field === GuardianConditionField.FEE_OUTSTANDING_BALANCE
    ) {
      return (
        metric.unavailable.outstandingBalance ??
        'Outstanding balance is unavailable'
      );
    }
    return metric.reasons?.[0] ?? 'Fee information is unavailable';
  };

  private compare = (
    actual: string | number | null | undefined,
    operator: GuardianConditionOperator,
    expected: GuardianConditionValue,
  ): boolean => {
    if (operator === GuardianConditionOperator.IN) {
      return (
        Array.isArray(expected) && expected.some((item) => item === actual)
      );
    }
    if (operator === GuardianConditionOperator.NOT_IN) {
      return (
        Array.isArray(expected) && !expected.some((item) => item === actual)
      );
    }
    if (typeof actual === 'number' && typeof expected === 'number') {
      switch (operator) {
        case GuardianConditionOperator.EQUALS:
          return actual === expected;
        case GuardianConditionOperator.NOT_EQUALS:
          return actual !== expected;
        case GuardianConditionOperator.GREATER_THAN:
          return actual > expected;
        case GuardianConditionOperator.GREATER_THAN_OR_EQUAL:
          return actual >= expected;
        case GuardianConditionOperator.LESS_THAN:
          return actual < expected;
        case GuardianConditionOperator.LESS_THAN_OR_EQUAL:
          return actual <= expected;
        default:
          return false;
      }
    }
    if (typeof actual === 'string' && typeof expected === 'string') {
      switch (operator) {
        case GuardianConditionOperator.EQUALS:
          return actual === expected;
        case GuardianConditionOperator.NOT_EQUALS:
          return actual !== expected;
        default:
          return false;
      }
    }
    return false;
  };
}

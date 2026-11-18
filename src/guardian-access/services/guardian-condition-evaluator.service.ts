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
    const actualValue = this.resolveFieldValue(leaf.field, metrics);
    const detail = (
      matched: boolean,
      reason?: string,
    ): GuardianConditionDetail => ({
      field: leaf.field,
      operator: leaf.operator,
      value: leaf.value,
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

  private resolveFieldValue = (
    field: GuardianConditionField,
    metrics: GuardianStudentMetrics,
  ): { value?: string | number | null; unavailableReason?: string } => {
    switch (field) {
      case GuardianConditionField.STUDENT_CLASS:
        return { value: metrics.studentClassId ?? null };
      case GuardianConditionField.STUDENT_STATUS:
        return { value: metrics.studentStatus };
      case GuardianConditionField.FEE_PAYMENT_PERCENTAGE:
        return metrics.feePaymentPercentage === undefined
          ? {
              unavailableReason:
                metrics.unavailable.feePaymentPercentage ??
                'Fee payment percentage is unavailable',
            }
          : { value: metrics.feePaymentPercentage };
      case GuardianConditionField.OUTSTANDING_BALANCE:
        return metrics.outstandingBalance === undefined
          ? {
              unavailableReason:
                metrics.unavailable.outstandingBalance ??
                'Outstanding balance is unavailable',
            }
          : { value: metrics.outstandingBalance };
      default:
        return { unavailableReason: 'Unsupported condition field' };
    }
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

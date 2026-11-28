import {
  GuardianConditionCombinator,
  GuardianConditionField,
  GuardianConditionNodeType,
  GuardianConditionOperator,
} from '../enums/guardian-condition.enums';
import type {
  GuardianFeeAmountBasis,
  GuardianFeeCategorySelectionMode,
  GuardianFeeMetric,
} from './guardian-fee-facts.interface';

export type GuardianConditionValue = string | number | Array<string | number>;

export interface GuardianFeeConditionConfig {
  selectionMode: GuardianFeeCategorySelectionMode;
  categoryIds: string[];
  amountBasis: GuardianFeeAmountBasis;
}

export interface GuardianConditionLeaf {
  type: GuardianConditionNodeType.CONDITION;
  field: GuardianConditionField;
  operator: GuardianConditionOperator;
  value: GuardianConditionValue;
  fee?: GuardianFeeConditionConfig;
}

export interface GuardianConditionGroup {
  type: GuardianConditionNodeType.GROUP;
  combinator: GuardianConditionCombinator;
  conditions: GuardianConditionNode[];
}

export type GuardianConditionNode =
  | GuardianConditionLeaf
  | GuardianConditionGroup;

export interface GuardianConditionDetail {
  field: GuardianConditionField | null;
  operator: GuardianConditionOperator | null;
  value: GuardianConditionValue | null;
  fee?: GuardianFeeConditionConfig;
  matched: boolean;
  reason?: string;
}

export interface GuardianConditionEvaluation {
  matched: boolean;
  unavailableReasons: string[];
  details: GuardianConditionDetail[];
}

export interface GuardianStudentMetrics {
  studentClassId?: string | null;
  studentStatus: string;
  feePaymentPercentage?: number;
  outstandingBalance?: number;
  feeMetrics?: Record<string, GuardianFeeMetric>;
  unavailable: {
    feePaymentPercentage?: string;
    outstandingBalance?: string;
  };
}

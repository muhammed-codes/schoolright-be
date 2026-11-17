import {
  GuardianConditionCombinator,
  GuardianConditionField,
  GuardianConditionNodeType,
  GuardianConditionOperator,
} from '../enums/guardian-condition.enums';

export type GuardianConditionValue = string | number | Array<string | number>;

export interface GuardianConditionLeaf {
  type: GuardianConditionNodeType.CONDITION;
  field: GuardianConditionField;
  operator: GuardianConditionOperator;
  value: GuardianConditionValue;
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
  unavailable: {
    feePaymentPercentage?: string;
    outstandingBalance?: string;
  };
}

import { registerEnumType } from '@nestjs/graphql';

export enum GuardianConditionField {
  STUDENT_CLASS = 'STUDENT_CLASS',
  STUDENT_STATUS = 'STUDENT_STATUS',
  FEE_PAYMENT_PERCENTAGE = 'FEE_PAYMENT_PERCENTAGE',
  OUTSTANDING_BALANCE = 'OUTSTANDING_BALANCE',
  FEE_SETTLED_PERCENTAGE = 'FEE_SETTLED_PERCENTAGE',
  FEE_PAID_AMOUNT = 'FEE_PAID_AMOUNT',
  FEE_OUTSTANDING_BALANCE = 'FEE_OUTSTANDING_BALANCE',
  FEE_TOTAL_AMOUNT = 'FEE_TOTAL_AMOUNT',
  FEE_NET_PAYABLE_AMOUNT = 'FEE_NET_PAYABLE_AMOUNT',
  FEE_GROSS_AMOUNT = 'FEE_GROSS_AMOUNT',
  FEE_SETTLED_AMOUNT = 'FEE_SETTLED_AMOUNT',
  FEE_EVALUATION_STATUS = 'FEE_EVALUATION_STATUS',
}

export enum GuardianConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  GREATER_THAN_OR_EQUAL = 'GREATER_THAN_OR_EQUAL',
  LESS_THAN = 'LESS_THAN',
  LESS_THAN_OR_EQUAL = 'LESS_THAN_OR_EQUAL',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
}

export enum GuardianConditionNodeType {
  GROUP = 'GROUP',
  CONDITION = 'CONDITION',
}

export enum GuardianConditionCombinator {
  AND = 'AND',
  OR = 'OR',
}

export enum GuardianFeeMetricScope {
  ACTIVE_TERM_AND_SESSION_INVOICES = 'ACTIVE_TERM_AND_SESSION_INVOICES',
}

registerEnumType(GuardianConditionField, { name: 'GuardianConditionField' });
registerEnumType(GuardianConditionOperator, {
  name: 'GuardianConditionOperator',
});
registerEnumType(GuardianConditionNodeType, {
  name: 'GuardianConditionNodeType',
});
registerEnumType(GuardianConditionCombinator, {
  name: 'GuardianConditionCombinator',
});
registerEnumType(GuardianFeeMetricScope, { name: 'GuardianFeeMetricScope' });

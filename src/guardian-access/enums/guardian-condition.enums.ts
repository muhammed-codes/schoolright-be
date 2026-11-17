import { registerEnumType } from '@nestjs/graphql';

export enum GuardianConditionField {
  STUDENT_CLASS = 'STUDENT_CLASS',
  STUDENT_STATUS = 'STUDENT_STATUS',
  FEE_PAYMENT_PERCENTAGE = 'FEE_PAYMENT_PERCENTAGE',
  OUTSTANDING_BALANCE = 'OUTSTANDING_BALANCE',
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

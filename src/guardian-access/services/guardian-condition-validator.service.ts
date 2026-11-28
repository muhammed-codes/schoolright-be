import { BadRequestException, Injectable } from '@nestjs/common';
import { StudentStatus } from '../../common/enums';
import {
  GuardianConditionCombinator,
  GuardianConditionField,
  GuardianConditionNodeType,
  GuardianConditionOperator,
} from '../enums/guardian-condition.enums';
import {
  GuardianFeeAmountBasis,
  GuardianFeeCategorySelectionMode,
  GuardianFeeEvaluationStatus,
} from '../interfaces/guardian-fee-facts.interface';
import {
  defaultAmountBasisForField,
  normalizeGuardianFeeConditionConfig,
} from '../interfaces/guardian-fee-condition.util';
import {
  GuardianConditionGroup,
  GuardianConditionLeaf,
  GuardianConditionNode,
  GuardianConditionValue,
  GuardianFeeConditionConfig,
} from '../interfaces/guardian-condition.interface';

export const MAX_CONDITION_DEPTH = 4;
export const MAX_CONDITION_COUNT = 30;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STRING_FIELDS = new Set([
  GuardianConditionField.STUDENT_CLASS,
  GuardianConditionField.STUDENT_STATUS,
]);

const STATUS_FIELDS = new Set([GuardianConditionField.FEE_EVALUATION_STATUS]);

const PERCENTAGE_FIELDS = new Set([
  GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
  GuardianConditionField.FEE_SETTLED_PERCENTAGE,
]);

const NUMERIC_FIELDS = new Set([
  GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
  GuardianConditionField.OUTSTANDING_BALANCE,
  GuardianConditionField.FEE_SETTLED_PERCENTAGE,
  GuardianConditionField.FEE_PAID_AMOUNT,
  GuardianConditionField.FEE_OUTSTANDING_BALANCE,
  GuardianConditionField.FEE_TOTAL_AMOUNT,
  GuardianConditionField.FEE_NET_PAYABLE_AMOUNT,
  GuardianConditionField.FEE_GROSS_AMOUNT,
  GuardianConditionField.FEE_SETTLED_AMOUNT,
]);

const FEE_FIELDS = new Set([
  ...PERCENTAGE_FIELDS,
  ...NUMERIC_FIELDS,
  ...STATUS_FIELDS,
]);

const MEMBERSHIP_OPERATORS = new Set([
  GuardianConditionOperator.IN,
  GuardianConditionOperator.NOT_IN,
]);

const NUMERIC_OPERATORS = new Set([
  GuardianConditionOperator.EQUALS,
  GuardianConditionOperator.NOT_EQUALS,
  GuardianConditionOperator.GREATER_THAN,
  GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
  GuardianConditionOperator.LESS_THAN,
  GuardianConditionOperator.LESS_THAN_OR_EQUAL,
]);

@Injectable()
export class GuardianConditionValidator {
  validate = (condition: unknown): GuardianConditionGroup => {
    if (!condition || typeof condition !== 'object') {
      throw new BadRequestException('A condition group is required');
    }
    const counter = { count: 0 };
    const group = this.validateNode(condition, 1, counter);
    if (group.type !== GuardianConditionNodeType.GROUP) {
      throw new BadRequestException('The root condition must be a group');
    }
    return group;
  };

  private validateNode = (
    value: unknown,
    depth: number,
    counter: { count: number },
  ): GuardianConditionNode => {
    if (depth > MAX_CONDITION_DEPTH) {
      throw new BadRequestException('Condition nesting is too deep');
    }
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Malformed condition');
    }
    const node = value as Record<string, unknown>;
    if (node.type === GuardianConditionNodeType.GROUP) {
      if (
        node.combinator !== GuardianConditionCombinator.AND &&
        node.combinator !== GuardianConditionCombinator.OR
      ) {
        throw new BadRequestException('Unsupported condition combinator');
      }
      if (!Array.isArray(node.conditions) || node.conditions.length === 0) {
        throw new BadRequestException('A condition group cannot be empty');
      }
      if (node.conditions.length > MAX_CONDITION_COUNT) {
        throw new BadRequestException('Too many conditions');
      }
      return {
        type: GuardianConditionNodeType.GROUP,
        combinator: node.combinator as GuardianConditionCombinator,
        conditions: node.conditions.map((child: unknown) =>
          this.validateNode(child, depth + 1, counter),
        ),
      };
    }
    if (node.type === GuardianConditionNodeType.CONDITION) {
      counter.count += 1;
      if (counter.count > MAX_CONDITION_COUNT) {
        throw new BadRequestException('Too many conditions');
      }
      return this.validateLeaf(node);
    }
    throw new BadRequestException('Unsupported condition node type');
  };

  private validateLeaf = (
    node: Record<string, unknown>,
  ): GuardianConditionLeaf => {
    const field = node.field;
    const operator = node.operator;
    if (
      typeof field !== 'string' ||
      !Object.values(GuardianConditionField).includes(
        field as GuardianConditionField,
      )
    ) {
      throw new BadRequestException('Unsupported condition field');
    }
    if (
      typeof operator !== 'string' ||
      !Object.values(GuardianConditionOperator).includes(
        operator as GuardianConditionOperator,
      )
    ) {
      throw new BadRequestException('Unsupported condition operator');
    }
    const typedField = field as GuardianConditionField;
    const typedOperator = operator as GuardianConditionOperator;
    const value = this.validateValue(typedField, typedOperator, node.value);
    const fee = this.validateFeeConfig(typedField, node.fee);
    return {
      type: GuardianConditionNodeType.CONDITION,
      field: typedField,
      operator: typedOperator,
      value,
      ...(fee ? { fee } : {}),
    };
  };

  private validateValue = (
    field: GuardianConditionField,
    operator: GuardianConditionOperator,
    rawValue: unknown,
  ): GuardianConditionValue => {
    if (NUMERIC_FIELDS.has(field)) {
      if (!NUMERIC_OPERATORS.has(operator)) {
        throw new BadRequestException('Unsupported operator for this field');
      }
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
        throw new BadRequestException('A numeric value is required');
      }
      if (rawValue < 0) {
        throw new BadRequestException('The value cannot be negative');
      }
      if (PERCENTAGE_FIELDS.has(field) && rawValue > 100) {
        throw new BadRequestException('A percentage cannot exceed 100');
      }
      return rawValue;
    }
    if (STATUS_FIELDS.has(field)) {
      if (
        operator !== GuardianConditionOperator.EQUALS &&
        operator !== GuardianConditionOperator.NOT_EQUALS
      ) {
        throw new BadRequestException('Unsupported operator for this field');
      }
      if (
        typeof rawValue !== 'string' ||
        !Object.values(GuardianFeeEvaluationStatus).includes(
          rawValue as GuardianFeeEvaluationStatus,
        )
      ) {
        throw new BadRequestException(
          'A valid fee evaluation status is required',
        );
      }
      return rawValue;
    }
    if (STRING_FIELDS.has(field)) {
      if (MEMBERSHIP_OPERATORS.has(operator)) {
        if (!Array.isArray(rawValue) || rawValue.length === 0) {
          throw new BadRequestException('A non-empty list is required');
        }
        const values = rawValue.map((item) =>
          this.validateStringValue(field, item),
        );
        return values;
      }
      if (
        operator !== GuardianConditionOperator.EQUALS &&
        operator !== GuardianConditionOperator.NOT_EQUALS
      ) {
        throw new BadRequestException('Unsupported operator for this field');
      }
      return this.validateStringValue(field, rawValue);
    }
    throw new BadRequestException('Unsupported condition field');
  };

  private validateFeeConfig = (
    field: GuardianConditionField,
    rawValue: unknown,
  ): GuardianFeeConditionConfig | undefined => {
    if (rawValue === undefined || rawValue === null) return undefined;
    if (!FEE_FIELDS.has(field)) {
      throw new BadRequestException(
        'Fee settings are not valid for this field',
      );
    }
    if (typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      throw new BadRequestException('Invalid fee condition settings');
    }
    const config = rawValue as Record<string, unknown>;
    const selectionMode = (config.selectionMode ??
      GuardianFeeCategorySelectionMode.ALL) as GuardianFeeCategorySelectionMode;
    if (
      typeof selectionMode !== 'string' ||
      !Object.values(GuardianFeeCategorySelectionMode).includes(selectionMode)
    ) {
      throw new BadRequestException('Invalid fee selection mode');
    }
    const amountBasis = config.amountBasis ?? defaultAmountBasisForField(field);
    if (
      typeof amountBasis !== 'string' ||
      !Object.values(GuardianFeeAmountBasis).includes(
        amountBasis as GuardianFeeAmountBasis,
      )
    ) {
      throw new BadRequestException('Invalid fee amount basis');
    }
    const rawCategoryIds = config.categoryIds ?? [];
    if (!Array.isArray(rawCategoryIds)) {
      throw new BadRequestException('Invalid fee category selection');
    }
    const categoryIds = Array.from(
      new Set(
        rawCategoryIds
          .filter(
            (id): id is string => typeof id === 'string' && Boolean(id.trim()),
          )
          .map((id) => id.trim()),
      ),
    );
    if (
      selectionMode === GuardianFeeCategorySelectionMode.ALL &&
      categoryIds.length > 0
    ) {
      throw new BadRequestException(
        'All fee categories must not include selected category IDs',
      );
    }
    if (
      selectionMode !== GuardianFeeCategorySelectionMode.ALL &&
      categoryIds.length === 0
    ) {
      throw new BadRequestException('Select at least one fee category');
    }
    if (
      selectionMode === GuardianFeeCategorySelectionMode.INDIVIDUAL &&
      categoryIds.length !== 1
    ) {
      throw new BadRequestException(
        'An individual fee category condition requires exactly one category',
      );
    }
    return normalizeGuardianFeeConditionConfig(
      {
        selectionMode: selectionMode,
        categoryIds,
        amountBasis: amountBasis as GuardianFeeAmountBasis,
      },
      amountBasis as GuardianFeeAmountBasis,
    );
  };

  private validateStringValue = (
    field: GuardianConditionField,
    rawValue: unknown,
  ): string => {
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
      throw new BadRequestException('A non-empty string is required');
    }
    if (
      field === GuardianConditionField.STUDENT_CLASS &&
      !UUID_PATTERN.test(rawValue)
    ) {
      throw new BadRequestException('A valid class ID is required');
    }
    if (
      field === GuardianConditionField.STUDENT_STATUS &&
      !Object.values(StudentStatus).includes(rawValue as StudentStatus)
    ) {
      throw new BadRequestException('A valid student status is required');
    }
    return rawValue;
  };
}

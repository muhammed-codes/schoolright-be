import { BadRequestException, Injectable } from '@nestjs/common';
import { StudentStatus } from '../../common/enums';
import {
  GuardianConditionCombinator,
  GuardianConditionField,
  GuardianConditionNodeType,
  GuardianConditionOperator,
} from '../enums/guardian-condition.enums';
import {
  GuardianConditionGroup,
  GuardianConditionLeaf,
  GuardianConditionNode,
  GuardianConditionValue,
} from '../interfaces/guardian-condition.interface';

export const MAX_CONDITION_DEPTH = 4;
export const MAX_CONDITION_COUNT = 30;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STRING_FIELDS = new Set([
  GuardianConditionField.STUDENT_CLASS,
  GuardianConditionField.STUDENT_STATUS,
]);

const NUMERIC_FIELDS = new Set([
  GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
  GuardianConditionField.OUTSTANDING_BALANCE,
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

  private validateLeaf = (node: Record<string, unknown>): GuardianConditionLeaf => {
    const field = node.field;
    const operator = node.operator;
    if (
      typeof field !== 'string' ||
      !Object.values(GuardianConditionField).includes(field as GuardianConditionField)
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
    return {
      type: GuardianConditionNodeType.CONDITION,
      field: typedField,
      operator: typedOperator,
      value,
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
      if (
        field === GuardianConditionField.FEE_PAYMENT_PERCENTAGE &&
        rawValue > 100
      ) {
        throw new BadRequestException('A percentage cannot exceed 100');
      }
      return rawValue;
    }
    if (STRING_FIELDS.has(field)) {
      if (MEMBERSHIP_OPERATORS.has(operator)) {
        if (!Array.isArray(rawValue) || rawValue.length === 0) {
          throw new BadRequestException('A non-empty list is required');
        }
        const values = rawValue.map((item) => this.validateStringValue(field, item));
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

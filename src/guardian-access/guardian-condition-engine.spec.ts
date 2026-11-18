import { BadRequestException } from '@nestjs/common';
import { StudentStatus } from '../common/enums';
import {
  GuardianConditionCombinator,
  GuardianConditionField,
  GuardianConditionNodeType,
  GuardianConditionOperator,
} from './enums/guardian-condition.enums';
import { GuardianConditionEvaluator } from './services/guardian-condition-evaluator.service';
import { GuardianConditionValidator } from './services/guardian-condition-validator.service';

describe('guardian condition engine', () => {
  const validator = new GuardianConditionValidator();
  const evaluator = new GuardianConditionEvaluator();
  const metrics = {
    studentClassId: 'class-a',
    studentStatus: StudentStatus.ACTIVE,
    feePaymentPercentage: 60,
    outstandingBalance: 1000,
    unavailable: {},
  };

  it('validates typed condition trees', () => {
    const condition = validator.validate({
      type: GuardianConditionNodeType.GROUP,
      combinator: GuardianConditionCombinator.AND,
      conditions: [
        {
          type: GuardianConditionNodeType.CONDITION,
          field: GuardianConditionField.STUDENT_STATUS,
          operator: GuardianConditionOperator.EQUALS,
          value: StudentStatus.ACTIVE,
        },
        {
          type: GuardianConditionNodeType.CONDITION,
          field: GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
          operator: GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          value: 50,
        },
      ],
    });
    expect(condition.conditions).toHaveLength(2);
  });

  it('rejects unsupported fields, operators and overly deep trees', () => {
    expect(() =>
      validator.validate({
        type: GuardianConditionNodeType.GROUP,
        combinator: GuardianConditionCombinator.AND,
        conditions: [
          {
            type: GuardianConditionNodeType.CONDITION,
            field: 'ATTENDANCE_PERCENTAGE',
            operator: GuardianConditionOperator.EQUALS,
            value: 80,
          },
        ],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validator.validate({
        type: GuardianConditionNodeType.GROUP,
        combinator: GuardianConditionCombinator.AND,
        conditions: [
          {
            type: GuardianConditionNodeType.CONDITION,
            field: GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
            operator: GuardianConditionOperator.IN,
            value: [50],
          },
        ],
      }),
    ).toThrow(BadRequestException);
    let nested: Record<string, unknown> = {
      type: GuardianConditionNodeType.CONDITION,
      field: GuardianConditionField.STUDENT_STATUS,
      operator: GuardianConditionOperator.EQUALS,
      value: StudentStatus.ACTIVE,
    };
    for (let index = 0; index < 5; index += 1) {
      nested = {
        type: GuardianConditionNodeType.GROUP,
        combinator: GuardianConditionCombinator.AND,
        conditions: [nested],
      };
    }
    expect(() => validator.validate(nested)).toThrow('too deep');
  });

  it('lets a satisfiable OR branch survive an unavailable sibling metric', () => {
    const condition = validator.validate({
      type: GuardianConditionNodeType.GROUP,
      combinator: GuardianConditionCombinator.OR,
      conditions: [
        {
          type: GuardianConditionNodeType.CONDITION,
          field: GuardianConditionField.STUDENT_STATUS,
          operator: GuardianConditionOperator.EQUALS,
          value: StudentStatus.ACTIVE,
        },
        {
          type: GuardianConditionNodeType.CONDITION,
          field: GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
          operator: GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          value: 50,
        },
      ],
    });
    const result = evaluator.evaluate(condition, {
      ...metrics,
      feePaymentPercentage: undefined,
      unavailable: { feePaymentPercentage: 'No invoices' },
    });
    expect(result.matched).toBe(true);
    expect(result.unavailableReasons).toEqual([]);
    expect(
      result.details.some((detail) => detail.reason === 'No invoices'),
    ).toBe(true);
  });

  it('keeps unavailable metrics visible when no OR branch matches', () => {
    const condition = validator.validate({
      type: GuardianConditionNodeType.GROUP,
      combinator: GuardianConditionCombinator.OR,
      conditions: [
        {
          type: GuardianConditionNodeType.CONDITION,
          field: GuardianConditionField.STUDENT_STATUS,
          operator: GuardianConditionOperator.EQUALS,
          value: StudentStatus.SUSPENDED,
        },
        {
          type: GuardianConditionNodeType.CONDITION,
          field: GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
          operator: GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          value: 50,
        },
      ],
    });
    const result = evaluator.evaluate(condition, {
      ...metrics,
      feePaymentPercentage: undefined,
      unavailable: { feePaymentPercentage: 'No invoices' },
    });
    expect(result.matched).toBe(false);
    expect(result.unavailableReasons).toEqual(['No invoices']);
  });

  it('evaluates conditions and reports unavailable metrics', () => {
    const condition = validator.validate({
      type: GuardianConditionNodeType.GROUP,
      combinator: GuardianConditionCombinator.AND,
      conditions: [
        {
          type: GuardianConditionNodeType.CONDITION,
          field: GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
          operator: GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          value: 60,
        },
      ],
    });
    expect(evaluator.evaluate(condition, metrics).matched).toBe(true);
    const result = evaluator.evaluate(condition, {
      ...metrics,
      feePaymentPercentage: undefined,
      unavailable: { feePaymentPercentage: 'No invoices' },
    });
    expect(result.matched).toBe(false);
    expect(result.unavailableReasons).toEqual(['No invoices']);
  });
});

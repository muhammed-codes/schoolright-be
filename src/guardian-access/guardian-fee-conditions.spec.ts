import { BadRequestException } from '@nestjs/common';
import { StudentStatus } from '../common/enums';
import {
  GuardianConditionCombinator,
  GuardianConditionField,
  GuardianConditionNodeType,
  GuardianConditionOperator,
} from './enums/guardian-condition.enums';
import {
  GuardianFeeAmountBasis,
  GuardianFeeCategorySelectionMode,
  GuardianFeeEvaluationStatus,
  GuardianFeeMetric,
} from './interfaces/guardian-fee-facts.interface';
import {
  DEFAULT_GUARDIAN_FEE_METRIC_KEY,
  collectGuardianFeeConditionConfigs,
  guardianFeeMetricKey,
} from './interfaces/guardian-fee-condition.util';
import { GuardianStudentMetrics } from './interfaces/guardian-condition.interface';
import { GuardianConditionEvaluator } from './services/guardian-condition-evaluator.service';
import { GuardianConditionValidator } from './services/guardian-condition-validator.service';

describe('guardian fee conditions', () => {
  const validator = new GuardianConditionValidator();
  const evaluator = new GuardianConditionEvaluator();

  const metric = (
    overrides: Partial<GuardianFeeMetric> = {},
  ): GuardianFeeMetric => ({
    grossAmount: 1000,
    netPayableAmount: 1000,
    discountAmount: 0,
    scholarshipAmount: 0,
    waiverAmount: 0,
    adjustmentAmount: 0,
    nonCashSettledAmount: 0,
    approvedPaymentAmount: 500,
    settledAmount: 500,
    cashOutstandingBalance: 500,
    obligationOutstandingBalance: 500,
    overpaymentAmount: 0,
    feePaymentPercentage: 50,
    settledObligationPercentage: 50,
    outstandingBalance: 500,
    evaluationStatus: GuardianFeeEvaluationStatus.AVAILABLE,
    unavailable: {},
    ...overrides,
  });

  const metrics = (
    entries: Record<string, GuardianFeeMetric> = {},
  ): GuardianStudentMetrics => ({
    studentStatus: StudentStatus.ACTIVE,
    feeMetrics: {
      [DEFAULT_GUARDIAN_FEE_METRIC_KEY]: metric(),
      ...entries,
    },
    unavailable: {},
  });

  const leaf = (
    field: GuardianConditionField,
    operator: GuardianConditionOperator,
    value: string | number,
    fee?: Record<string, unknown>,
  ) => ({
    type: GuardianConditionNodeType.CONDITION,
    field,
    operator,
    value,
    ...(fee ? { fee } : {}),
  });

  const group = (
    combinator: GuardianConditionCombinator,
    conditions: Record<string, unknown>[],
  ) => ({
    type: GuardianConditionNodeType.GROUP,
    combinator,
    conditions,
  });

  const includeConfig = (
    categoryIds: string[],
    basis?: GuardianFeeAmountBasis,
  ) => ({
    selectionMode: GuardianFeeCategorySelectionMode.INCLUDE,
    categoryIds,
    ...(basis ? { amountBasis: basis } : {}),
  });

  it('normalizes fee configs and keys by selection, basis and categories', () => {
    const condition = validator.validate(
      group(GuardianConditionCombinator.AND, [
        leaf(
          GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
          GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          40,
          includeConfig(['cat-b', 'cat-a', 'cat-b']),
        ),
      ]),
    );
    const config = condition.conditions[0];
    expect(config.type).toBe(GuardianConditionNodeType.CONDITION);
    if (config.type !== GuardianConditionNodeType.CONDITION) return;
    expect(config.fee).toEqual({
      selectionMode: GuardianFeeCategorySelectionMode.INCLUDE,
      categoryIds: ['cat-a', 'cat-b'],
      amountBasis: GuardianFeeAmountBasis.ACTUAL_PAYMENT,
    });
    expect(guardianFeeMetricKey(config.fee)).toBe(
      'INCLUDE|ACTUAL_PAYMENT|cat-a,cat-b',
    );
  });

  it('rejects invalid fee selection configs', () => {
    const validate = (fee: Record<string, unknown>) =>
      validator.validate(
        group(GuardianConditionCombinator.AND, [
          leaf(
            GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
            GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
            40,
            fee,
          ),
        ]),
      );
    expect(() =>
      validate({
        selectionMode: GuardianFeeCategorySelectionMode.ALL,
        categoryIds: ['cat-a'],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validate({
        selectionMode: GuardianFeeCategorySelectionMode.INDIVIDUAL,
        categoryIds: ['cat-a', 'cat-b'],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validate({
        selectionMode: GuardianFeeCategorySelectionMode.INCLUDE,
        amountBasis: 'UNKNOWN',
        categoryIds: ['cat-a'],
      }),
    ).toThrow(BadRequestException);
  });

  it('evaluates category-specific payment percentages', () => {
    const condition = validator.validate(
      group(GuardianConditionCombinator.AND, [
        leaf(
          GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
          GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          80,
          includeConfig(['cat-a', 'cat-b']),
        ),
      ]),
    );
    const key = 'INCLUDE|ACTUAL_PAYMENT|cat-a,cat-b';
    expect(
      evaluator.evaluate(
        condition,
        metrics({
          [key]: metric({ feePaymentPercentage: 90 }),
        }),
      ).matched,
    ).toBe(true);
    expect(evaluator.evaluate(condition, metrics()).matched).toBe(false);
  });

  it('evaluates settled obligation percentages separately from actual payments', () => {
    const condition = validator.validate(
      group(GuardianConditionCombinator.AND, [
        leaf(
          GuardianConditionField.FEE_SETTLED_PERCENTAGE,
          GuardianConditionOperator.EQUALS,
          100,
          includeConfig(['tuition'], GuardianFeeAmountBasis.SETTLED_OBLIGATION),
        ),
      ]),
    );
    const key = 'INCLUDE|SETTLED_OBLIGATION|tuition';
    expect(
      evaluator.evaluate(
        condition,
        metrics({
          [key]: metric({ settledObligationPercentage: 100 }),
        }),
      ).matched,
    ).toBe(true);
    expect(
      evaluator.evaluate(
        condition,
        metrics({
          [key]: metric({ settledObligationPercentage: 40 }),
        }),
      ).matched,
    ).toBe(false);
  });

  it('evaluates excluded categories with comparison operators', () => {
    const condition = validator.validate(
      group(GuardianConditionCombinator.AND, [
        leaf(
          GuardianConditionField.FEE_OUTSTANDING_BALANCE,
          GuardianConditionOperator.LESS_THAN_OR_EQUAL,
          100,
          {
            selectionMode: GuardianFeeCategorySelectionMode.EXCLUDE,
            categoryIds: ['transport'],
          },
        ),
      ]),
    );
    const key = 'EXCLUDE|ACTUAL_PAYMENT|transport';
    expect(
      evaluator.evaluate(
        condition,
        metrics({ [key]: metric({ outstandingBalance: 100 }) }),
      ).matched,
    ).toBe(true);
    expect(
      evaluator.evaluate(
        condition,
        metrics({ [key]: metric({ outstandingBalance: 101 }) }),
      ).matched,
    ).toBe(false);
  });

  it('evaluates individual category amounts and all comparison operators', () => {
    const cases: Array<[GuardianConditionOperator, number, boolean]> = [
      [GuardianConditionOperator.EQUALS, 200, true],
      [GuardianConditionOperator.NOT_EQUALS, 200, false],
      [GuardianConditionOperator.GREATER_THAN, 199, true],
      [GuardianConditionOperator.GREATER_THAN_OR_EQUAL, 200, true],
      [GuardianConditionOperator.LESS_THAN, 201, true],
      [GuardianConditionOperator.LESS_THAN_OR_EQUAL, 199, false],
    ];
    cases.forEach(([operator, value, expected]) => {
      const condition = validator.validate(
        group(GuardianConditionCombinator.AND, [
          leaf(GuardianConditionField.FEE_PAID_AMOUNT, operator, value, {
            selectionMode: GuardianFeeCategorySelectionMode.INDIVIDUAL,
            categoryIds: ['tuition'],
          }),
        ]),
      );
      const key = 'INDIVIDUAL|ACTUAL_PAYMENT|tuition';
      const result = evaluator.evaluate(
        condition,
        metrics({ [key]: metric({ approvedPaymentAmount: 200 }) }),
      );
      expect(result.matched).toBe(expected);
    });
  });

  it('evaluates gross, net, total and settled amount fields', () => {
    const fields: Array<
      [GuardianConditionField, keyof GuardianFeeMetric, number]
    > = [
      [GuardianConditionField.FEE_GROSS_AMOUNT, 'grossAmount', 700],
      [GuardianConditionField.FEE_NET_PAYABLE_AMOUNT, 'netPayableAmount', 600],
      [GuardianConditionField.FEE_TOTAL_AMOUNT, 'totalAmount', 500],
      [GuardianConditionField.FEE_SETTLED_AMOUNT, 'settledAmount', 400],
    ];
    fields.forEach(([field, amountKey, value]) => {
      const condition = validator.validate(
        group(GuardianConditionCombinator.AND, [
          leaf(field, GuardianConditionOperator.EQUALS, value),
        ]),
      );
      expect(
        evaluator.evaluate(
          condition,
          metrics({
            [DEFAULT_GUARDIAN_FEE_METRIC_KEY]: metric({ [amountKey]: value }),
          }),
        ).matched,
      ).toBe(true);
    });
  });

  it('evaluates fee evaluation status conditions', () => {
    const condition = validator.validate(
      group(GuardianConditionCombinator.AND, [
        leaf(
          GuardianConditionField.FEE_EVALUATION_STATUS,
          GuardianConditionOperator.EQUALS,
          GuardianFeeEvaluationStatus.FULLY_WAIVED,
        ),
      ]),
    );
    expect(
      evaluator.evaluate(
        condition,
        metrics({
          [DEFAULT_GUARDIAN_FEE_METRIC_KEY]: metric({
            evaluationStatus: GuardianFeeEvaluationStatus.FULLY_WAIVED,
          }),
        }),
      ).matched,
    ).toBe(true);
  });

  it('treats zero-value obligations as values, not unavailable metrics', () => {
    const condition = validator.validate(
      group(GuardianConditionCombinator.AND, [
        leaf(
          GuardianConditionField.FEE_PAID_AMOUNT,
          GuardianConditionOperator.EQUALS,
          0,
        ),
      ]),
    );
    expect(
      evaluator.evaluate(
        condition,
        metrics({
          [DEFAULT_GUARDIAN_FEE_METRIC_KEY]: metric({
            approvedPaymentAmount: 0,
            evaluationStatus: GuardianFeeEvaluationStatus.ZERO_VALUE_OBLIGATION,
          }),
        }),
      ).matched,
    ).toBe(true);
  });

  it('reports unavailable fee metrics without treating them as zero', () => {
    const condition = validator.validate(
      group(GuardianConditionCombinator.AND, [
        leaf(
          GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
          GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          10,
        ),
      ]),
    );
    const result = evaluator.evaluate(
      condition,
      metrics({
        [DEFAULT_GUARDIAN_FEE_METRIC_KEY]: metric({
          feePaymentPercentage: undefined,
          evaluationStatus: GuardianFeeEvaluationStatus.NO_ACTIVE_TERM,
          reasons: ['No active term is configured'],
        }),
      }),
    );
    expect(result.matched).toBe(false);
    expect(result.unavailableReasons).toEqual(['No active term is configured']);
  });

  it('keeps nested OR groups independent across fee configs', () => {
    const condition = validator.validate(
      group(GuardianConditionCombinator.OR, [
        leaf(
          GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
          GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          80,
          includeConfig(['tuition']),
        ),
        group(GuardianConditionCombinator.AND, [
          leaf(
            GuardianConditionField.FEE_SETTLED_PERCENTAGE,
            GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
            90,
            includeConfig(
              ['transport'],
              GuardianFeeAmountBasis.SETTLED_OBLIGATION,
            ),
          ),
          leaf(
            GuardianConditionField.STUDENT_STATUS,
            GuardianConditionOperator.EQUALS,
            StudentStatus.ACTIVE,
          ),
        ]),
      ]),
    );
    const result = evaluator.evaluate(
      condition,
      metrics({
        'INCLUDE|ACTUAL_PAYMENT|tuition': metric({
          feePaymentPercentage: 85,
        }),
        'INCLUDE|SETTLED_OBLIGATION|transport': metric({
          settledObligationPercentage: 20,
        }),
      }),
    );
    expect(result.matched).toBe(true);
    expect(result.unavailableReasons).toEqual([]);
  });

  it('preserves legacy top-level fee metrics', () => {
    const condition = validator.validate(
      group(GuardianConditionCombinator.AND, [
        leaf(
          GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
          GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          60,
        ),
        leaf(
          GuardianConditionField.OUTSTANDING_BALANCE,
          GuardianConditionOperator.LESS_THAN,
          500,
        ),
      ]),
    );
    const result = evaluator.evaluate(condition, {
      studentStatus: StudentStatus.ACTIVE,
      feePaymentPercentage: 60,
      outstandingBalance: 400,
      unavailable: {},
    });
    expect(result.matched).toBe(true);
  });

  it('collects every fee config required by multiple policies', () => {
    const first = validator.validate(
      group(GuardianConditionCombinator.AND, [
        leaf(
          GuardianConditionField.FEE_PAYMENT_PERCENTAGE,
          GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          40,
          includeConfig(['tuition']),
        ),
      ]),
    );
    const second = validator.validate(
      group(GuardianConditionCombinator.AND, [
        leaf(
          GuardianConditionField.FEE_SETTLED_PERCENTAGE,
          GuardianConditionOperator.GREATER_THAN_OR_EQUAL,
          40,
          includeConfig(
            ['transport'],
            GuardianFeeAmountBasis.SETTLED_OBLIGATION,
          ),
        ),
      ]),
    );
    const configs = new Map<string, unknown>();
    [first, second].forEach((condition) => {
      collectGuardianFeeConditionConfigs(condition).forEach((config, key) =>
        configs.set(key, config),
      );
    });
    expect(Array.from(configs.keys())).toEqual([
      DEFAULT_GUARDIAN_FEE_METRIC_KEY,
      'INCLUDE|ACTUAL_PAYMENT|tuition',
      'INCLUDE|SETTLED_OBLIGATION|transport',
    ]);
  });
});

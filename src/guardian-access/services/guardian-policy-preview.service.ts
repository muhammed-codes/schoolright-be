import { Injectable } from '@nestjs/common';
import {
  GuardianConditionEvaluation,
  GuardianStudentMetrics,
} from '../interfaces/guardian-condition.interface';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import {
  GuardianEnforcementService,
  GuardianPreviewDraft,
} from './guardian-enforcement.service';

@Injectable()
export class GuardianPolicyPreviewService {
  constructor(
    private readonly enforcementService: GuardianEnforcementService,
  ) {}

  preview = async (
    schoolId: string,
    guardianId: string,
    studentId: string,
    resource: GuardianResource,
    action: GuardianAction,
    draft?: GuardianPreviewDraft,
  ) => {
    const result = await this.enforcementService.preview(
      schoolId,
      guardianId,
      studentId,
      resource,
      action,
      draft,
    );
    return {
      decision: result.decision,
      trace: result.decision.trace.map((item) => ({
        ...item,
        conditionEvaluation: item.conditionEvaluation
          ? this.mapConditionEvaluation(item.conditionEvaluation)
          : undefined,
      })),
      metrics: this.mapMetrics(result.metrics),
    };
  };

  private mapConditionEvaluation = (
    evaluation: GuardianConditionEvaluation,
  ) => ({
    matched: evaluation.matched,
    unavailableReasons: evaluation.unavailableReasons,
    details: evaluation.details.map((detail) => ({
      ...detail,
      ...(detail.value === null ? {} : { value: detail.value }),
    })),
  });

  private mapMetrics = (
    metrics: GuardianStudentMetrics,
  ): Record<string, unknown> => ({
    studentClassId: metrics.studentClassId ?? null,
    studentStatus: metrics.studentStatus,
    feePaymentPercentage: metrics.feePaymentPercentage ?? null,
    outstandingBalance: metrics.outstandingBalance ?? null,
    feeMetrics: metrics.feeMetrics ?? {},
    unavailable: metrics.unavailable,
  });
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuardianAccessPolicyRule } from '../entities/guardian-access-policy-rule.entity';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import {
  GuardianAuditAction,
  GuardianEffect,
} from '../enums/guardian-policy.enums';
import { UpdateGuardianPolicyRuleInput } from '../dto/guardian-policy.input';
import { GuardianAccessAuditService } from './guardian-access-audit.service';
import {
  GuardianManagementUser,
  GuardianPolicyManagementService,
} from './guardian-policy-management.service';

@Injectable()
export class GuardianPolicyRuleService {
  constructor(
    @InjectRepository(GuardianAccessPolicyRule)
    private readonly ruleRepo: Repository<GuardianAccessPolicyRule>,
    private readonly policyService: GuardianPolicyManagementService,
    private readonly auditService: GuardianAccessAuditService,
  ) {}

  create = async (
    policyId: string,
    resource: GuardianResource,
    action: GuardianAction,
    effect: GuardianEffect,
    user: GuardianManagementUser,
  ): Promise<GuardianAccessPolicyRule> => {
    const policy = await this.policyService.loadPolicy(policyId);
    this.policyService.assertSchoolAccess(user, policy.schoolId);
    if (
      policy.rules.some(
        (rule) => rule.resource === resource && rule.action === action,
      )
    ) {
      throw new BadRequestException(
        'A rule already exists for this permission',
      );
    }
    const rule = this.ruleRepo.create({ policyId, resource, action, effect });
    const saved = await this.ruleRepo.save(rule);
    await this.auditService.record(
      policy.schoolId,
      user.sub,
      GuardianAuditAction.RULE_CREATED,
      'GuardianAccessPolicyRule',
      saved.id,
      null,
      this.snapshot(saved),
    );
    return saved;
  };

  update = async (
    input: UpdateGuardianPolicyRuleInput,
    user: GuardianManagementUser,
  ): Promise<GuardianAccessPolicyRule> => {
    const rule = await this.loadRule(input.id);
    const policy = await this.policyService.loadPolicy(rule.policyId);
    this.policyService.assertSchoolAccess(user, policy.schoolId);
    const before = this.snapshot(rule);
    if (input.effect !== undefined) rule.effect = input.effect;
    await this.ruleRepo.save(rule);
    await this.auditService.record(
      policy.schoolId,
      user.sub,
      GuardianAuditAction.RULE_UPDATED,
      'GuardianAccessPolicyRule',
      rule.id,
      before,
      this.snapshot(rule),
    );
    return rule;
  };

  remove = async (
    id: string,
    user: GuardianManagementUser,
  ): Promise<boolean> => {
    const rule = await this.loadRule(id);
    const policy = await this.policyService.loadPolicy(rule.policyId);
    this.policyService.assertSchoolAccess(user, policy.schoolId);
    await this.auditService.record(
      policy.schoolId,
      user.sub,
      GuardianAuditAction.RULE_DELETED,
      'GuardianAccessPolicyRule',
      id,
      this.snapshot(rule),
      null,
    );
    await this.ruleRepo.delete(id);
    return true;
  };

  private loadRule = async (id: string): Promise<GuardianAccessPolicyRule> => {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Guardian policy rule not found');
    return rule;
  };

  private snapshot = (
    rule: GuardianAccessPolicyRule,
  ): Record<string, unknown> => ({
    id: rule.id,
    policyId: rule.policyId,
    resource: rule.resource,
    action: rule.action,
    effect: rule.effect,
  });
}

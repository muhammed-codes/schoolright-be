import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums';
import { GuardianAccessPolicy } from '../entities/guardian-access-policy.entity';
import { GuardianAccessPolicyRule } from '../entities/guardian-access-policy-rule.entity';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import {
  GuardianAuditAction,
  GuardianEffect,
  GuardianPolicyScope,
} from '../enums/guardian-policy.enums';
import {
  CreateGuardianPolicyInput,
  GuardianPolicyRuleInput,
  UpdateGuardianPolicyInput,
} from '../dto/guardian-policy.input';
import { GuardianConditionGroup } from '../interfaces/guardian-condition.interface';
import { GuardianAccessAuditService } from './guardian-access-audit.service';
import { GuardianConditionValidator } from './guardian-condition-validator.service';

export interface GuardianManagementUser {
  sub: string;
  role: UserRole;
  schoolId?: string | null;
}

@Injectable()
export class GuardianPolicyManagementService {
  constructor(
    @InjectRepository(GuardianAccessPolicy)
    private readonly policyRepo: Repository<GuardianAccessPolicy>,
    @InjectRepository(GuardianAccessPolicyRule)
    private readonly ruleRepo: Repository<GuardianAccessPolicyRule>,
    private readonly auditService: GuardianAccessAuditService,
    private readonly conditionValidator: GuardianConditionValidator,
  ) {}

  resolveSchoolId = (
    user: GuardianManagementUser,
    requestedSchoolId?: string,
  ): string => {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!requestedSchoolId) {
        throw new BadRequestException('A school scope is required');
      }
      return requestedSchoolId;
    }
    if (user.role !== UserRole.SCHOOL_ADMIN) {
      throw new ForbiddenException('Administrator access is required');
    }
    if (!user.schoolId)
      throw new ForbiddenException('A school scope is required');
    return user.schoolId;
  };

  list = async (
    user: GuardianManagementUser,
    requestedSchoolId?: string,
  ): Promise<GuardianAccessPolicy[]> => {
    const schoolId = this.resolveSchoolId(user, requestedSchoolId);
    return this.policyRepo.find({
      where: { schoolId },
      relations: ['rules'],
      order: { scope: 'ASC', priority: 'DESC', createdAt: 'DESC' },
    });
  };

  get = async (
    id: string,
    user: GuardianManagementUser,
  ): Promise<GuardianAccessPolicy> => {
    const policy = await this.loadPolicy(id);
    this.assertSchoolAccess(user, policy.schoolId);
    return policy;
  };

  create = async (
    input: CreateGuardianPolicyInput,
    user: GuardianManagementUser,
    requestedSchoolId?: string,
  ): Promise<GuardianAccessPolicy> => {
    const schoolId = this.resolveSchoolId(user, requestedSchoolId);
    if (!input.name?.trim()) {
      throw new BadRequestException('A policy name is required');
    }
    await this.assertUniqueScope(input.scope, schoolId, input.studentId);
    const condition = this.validateConditionForScope(
      input.scope,
      input.condition,
    );
    const rules = this.validateRules(input.rules);
    const policy = this.policyRepo.create({
      schoolId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      scope: input.scope,
      enabled: input.enabled ?? false,
      priority: input.priority ?? 0,
      condition,
      studentId:
        input.scope === GuardianPolicyScope.STUDENT_OVERRIDE
          ? input.studentId
          : null,
      createdById: user.sub,
      updatedById: user.sub,
    });
    const saved = await this.policyRepo.save(policy);
    await this.replaceRules(saved.id, rules);
    const result = await this.loadPolicy(saved.id);
    await this.auditService.record(
      schoolId,
      user.sub,
      GuardianAuditAction.POLICY_CREATED,
      'GuardianAccessPolicy',
      result.id,
      null,
      this.snapshot(result),
    );
    return result;
  };

  update = async (
    input: UpdateGuardianPolicyInput,
    user: GuardianManagementUser,
  ): Promise<GuardianAccessPolicy> => {
    const policy = await this.loadPolicy(input.id);
    this.assertSchoolAccess(user, policy.schoolId);
    const before = this.snapshot(policy);
    const nextScope = input.scope ?? policy.scope;
    const nextStudentId =
      input.studentId !== undefined ? input.studentId : policy.studentId;
    if (nextScope !== policy.scope || nextStudentId !== policy.studentId) {
      await this.assertUniqueScope(
        nextScope,
        policy.schoolId,
        nextStudentId,
        policy.id,
      );
    }
    if (input.name !== undefined) {
      if (!input.name.trim())
        throw new BadRequestException('A policy name is required');
      policy.name = input.name.trim();
    }
    if (input.description !== undefined) {
      policy.description = input.description.trim() || null;
    }
    if (input.scope !== undefined) policy.scope = input.scope;
    if (input.priority !== undefined) policy.priority = input.priority;
    if (input.studentId !== undefined) {
      policy.studentId =
        nextScope === GuardianPolicyScope.STUDENT_OVERRIDE
          ? input.studentId
          : null;
    }
    if (input.clearCondition) {
      policy.condition = null;
    } else if (input.condition !== undefined) {
      policy.condition = this.validateConditionForScope(
        nextScope,
        input.condition,
      );
    }
    policy.scope = nextScope;
    if (
      nextScope === GuardianPolicyScope.DYNAMIC_SEGMENT &&
      !policy.condition
    ) {
      throw new BadRequestException(
        'A dynamic segment policy requires a condition',
      );
    }
    if (nextScope !== GuardianPolicyScope.DYNAMIC_SEGMENT && policy.condition) {
      throw new BadRequestException(
        'Only dynamic segment policies can have conditions',
      );
    }
    if (
      nextScope === GuardianPolicyScope.STUDENT_OVERRIDE &&
      !policy.studentId
    ) {
      throw new BadRequestException('A student override requires a student');
    }
    policy.updatedById = user.sub;
    if (input.rules !== undefined) {
      const rules = this.validateRules(input.rules);
      await this.replaceRules(policy.id, rules);
    }
    await this.policyRepo.save(policy);
    const result = await this.loadPolicy(policy.id);
    await this.auditService.record(
      policy.schoolId,
      user.sub,
      GuardianAuditAction.POLICY_UPDATED,
      'GuardianAccessPolicy',
      result.id,
      before,
      this.snapshot(result),
    );
    return result;
  };

  setEnabled = async (
    id: string,
    enabled: boolean,
    user: GuardianManagementUser,
  ): Promise<GuardianAccessPolicy> => {
    const policy = await this.loadPolicy(id);
    this.assertSchoolAccess(user, policy.schoolId);
    const before = this.snapshot(policy);
    policy.enabled = enabled;
    policy.updatedById = user.sub;
    await this.policyRepo.save(policy);
    const result = await this.loadPolicy(id);
    await this.auditService.record(
      policy.schoolId,
      user.sub,
      enabled
        ? GuardianAuditAction.POLICY_ENABLED
        : GuardianAuditAction.POLICY_DISABLED,
      'GuardianAccessPolicy',
      id,
      before,
      this.snapshot(result),
    );
    return result;
  };

  remove = async (
    id: string,
    user: GuardianManagementUser,
  ): Promise<boolean> => {
    const policy = await this.loadPolicy(id);
    this.assertSchoolAccess(user, policy.schoolId);
    await this.auditService.record(
      policy.schoolId,
      user.sub,
      GuardianAuditAction.POLICY_DELETED,
      'GuardianAccessPolicy',
      id,
      this.snapshot(policy),
      null,
    );
    await this.ruleRepo.delete({ policyId: id });
    await this.policyRepo.delete(id);
    return true;
  };

  loadPolicy = async (id: string): Promise<GuardianAccessPolicy> => {
    const policy = await this.policyRepo.findOne({
      where: { id },
      relations: ['rules'],
    });
    if (!policy) throw new NotFoundException('Guardian policy not found');
    return policy;
  };

  assertSchoolAccess = (
    user: GuardianManagementUser,
    schoolId: string,
  ): void => {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role !== UserRole.SCHOOL_ADMIN) {
      throw new ForbiddenException('Administrator access is required');
    }
    if (user.schoolId !== schoolId) {
      throw new ForbiddenException('Guardian policy is outside your school');
    }
  };

  private assertUniqueScope = async (
    scope: GuardianPolicyScope,
    schoolId: string,
    studentId?: string | null,
    excludeId?: string,
  ): Promise<void> => {
    if (scope === GuardianPolicyScope.SCHOOL_DEFAULT) {
      const existing = await this.policyRepo.findOne({
        where: { schoolId, scope },
      });
      if (existing && existing.id !== excludeId) {
        throw new BadRequestException('A school default policy already exists');
      }
    }
    if (scope === GuardianPolicyScope.STUDENT_OVERRIDE) {
      if (!studentId) {
        throw new BadRequestException('A student override requires a student');
      }
      const existing = await this.policyRepo.findOne({
        where: { schoolId, scope, studentId },
      });
      if (existing && existing.id !== excludeId) {
        throw new BadRequestException('A student override already exists');
      }
    }
  };

  private validateConditionForScope = (
    scope: GuardianPolicyScope,
    condition?: Record<string, unknown>,
  ): GuardianConditionGroup | null => {
    if (scope !== GuardianPolicyScope.DYNAMIC_SEGMENT) {
      if (condition) {
        throw new BadRequestException(
          'Only dynamic segment policies can have conditions',
        );
      }
      return null;
    }
    if (!condition) {
      throw new BadRequestException(
        'A dynamic segment policy requires a condition',
      );
    }
    return this.conditionValidator.validate(condition);
  };

  private validateRules = (
    rules: GuardianPolicyRuleInput[],
  ): GuardianPolicyRuleInput[] => {
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new BadRequestException('At least one policy rule is required');
    }
    const seen = new Set<string>();
    for (const rule of rules) {
      if (
        !Object.values(GuardianResource).includes(rule.resource) ||
        !Object.values(GuardianAction).includes(rule.action) ||
        !Object.values(GuardianEffect).includes(rule.effect)
      ) {
        throw new BadRequestException('Invalid policy rule value');
      }
      const key = `${rule.resource}:${rule.action}`;
      if (seen.has(key)) {
        throw new BadRequestException('Duplicate policy rules are not allowed');
      }
      seen.add(key);
    }
    return rules;
  };

  private replaceRules = async (
    policyId: string,
    rules: GuardianPolicyRuleInput[],
  ): Promise<void> => {
    await this.ruleRepo.delete({ policyId });
    const entities = this.ruleRepo.create(
      rules.map((rule) => ({ ...rule, policyId })),
    );
    await this.ruleRepo.save(entities);
  };

  private snapshot = (
    policy: GuardianAccessPolicy,
  ): Record<string, unknown> => ({
    id: policy.id,
    schoolId: policy.schoolId,
    name: policy.name,
    description: policy.description,
    scope: policy.scope,
    enabled: policy.enabled,
    priority: policy.priority,
    condition: policy.condition,
    studentId: policy.studentId,
    rules:
      policy.rules?.map((rule) => ({
        id: rule.id,
        resource: rule.resource,
        action: rule.action,
        effect: rule.effect,
      })) ?? [],
  });
}

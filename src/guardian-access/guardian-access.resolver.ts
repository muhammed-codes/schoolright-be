import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UserRole } from '../common/enums';
import { GraphQLJSONObject } from '../common/scalars/json-object.scalar';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GuardianAccessAuditLog } from './entities/guardian-access-audit-log.entity';
import { GuardianAccessException } from './entities/guardian-access-exception.entity';
import { GuardianAccessPolicy } from './entities/guardian-access-policy.entity';
import { GuardianAccessPolicyRule } from './entities/guardian-access-policy-rule.entity';
import {
  CreateGuardianExceptionInput,
  UpdateGuardianExceptionInput,
} from './dto/guardian-exception.input';
import {
  CreateGuardianPolicyInput,
  GuardianPolicyRuleInput,
  UpdateGuardianPolicyInput,
  UpdateGuardianPolicyRuleInput,
} from './dto/guardian-policy.input';
import {
  GuardianAccessSnapshotType,
  GuardianPreviewType,
} from './dto/guardian-access-output.dto';
import {
  GuardianAction,
  GuardianResource,
} from './enums/guardian-permission.enums';
import { GuardianEffect } from './enums/guardian-policy.enums';
import { GuardianAccessAuditService } from './services/guardian-access-audit.service';
import { GuardianEnforcementService } from './services/guardian-enforcement.service';
import { GuardianExceptionService } from './services/guardian-exception.service';
import { GuardianPolicyManagementService } from './services/guardian-policy-management.service';
import { GuardianPolicyPreviewService } from './services/guardian-policy-preview.service';
import { GuardianPolicyRuleService } from './services/guardian-policy-rule.service';

type ManagementUser = {
  sub: string;
  role: UserRole;
  schoolId?: string | null;
};

@Resolver(() => GuardianAccessPolicy)
@UseGuards(JwtAuthGuard, RolesGuard)
export class GuardianAccessResolver {
  constructor(
    private readonly policyService: GuardianPolicyManagementService,
    private readonly ruleService: GuardianPolicyRuleService,
    private readonly exceptionService: GuardianExceptionService,
    private readonly auditService: GuardianAccessAuditService,
    private readonly enforcementService: GuardianEnforcementService,
    private readonly previewService: GuardianPolicyPreviewService,
  ) {}

  @Query(() => [GuardianAccessPolicy], { name: 'guardianAccessPolicies' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  policies(
    @CurrentUser() user: ManagementUser,
    @Args('schoolId', { type: () => String, nullable: true }) schoolId?: string,
  ) {
    return this.policyService.list(user, schoolId);
  }

  @Query(() => GuardianAccessPolicy, { name: 'guardianAccessPolicy' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  policy(@Args('id') id: string, @CurrentUser() user: ManagementUser) {
    return this.policyService.get(id, user);
  }

  @Mutation(() => GuardianAccessPolicy, { name: 'createGuardianAccessPolicy' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  createPolicy(
    @Args('input') input: CreateGuardianPolicyInput,
    @CurrentUser() user: ManagementUser,
    @Args('schoolId', { type: () => String, nullable: true }) schoolId?: string,
  ) {
    return this.policyService.create(input, user, schoolId);
  }

  @Mutation(() => GuardianAccessPolicy, { name: 'updateGuardianAccessPolicy' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  updatePolicy(
    @Args('input') input: UpdateGuardianPolicyInput,
    @CurrentUser() user: ManagementUser,
  ) {
    return this.policyService.update(input, user);
  }

  @Mutation(() => GuardianAccessPolicy, {
    name: 'setGuardianAccessPolicyEnabled',
  })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  setPolicyEnabled(
    @Args('id') id: string,
    @Args('enabled') enabled: boolean,
    @CurrentUser() user: ManagementUser,
  ) {
    return this.policyService.setEnabled(id, enabled, user);
  }

  @Mutation(() => Boolean, { name: 'deleteGuardianAccessPolicy' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  deletePolicy(@Args('id') id: string, @CurrentUser() user: ManagementUser) {
    return this.policyService.remove(id, user);
  }

  @Mutation(() => GuardianAccessPolicyRule, {
    name: 'createGuardianAccessPolicyRule',
  })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  createRule(
    @Args('policyId') policyId: string,
    @Args('resource', { type: () => GuardianResource })
    resource: GuardianResource,
    @Args('action', { type: () => GuardianAction }) action: GuardianAction,
    @Args('effect', { type: () => GuardianEffect }) effect: GuardianEffect,
    @CurrentUser() user: ManagementUser,
  ) {
    return this.ruleService.create(policyId, resource, action, effect, user);
  }

  @Mutation(() => GuardianAccessPolicyRule, {
    name: 'updateGuardianAccessPolicyRule',
  })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  updateRule(
    @Args('input') input: UpdateGuardianPolicyRuleInput,
    @CurrentUser() user: ManagementUser,
  ) {
    return this.ruleService.update(input, user);
  }

  @Mutation(() => Boolean, { name: 'deleteGuardianAccessPolicyRule' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  deleteRule(@Args('id') id: string, @CurrentUser() user: ManagementUser) {
    return this.ruleService.remove(id, user);
  }

  @Query(() => [GuardianAccessException], { name: 'guardianAccessExceptions' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  exceptions(
    @CurrentUser() user: ManagementUser,
    @Args('schoolId', { type: () => String, nullable: true }) schoolId?: string,
  ) {
    return this.exceptionService.list(user, schoolId);
  }

  @Query(() => [GuardianAccessException], {
    name: 'guardianAccessExceptionsForStudent',
  })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  exceptionsForStudent(
    @Args('studentId') studentId: string,
    @CurrentUser() user: ManagementUser,
    @Args('schoolId', { type: () => String, nullable: true }) schoolId?: string,
  ) {
    return this.exceptionService.listForStudent(studentId, user, schoolId);
  }

  @Mutation(() => GuardianAccessException, {
    name: 'createGuardianAccessException',
  })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  createException(
    @Args('input') input: CreateGuardianExceptionInput,
    @CurrentUser() user: ManagementUser,
    @Args('schoolId', { type: () => String, nullable: true }) schoolId?: string,
  ) {
    return this.exceptionService.create(input, user, schoolId);
  }

  @Mutation(() => GuardianAccessException, {
    name: 'updateGuardianAccessException',
  })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  updateException(
    @Args('input') input: UpdateGuardianExceptionInput,
    @CurrentUser() user: ManagementUser,
  ) {
    return this.exceptionService.update(input, user);
  }

  @Mutation(() => Boolean, { name: 'deleteGuardianAccessException' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  deleteException(@Args('id') id: string, @CurrentUser() user: ManagementUser) {
    return this.exceptionService.remove(id, user);
  }

  @Query(() => [GuardianAccessAuditLog], { name: 'guardianAccessAuditLogs' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  auditLogs(
    @CurrentUser() user: ManagementUser,
    @Args('schoolId', { type: () => String, nullable: true }) schoolId?: string,
  ) {
    const resolvedSchoolId = this.policyService.resolveSchoolId(user, schoolId);
    return this.auditService.list(resolvedSchoolId);
  }

  @Query(() => GuardianPreviewType, { name: 'previewGuardianAccess' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  preview(
    @Args('guardianId') guardianId: string,
    @Args('studentId') studentId: string,
    @Args('resource', { type: () => GuardianResource })
    resource: GuardianResource,
    @Args('action', { type: () => GuardianAction }) action: GuardianAction,
    @CurrentUser() user: ManagementUser,
    @Args('schoolId', { type: () => String, nullable: true }) schoolId?: string,
    @Args('condition', { type: () => GraphQLJSONObject, nullable: true })
    condition?: Record<string, unknown>,
    @Args('rules', { type: () => [GuardianPolicyRuleInput], nullable: true })
    rules?: GuardianPolicyRuleInput[],
  ) {
    const resolvedSchoolId = this.policyService.resolveSchoolId(user, schoolId);
    return this.previewService.preview(
      resolvedSchoolId,
      guardianId,
      studentId,
      resource,
      action,
      condition ? { condition, rules: rules ?? [] } : undefined,
    );
  }

  @Query(() => [GuardianAccessSnapshotType], { name: 'myGuardianAccess' })
  @Roles(UserRole.PARENT)
  myAccess(@CurrentUser() user: ManagementUser) {
    if (!user.schoolId) {
      throw new ForbiddenException('A school scope is required');
    }
    return this.enforcementService.snapshot(user.sub, user.schoolId);
  }
}

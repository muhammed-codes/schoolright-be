import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AppResource } from '../../access/enums/resource.enum';
import { PermissionAction } from '../../access/enums/permission-action.enum';
import { SCHOOL_STAFF_ROLES } from '../../common/constants/roles.constant';
import { CurrentUser, RequirePermission, Roles } from '../../common/decorators';
import { JwtAuthGuard, PermissionGuard, RolesGuard } from '../../common/guards';
import { UserRole } from '../../common/enums';
import { PaginationArgs, createPaginatedType } from '../../common/pagination';
import { GuardianAccessAuditLog } from '../entities/guardian-access-audit-log.entity';
import {
  CreateGuardianGroupInput,
  GuardianGroupDraftInput,
  GuardianGroupMembersInput,
  UpdateGuardianGroupInput,
} from './dto/guardian-group.input';
import { GuardianGroupPreviewType } from './dto/guardian-group-output.dto';
import { GuardianGroup } from './entities/guardian-group.entity';
import { GuardianGroupType } from './enums/guardian-group.enums';
import {
  GuardianGroupManagementUser,
  GuardianGroupService,
} from './services/guardian-group.service';

const PaginatedGuardianGroup = createPaginatedType(GuardianGroup);

@Resolver(() => GuardianGroup)
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles(UserRole.SUPER_ADMIN, ...SCHOOL_STAFF_ROLES)
export class GuardianGroupResolver {
  constructor(private readonly service: GuardianGroupService) {}

  @Query(() => PaginatedGuardianGroup, { name: 'guardianGroups' })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.READ)
  list(
    @Args() pagination: PaginationArgs,
    @CurrentUser() user: GuardianGroupManagementUser,
    @Args('schoolId', { type: () => String, nullable: true }) schoolId?: string,
    @Args('type', { type: () => GuardianGroupType, nullable: true })
    type?: GuardianGroupType,
    @Args('isActive', { type: () => Boolean, nullable: true })
    isActive?: boolean,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.service.list(user, pagination, {
      schoolId,
      type,
      isActive,
      search,
    });
  }

  @Query(() => GuardianGroup, { name: 'guardianGroup' })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.READ)
  get(
    @Args('id') id: string,
    @CurrentUser() user: GuardianGroupManagementUser,
  ) {
    return this.service.get(id, user);
  }

  @Query(() => GuardianGroupPreviewType, { name: 'previewGuardianGroup' })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.READ)
  previewDraft(
    @Args('input') input: GuardianGroupDraftInput,
    @CurrentUser() user: GuardianGroupManagementUser,
    @Args('schoolId', { type: () => String, nullable: true }) schoolId?: string,
  ) {
    return this.service.previewDraft(input, user, schoolId);
  }

  @Query(() => GuardianGroupPreviewType, { name: 'guardianGroupMembers' })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.READ)
  previewGroup(
    @Args('id') id: string,
    @CurrentUser() user: GuardianGroupManagementUser,
  ) {
    return this.service.previewGroup(id, user);
  }

  @Query(() => [GuardianAccessAuditLog], { name: 'guardianGroupHistory' })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.READ)
  history(
    @Args('id') id: string,
    @CurrentUser() user: GuardianGroupManagementUser,
  ) {
    return this.service.history(id, user);
  }

  @Mutation(() => GuardianGroup, { name: 'createGuardianGroup' })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.CREATE)
  create(
    @Args('input') input: CreateGuardianGroupInput,
    @CurrentUser() user: GuardianGroupManagementUser,
    @Args('schoolId', { type: () => String, nullable: true }) schoolId?: string,
  ) {
    return this.service.create(input, user, schoolId);
  }

  @Mutation(() => GuardianGroup, { name: 'updateGuardianGroup' })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.UPDATE)
  update(
    @Args('input') input: UpdateGuardianGroupInput,
    @CurrentUser() user: GuardianGroupManagementUser,
  ) {
    return this.service.update(input, user);
  }

  @Mutation(() => GuardianGroup, { name: 'setGuardianGroupActive' })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.UPDATE)
  setActive(
    @Args('id') id: string,
    @Args('active') active: boolean,
    @CurrentUser() user: GuardianGroupManagementUser,
  ) {
    return this.service.setActive(id, active, user);
  }

  @Mutation(() => Boolean, { name: 'deleteGuardianGroup' })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.DELETE)
  remove(
    @Args('id') id: string,
    @CurrentUser() user: GuardianGroupManagementUser,
  ) {
    return this.service.remove(id, user);
  }

  @Mutation(() => GuardianGroupPreviewType, {
    name: 'addGuardianGroupMembers',
  })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.UPDATE)
  addMembers(
    @Args('input') input: GuardianGroupMembersInput,
    @CurrentUser() user: GuardianGroupManagementUser,
  ) {
    return this.service.addMembers(input, user);
  }

  @Mutation(() => GuardianGroupPreviewType, {
    name: 'removeGuardianGroupMembers',
  })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.UPDATE)
  removeMembers(
    @Args('input') input: GuardianGroupMembersInput,
    @CurrentUser() user: GuardianGroupManagementUser,
  ) {
    return this.service.removeMembers(input, user);
  }

  @Mutation(() => GuardianGroupPreviewType, {
    name: 'evaluateGuardianGroup',
  })
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.UPDATE)
  evaluate(
    @Args('id') id: string,
    @CurrentUser() user: GuardianGroupManagementUser,
  ) {
    return this.service.evaluateGroup(id, user);
  }
}

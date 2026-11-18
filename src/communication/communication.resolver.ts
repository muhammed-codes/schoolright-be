import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { filterAnnouncementsForGuardian } from './communication.guardian-filter';
import { Announcement } from './entities/announcement.entity';
import {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from './dto/announcement.input';
import { CurrentUser, RequirePermission, Roles } from '../common/decorators';
import { JwtAuthGuard, PermissionGuard, RolesGuard } from '../common/guards';
import { SCHOOL_STAFF_ROLES } from '../common/constants/roles.constant';
import { AppResource } from '../access/enums/resource.enum';
import { PermissionAction } from '../access/enums/permission-action.enum';
import { UserRole } from '../common/enums';
import { PaginationArgs, createPaginatedType } from '../common/pagination';
import { GuardianEnforcementService } from '../guardian-access/services/guardian-enforcement.service';
import {
  GuardianAction,
  GuardianResource,
} from '../guardian-access/enums/guardian-permission.enums';

const PaginatedAnnouncement = createPaginatedType(Announcement);

type AuthUser = { sub: string; schoolId?: string; role: UserRole };

@Resolver(() => Announcement)
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles(...SCHOOL_STAFF_ROLES)
export class CommunicationResolver {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly guardianEnforcement: GuardianEnforcementService,
  ) {}

  private filterForGuardian = async (
    announcements: Announcement[],
    user: AuthUser,
  ): Promise<Announcement[]> => {
    const children = await this.guardianEnforcement.getAllowedChildren(
      user.sub,
      user.schoolId!,
      GuardianResource.COMMUNICATION,
      GuardianAction.VIEW,
    );
    if (!children.length) return [];
    const classIds = new Set(
      children
        .map((child) => child.classId)
        .filter((id): id is string => Boolean(id)),
    );
    return filterAnnouncementsForGuardian(announcements, classIds);
  };

  @Query(() => Announcement, { nullable: true })
  @Roles(UserRole.PARENT, ...SCHOOL_STAFF_ROLES)
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.READ)
  async announcement(@Args('id') id: string, @CurrentUser() user: AuthUser) {
    if (!user.schoolId) return null;
    const announcement = await this.communicationService.getVisibleById(
      id,
      user.sub,
      user.role,
      user.schoolId,
    );
    if (user.role !== UserRole.PARENT) return announcement;
    const allowed = await this.filterForGuardian([announcement], user);
    if (!allowed.length) throw new NotFoundException('Announcement not found');
    return announcement;
  }

  @Query(() => [Announcement])
  @Roles(UserRole.PARENT, ...SCHOOL_STAFF_ROLES)
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.READ)
  async announcements(@CurrentUser() user: AuthUser) {
    if (!user.schoolId) return [];
    const announcements = await this.communicationService.listVisible(
      user.sub,
      user.role,
      user.schoolId,
    );
    if (user.role !== UserRole.PARENT) return announcements;
    return this.filterForGuardian(announcements, user);
  }

  @Query(() => PaginatedAnnouncement)
  @Roles(UserRole.PARENT, ...SCHOOL_STAFF_ROLES)
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.READ)
  async announcementsPage(
    @Args() pagination: PaginationArgs,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.schoolId) return { items: [], total: 0, page: 1, totalPages: 0 };
    if (user.role !== UserRole.PARENT) {
      return this.communicationService.listVisiblePaginated(
        user.sub,
        user.role,
        user.schoolId,
        pagination,
      );
    }
    const visible = await this.communicationService.listVisible(
      user.sub,
      user.role,
      user.schoolId,
    );
    const allowed = await this.filterForGuardian(visible, user);
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const skip = (page - 1) * limit;
    return {
      items: allowed.slice(skip, skip + limit),
      total: allowed.length,
      page,
      totalPages: Math.ceil(allowed.length / limit),
    };
  }

  @Query(() => PaginatedAnnouncement)
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.MANAGE)
  adminAnnouncementsPage(
    @Args() pagination: PaginationArgs,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.schoolId) return { items: [], total: 0, page: 1, totalPages: 0 };
    return this.communicationService.listForAdmin(user.schoolId, pagination);
  }

  @Mutation(() => Announcement)
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.CREATE)
  createAnnouncement(
    @Args('input') input: CreateAnnouncementInput,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.schoolId) throw new Error('A school scope is required');
    return this.communicationService.create(input, user.schoolId, user.sub);
  }

  @Mutation(() => Announcement)
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.UPDATE)
  updateAnnouncement(
    @Args('id') id: string,
    @Args('input') input: UpdateAnnouncementInput,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.schoolId) throw new Error('A school scope is required');
    return this.communicationService.update(id, input, user.schoolId);
  }

  @Mutation(() => Announcement)
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.PUBLISH)
  publishAnnouncement(@Args('id') id: string, @CurrentUser() user: AuthUser) {
    if (!user.schoolId) throw new Error('A school scope is required');
    return this.communicationService.publish(id, user.schoolId);
  }

  @Mutation(() => Boolean)
  @RequirePermission(AppResource.COMMUNICATION, PermissionAction.DELETE)
  deleteAnnouncement(@Args('id') id: string, @CurrentUser() user: AuthUser) {
    if (!user.schoolId) throw new Error('A school scope is required');
    return this.communicationService.delete(id, user.schoolId);
  }
}

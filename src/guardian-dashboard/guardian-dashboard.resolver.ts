import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { UserRole } from '../common/enums';
import { CurrentUser, Roles } from '../common/decorators';
import { JwtAuthGuard, PermissionGuard, RolesGuard } from '../common/guards';
import { GuardianDashboard } from './dto/guardian-dashboard.dto';
import {
  GuardianDashboardService,
  GuardianDashboardUser,
} from './guardian-dashboard.service';

@Resolver(() => GuardianDashboard)
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
export class GuardianDashboardResolver {
  constructor(private readonly dashboardService: GuardianDashboardService) {}

  @Query(() => GuardianDashboard, { name: 'guardianDashboard' })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.PARENT)
  guardianDashboard(
    @CurrentUser() user: GuardianDashboardUser,
    @Args('studentId', { type: () => String }) studentId: string,
    @Args('termId', { type: () => String, nullable: true }) termId?: string,
  ) {
    return this.dashboardService.getDashboard(user, studentId, termId);
  }
}

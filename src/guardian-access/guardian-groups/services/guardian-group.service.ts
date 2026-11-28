import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../../common/enums';
import { PaginationArgs } from '../../../common/pagination';
import { GuardianAccessAuditLog } from '../../entities/guardian-access-audit-log.entity';
import { GuardianAuditAction } from '../../enums/guardian-policy.enums';
import { GuardianAccessAuditService } from '../../services/guardian-access-audit.service';
import {
  CreateGuardianGroupInput,
  GuardianGroupMembersInput,
  UpdateGuardianGroupInput,
  GuardianGroupDraftInput,
} from '../dto/guardian-group.input';
import { GuardianGroupPreviewType } from '../dto/guardian-group-output.dto';
import { GuardianGroup } from '../entities/guardian-group.entity';
import { GuardianGroupType } from '../enums/guardian-group.enums';
import { GuardianGroupMembershipService } from './guardian-group-membership.service';

export type GuardianGroupManagementUser = {
  sub: string;
  role: UserRole;
  schoolId?: string | null;
};

export interface GuardianGroupPage {
  items: GuardianGroup[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

@Injectable()
export class GuardianGroupService {
  constructor(
    @InjectRepository(GuardianGroup)
    private readonly groupRepo: Repository<GuardianGroup>,
    private readonly membershipService: GuardianGroupMembershipService,
    private readonly auditService: GuardianAccessAuditService,
  ) {}

  resolveSchoolId = (
    user: GuardianGroupManagementUser,
    requestedSchoolId?: string,
  ): string => {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!requestedSchoolId) {
        throw new ForbiddenException('Select a school for this guardian group');
      }
      return requestedSchoolId;
    }
    if (!user.schoolId) {
      throw new ForbiddenException('A school scope is required');
    }
    if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
      throw new ForbiddenException(
        'You can only manage guardian groups for your school',
      );
    }
    return user.schoolId;
  };

  list = async (
    user: GuardianGroupManagementUser,
    pagination: PaginationArgs,
    options: {
      schoolId?: string;
      type?: GuardianGroupType;
      isActive?: boolean;
      search?: string;
    } = {},
  ): Promise<GuardianGroupPage> => {
    const schoolId = this.resolveSchoolId(user, options.schoolId);
    const query = this.groupRepo
      .createQueryBuilder('group')
      .where('group.schoolId = :schoolId', { schoolId })
      .andWhere('group.isDeleted = :isDeleted', { isDeleted: false });
    if (options.type) {
      query.andWhere('group.type = :type', { type: options.type });
    }
    if (options.isActive !== undefined) {
      query.andWhere('group.isActive = :isActive', {
        isActive: options.isActive,
      });
    }
    if (options.search?.trim()) {
      query.andWhere('LOWER(group.name) LIKE :search', {
        search: `%${options.search.trim().toLowerCase()}%`,
      });
    }
    const total = await query.getCount();
    const items = await query
      .orderBy('group.createdAt', 'DESC')
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit)
      .getMany();
    return {
      items,
      total,
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      hasMore: pagination.page * pagination.limit < total,
    };
  };

  get = async (
    id: string,
    user: GuardianGroupManagementUser,
  ): Promise<GuardianGroup> => {
    const group = await this.groupRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!group) throw new NotFoundException('Guardian group not found');
    this.assertSchoolAccess(user, group.schoolId);
    return group;
  };

  create = async (
    input: CreateGuardianGroupInput,
    user: GuardianGroupManagementUser,
    requestedSchoolId?: string,
  ): Promise<GuardianGroup> => {
    const schoolId = this.resolveSchoolId(user, requestedSchoolId);
    await this.assertNameAvailable(schoolId, input.name);
    const validated = await this.membershipService.validateDraft(
      schoolId,
      input,
      { requireStudents: true },
    );
    const group = this.groupRepo.create({
      schoolId,
      name: input.name.trim(),
      description: input.description ?? null,
      type: validated.type,
      condition: validated.condition
        ? (validated.condition as unknown as Record<string, unknown>)
        : null,
      isActive: input.isActive ?? true,
      isDeleted: false,
      createdById: user.sub,
      updatedById: user.sub,
    });
    const saved = await this.groupRepo.save(group);
    await this.membershipService.syncGroup(saved, user.sub);
    await this.auditService.record(
      schoolId,
      user.sub,
      GuardianAuditAction.GROUP_CREATED,
      'GUARDIAN_GROUP',
      saved.id,
      null,
      this.groupSnapshot(saved),
    );
    return saved;
  };

  update = async (
    input: UpdateGuardianGroupInput,
    user: GuardianGroupManagementUser,
  ): Promise<GuardianGroup> => {
    const group = await this.get(input.id, user);
    const validated = await this.membershipService.validateUpdate(
      group.schoolId,
      group,
      input,
    );
    if (input.name && input.name.trim() !== group.name) {
      await this.assertNameAvailable(group.schoolId, input.name, group.id);
    }
    const before = this.groupSnapshot(group);
    group.name = input.name?.trim() ?? group.name;
    group.description =
      input.description === undefined ? group.description : input.description;
    group.type = validated.type;
    group.condition = validated.condition
      ? (validated.condition as unknown as Record<string, unknown>)
      : null;
    group.isActive = input.isActive ?? group.isActive;
    group.updatedById = user.sub;
    const saved = await this.groupRepo.save(group);
    if (saved.type === GuardianGroupType.FIXED) {
      await this.membershipService.syncFixedMembers(
        saved,
        validated.studentIds,
        user.sub,
      );
    } else {
      await this.membershipService.syncGroup(saved, user.sub);
    }
    await this.auditService.record(
      group.schoolId,
      user.sub,
      GuardianAuditAction.GROUP_UPDATED,
      'GUARDIAN_GROUP',
      group.id,
      before,
      this.groupSnapshot(saved),
    );
    return saved;
  };

  setActive = async (
    id: string,
    isActive: boolean,
    user: GuardianGroupManagementUser,
  ): Promise<GuardianGroup> => {
    const group = await this.get(id, user);
    const before = this.groupSnapshot(group);
    group.isActive = isActive;
    group.updatedById = user.sub;
    const saved = await this.groupRepo.save(group);
    await this.auditService.record(
      group.schoolId,
      user.sub,
      isActive
        ? GuardianAuditAction.GROUP_ACTIVATED
        : GuardianAuditAction.GROUP_ARCHIVED,
      'GUARDIAN_GROUP',
      group.id,
      before,
      this.groupSnapshot(saved),
    );
    return saved;
  };

  remove = async (
    id: string,
    user: GuardianGroupManagementUser,
  ): Promise<boolean> => {
    const group = await this.get(id, user);
    const before = this.groupSnapshot(group);
    group.isActive = false;
    group.isDeleted = true;
    group.updatedById = user.sub;
    const saved = await this.groupRepo.save(group);
    await this.auditService.record(
      group.schoolId,
      user.sub,
      GuardianAuditAction.GROUP_DELETED,
      'GUARDIAN_GROUP',
      group.id,
      before,
      this.groupSnapshot(saved),
    );
    return true;
  };

  previewDraft = async (
    input: GuardianGroupDraftInput,
    user: GuardianGroupManagementUser,
    requestedSchoolId?: string,
  ): Promise<GuardianGroupPreviewType> => {
    const schoolId = this.resolveSchoolId(user, requestedSchoolId);
    return this.membershipService.previewDraft(schoolId, input);
  };

  previewGroup = async (
    id: string,
    user: GuardianGroupManagementUser,
  ): Promise<GuardianGroupPreviewType> => {
    const group = await this.get(id, user);
    return this.membershipService.previewGroup(group);
  };

  evaluateGroup = async (
    id: string,
    user: GuardianGroupManagementUser,
  ): Promise<GuardianGroupPreviewType> => {
    const group = await this.get(id, user);
    return this.membershipService.syncGroup(group, user.sub);
  };

  addMembers = async (
    input: GuardianGroupMembersInput,
    user: GuardianGroupManagementUser,
  ): Promise<GuardianGroupPreviewType> => {
    const group = await this.get(input.groupId, user);
    this.assertFixed(group);
    const current = await this.membershipService.getActiveStudentIds(group.id);
    const merged = Array.from(new Set([...current, ...input.studentIds]));
    return this.membershipService.syncFixedMembers(group, merged, user.sub);
  };

  removeMembers = async (
    input: GuardianGroupMembersInput,
    user: GuardianGroupManagementUser,
  ): Promise<GuardianGroupPreviewType> => {
    const group = await this.get(input.groupId, user);
    this.assertFixed(group);
    const removed = new Set(input.studentIds);
    const current = await this.membershipService.getActiveStudentIds(group.id);
    return this.membershipService.syncFixedMembers(
      group,
      current.filter((id) => !removed.has(id)),
      user.sub,
    );
  };

  history = async (
    id: string,
    user: GuardianGroupManagementUser,
  ): Promise<GuardianAccessAuditLog[]> => {
    const group = await this.get(id, user);
    const logs = await this.auditService.list(group.schoolId);
    return logs.filter(
      (log) =>
        log.entityId === group.id &&
        (log.entityType === 'GUARDIAN_GROUP' ||
          log.entityType === 'GUARDIAN_GROUP_MEMBERSHIP'),
    );
  };

  private assertSchoolAccess = (
    user: GuardianGroupManagementUser,
    schoolId: string,
  ): void => {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (!user.schoolId || user.schoolId !== schoolId) {
      throw new ForbiddenException(
        'You can only manage guardian groups for your school',
      );
    }
  };

  private assertFixed = (group: GuardianGroup): void => {
    if (group.type !== GuardianGroupType.FIXED) {
      throw new BadRequestException(
        'Fixed student members can only be changed on a fixed guardian group',
      );
    }
  };

  private assertNameAvailable = async (
    schoolId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> => {
    const existing = await this.groupRepo
      .createQueryBuilder('group')
      .where('group.schoolId = :schoolId', { schoolId })
      .andWhere('LOWER(group.name) = :name', {
        name: name.trim().toLowerCase(),
      })
      .andWhere('group.isDeleted = :isDeleted', { isDeleted: false })
      .getMany();
    if (existing.some((group) => group.id !== excludeId)) {
      throw new BadRequestException(
        'A guardian group with this name already exists',
      );
    }
  };

  private groupSnapshot = (group: GuardianGroup): Record<string, unknown> => ({
    id: group.id,
    schoolId: group.schoolId,
    name: group.name,
    description: group.description,
    type: group.type,
    condition: group.condition,
    isActive: group.isActive,
    isDeleted: group.isDeleted,
  });
}

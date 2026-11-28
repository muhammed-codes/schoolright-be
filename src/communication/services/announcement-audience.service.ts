import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserRole } from '../../common/enums';
import { ClassEntity } from '../../classes/entities/class.entity';
import { Student } from '../../students/entities/student.entity';
import { StudentParent } from '../../students/entities/student-parent.entity';
import { User } from '../../users/entities/user.entity';
import { GuardianGroup } from '../../guardian-access/guardian-groups/entities/guardian-group.entity';
import { GuardianGroupDraftInput } from '../../guardian-access/guardian-groups/dto/guardian-group.input';
import {
  GuardianGroupGuardianPreviewType,
  GuardianGroupPreviewType,
} from '../../guardian-access/guardian-groups/dto/guardian-group-output.dto';
import { GuardianGroupType } from '../../guardian-access/guardian-groups/enums/guardian-group.enums';
import { GuardianGroupMembershipService } from '../../guardian-access/guardian-groups/services/guardian-group-membership.service';
import { AnnouncementAudience } from '../entities/announcement.entity';
import {
  AnnouncementAudiencePreviewInput,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '../dto/announcement.input';
import {
  AnnouncementAudiencePreviewType,
  AnnouncementAudienceGuardianType,
} from '../dto/announcement-targeting-output.dto';
import {
  AnnouncementAudienceSource,
  AnnouncementRecipientKind,
} from '../enums/announcement-targeting.enums';

export interface ResolvedAnnouncementRecipient {
  userId: string;
  recipientKind: AnnouncementRecipientKind;
  name: string;
  email: string | null;
  qualifyingStudentIds: string[];
  sources: AnnouncementAudienceSource[];
}

export interface ResolvedAnnouncementAudience {
  recipients: ResolvedAnnouncementRecipient[];
  preview: AnnouncementAudiencePreviewType;
  snapshot: Record<string, unknown>;
}

@Injectable()
export class AnnouncementAudienceService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(GuardianGroup)
    private readonly groupRepo: Repository<GuardianGroup>,
    private readonly membershipService: GuardianGroupMembershipService,
  ) {}

  resolveInput = async (
    input: AnnouncementAudiencePreviewInput,
    schoolId: string,
  ): Promise<ResolvedAnnouncementAudience> => {
    switch (input.audience) {
      case AnnouncementAudience.SCHOOL:
        return this.resolveSchool(schoolId);
      case AnnouncementAudience.STAFF:
        return this.resolveStaff(schoolId);
      case AnnouncementAudience.GUARDIANS:
        return this.resolveAllGuardians(schoolId);
      case AnnouncementAudience.CLASS:
        return this.resolveClass(schoolId, input.targetClassId);
      case AnnouncementAudience.GUARDIAN_GROUP:
        return this.resolveGroups(schoolId, input.targetGroupIds);
      case AnnouncementAudience.CUSTOM_GUARDIANS:
        return this.resolveCustom(schoolId, input.audienceCondition);
      case AnnouncementAudience.MANUAL_STUDENTS:
        return this.resolveManualStudents(schoolId, input.manualStudentIds);
      case AnnouncementAudience.MANUAL_GUARDIANS:
        return this.resolveManualGuardians(schoolId, input.manualGuardianIds);
      default:
        throw new BadRequestException('Unsupported announcement audience');
    }
  };

  resolveCreation = async (
    input: CreateAnnouncementInput,
    schoolId: string,
  ): Promise<void> => {
    const targetGroupIds = input.targetGroupIds ?? [];
    const audienceCondition = input.audienceCondition ?? null;
    const manualStudentIds = input.manualStudentIds ?? [];
    const manualGuardianIds = input.manualGuardianIds ?? [];

    if (
      input.audience !== AnnouncementAudience.GUARDIAN_GROUP &&
      targetGroupIds.length
    ) {
      throw new BadRequestException(
        'Guardian groups are only valid for guardian group announcements',
      );
    }
    if (
      input.audience !== AnnouncementAudience.CUSTOM_GUARDIANS &&
      audienceCondition
    ) {
      throw new BadRequestException(
        'Conditions are only valid for custom guardian announcements',
      );
    }
    if (
      input.audience !== AnnouncementAudience.MANUAL_STUDENTS &&
      manualStudentIds.length
    ) {
      throw new BadRequestException(
        'Students are only valid for manual student announcements',
      );
    }
    if (
      input.audience !== AnnouncementAudience.MANUAL_GUARDIANS &&
      manualGuardianIds.length
    ) {
      throw new BadRequestException(
        'Guardians are only valid for manual guardian announcements',
      );
    }
    if (
      input.audience === AnnouncementAudience.GUARDIAN_GROUP &&
      targetGroupIds.length === 0
    ) {
      throw new BadRequestException('Select at least one guardian group');
    }
    if (
      input.audience === AnnouncementAudience.CUSTOM_GUARDIANS &&
      !audienceCondition
    ) {
      throw new BadRequestException('A custom audience requires a condition');
    }
    if (
      input.audience === AnnouncementAudience.MANUAL_STUDENTS &&
      manualStudentIds.length === 0
    ) {
      throw new BadRequestException('Select at least one student');
    }
    if (
      input.audience === AnnouncementAudience.MANUAL_GUARDIANS &&
      manualGuardianIds.length === 0
    ) {
      throw new BadRequestException('Select at least one guardian');
    }
    await this.resolveInput(
      {
        audience: input.audience,
        schoolId,
        targetClassId: input.targetClassId,
        targetGroupIds,
        audienceCondition: audienceCondition ?? undefined,
        manualStudentIds,
        manualGuardianIds,
      },
      schoolId,
    );
  };

  resolveUpdate = async (
    existing: {
      audience: AnnouncementAudience;
      targetClassId: string | null;
      targetGroupIds: string[];
      audienceCondition: Record<string, unknown> | null;
      manualStudentIds: string[];
      manualGuardianIds: string[];
    },
    input: UpdateAnnouncementInput,
    schoolId: string,
  ): Promise<void> => {
    const audience = input.audience ?? existing.audience;
    const targetClassId =
      input.targetClassId === undefined
        ? existing.targetClassId
        : input.targetClassId;
    const targetGroupIds = input.targetGroupIds ?? existing.targetGroupIds;
    const audienceCondition =
      input.audienceCondition === undefined
        ? existing.audienceCondition
        : input.audienceCondition;
    const manualStudentIds =
      input.manualStudentIds ?? existing.manualStudentIds;
    const manualGuardianIds =
      input.manualGuardianIds ?? existing.manualGuardianIds;
    await this.resolveCreation(
      {
        title: 'validation',
        body: 'validation',
        audience,
        schoolId,
        ...(targetClassId ? { targetClassId } : {}),
        ...(targetGroupIds.length ? { targetGroupIds } : {}),
        ...(audienceCondition ? { audienceCondition } : {}),
        ...(manualStudentIds.length ? { manualStudentIds } : {}),
        ...(manualGuardianIds.length ? { manualGuardianIds } : {}),
      },
      schoolId,
    );
  };

  private resolveSchool = async (
    schoolId: string,
  ): Promise<ResolvedAnnouncementAudience> => {
    const users = await this.userRepo.find({
      where: { schoolId, isActive: true },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    const recipients = users.map((user) =>
      this.toRecipient(
        user,
        user.role === UserRole.PARENT
          ? AnnouncementRecipientKind.PARENT
          : AnnouncementRecipientKind.STAFF,
        [],
        AnnouncementAudienceSource.SCHOOL,
      ),
    );
    return this.buildResult(recipients, {
      source: AnnouncementAudienceSource.SCHOOL,
      users: users.length,
    });
  };

  private resolveStaff = async (
    schoolId: string,
  ): Promise<ResolvedAnnouncementAudience> => {
    const users = await this.userRepo.find({
      where: { schoolId, isActive: true },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    const staff = users.filter((user) => user.role !== UserRole.PARENT);
    return this.buildResult(
      staff.map((user) =>
        this.toRecipient(
          user,
          AnnouncementRecipientKind.STAFF,
          [],
          AnnouncementAudienceSource.STAFF,
        ),
      ),
      { source: AnnouncementAudienceSource.STAFF, users: staff.length },
    );
  };

  private resolveAllGuardians = async (
    schoolId: string,
  ): Promise<ResolvedAnnouncementAudience> => {
    const users = await this.userRepo.find({
      where: { schoolId, role: UserRole.PARENT, isActive: true },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    return this.buildResult(
      users.map((user) =>
        this.toRecipient(
          user,
          AnnouncementRecipientKind.PARENT,
          [],
          AnnouncementAudienceSource.GUARDIANS,
        ),
      ),
      { source: AnnouncementAudienceSource.GUARDIANS, users: users.length },
    );
  };

  private resolveClass = async (
    schoolId: string,
    classId: string | undefined,
  ): Promise<ResolvedAnnouncementAudience> => {
    if (!classId) {
      throw new BadRequestException(
        'A class is required for class announcements',
      );
    }
    const classEntity = await this.classRepo.findOne({
      where: { id: classId, schoolId },
    });
    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }
    const students = await this.studentRepo.find({
      where: { schoolId, currentClassId: classId },
      select: { id: true },
    });
    const links = students.length
      ? await this.studentParentRepo
          .createQueryBuilder('link')
          .innerJoinAndSelect('link.parent', 'parent')
          .where('link.studentId IN (:...studentIds)', {
            studentIds: students.map((student) => student.id),
          })
          .andWhere('parent.schoolId = :schoolId', { schoolId })
          .andWhere('parent.role = :role', { role: UserRole.PARENT })
          .andWhere('parent.isActive = :isActive', { isActive: true })
          .getMany()
      : [];
    const guardians = this.aggregateLinks(
      links,
      AnnouncementAudienceSource.CLASS,
    );
    return this.buildResult(guardians, {
      source: AnnouncementAudienceSource.CLASS,
      classId,
      students: students.length,
    });
  };

  private resolveGroups = async (
    schoolId: string,
    groupIds: string[] | undefined,
  ): Promise<ResolvedAnnouncementAudience> => {
    const ids = Array.from(new Set(groupIds ?? []));
    if (ids.length === 0) {
      throw new BadRequestException('Select at least one guardian group');
    }
    const groups = await this.groupRepo.find({
      where: {
        id: In(ids),
        schoolId,
        isActive: true,
        isDeleted: false,
      },
    });
    const found = new Set(groups.map((group) => group.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length) {
      throw new NotFoundException(
        `Guardian group not found: ${missing.slice(0, 3).join(', ')}`,
      );
    }
    const previews = await Promise.all(
      groups.map((group) => this.membershipService.previewGroup(group)),
    );
    const recipients = this.mergePreviewGuardians(
      previews,
      AnnouncementAudienceSource.GUARDIAN_GROUP,
    );
    const warnings = previews.some(
      (preview) => preview.unevaluableStudentCount > 0,
    )
      ? ['Some students could not be evaluated and were excluded']
      : [];
    return this.buildResult(recipients, {
      source: AnnouncementAudienceSource.GUARDIAN_GROUP,
      selectedGroups: groups.map((group, index) => ({
        id: group.id,
        name: group.name,
        type: group.type,
        uniqueGuardianCount: previews[index].uniqueGuardianCount,
      })),
      warnings,
    });
  };

  private resolveCustom = async (
    schoolId: string,
    condition: Record<string, unknown> | undefined,
  ): Promise<ResolvedAnnouncementAudience> => {
    if (!condition) {
      throw new BadRequestException('A custom audience requires a condition');
    }
    const draft: GuardianGroupDraftInput = {
      name: 'Custom announcement audience',
      type: GuardianGroupType.DYNAMIC,
      condition,
    };
    const preview = await this.membershipService.previewDraft(schoolId, draft);
    const recipients = this.previewToRecipients(
      preview,
      AnnouncementAudienceSource.CUSTOM_CONDITIONS,
    );
    const warnings = preview.unevaluableStudentCount
      ? ['Some students could not be evaluated and were excluded']
      : [];
    return this.buildResult(recipients, {
      source: AnnouncementAudienceSource.CUSTOM_CONDITIONS,
      condition,
      warnings,
    });
  };

  private resolveManualStudents = async (
    schoolId: string,
    studentIds: string[] | undefined,
  ): Promise<ResolvedAnnouncementAudience> => {
    const ids = Array.from(new Set(studentIds ?? []));
    if (ids.length === 0) {
      throw new BadRequestException('Select at least one student');
    }
    const preview = await this.membershipService.previewDraft(schoolId, {
      name: 'Manual student announcement audience',
      type: GuardianGroupType.FIXED,
      studentIds: ids,
    });
    const recipients = this.previewToRecipients(
      preview,
      AnnouncementAudienceSource.MANUAL_STUDENTS,
    );
    const warnings = preview.exclusions.length
      ? ['Some selected students were excluded']
      : [];
    return this.buildResult(recipients, {
      source: AnnouncementAudienceSource.MANUAL_STUDENTS,
      studentIds: ids,
      warnings,
    });
  };

  private resolveManualGuardians = async (
    schoolId: string,
    guardianIds: string[] | undefined,
  ): Promise<ResolvedAnnouncementAudience> => {
    const ids = Array.from(new Set(guardianIds ?? []));
    if (ids.length === 0) {
      throw new BadRequestException('Select at least one guardian');
    }
    const users = await this.userRepo.find({
      where: {
        id: In(ids),
        schoolId,
        role: UserRole.PARENT,
        isActive: true,
      },
    });
    const found = new Set(users.map((user) => user.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length) {
      throw new NotFoundException(
        `Guardian not found: ${missing.slice(0, 3).join(', ')}`,
      );
    }
    const links = await this.studentParentRepo
      .createQueryBuilder('link')
      .innerJoinAndSelect('link.student', 'student')
      .where('link.parentId IN (:...ids)', { ids })
      .andWhere('student.schoolId = :schoolId', { schoolId })
      .getMany();
    const byGuardian = new Map<string, string[]>();
    for (const link of links) {
      const values = byGuardian.get(link.parentId) ?? [];
      values.push(link.studentId);
      byGuardian.set(link.parentId, values);
    }
    const warnings: string[] = [];
    const recipients: ResolvedAnnouncementRecipient[] = [];
    for (const user of users) {
      const studentIds = byGuardian.get(user.id) ?? [];
      if (studentIds.length === 0) {
        warnings.push(
          `${user.firstName} ${user.lastName} has no linked student`,
        );
        continue;
      }
      recipients.push({
        userId: user.id,
        recipientKind: AnnouncementRecipientKind.PARENT,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email ?? null,
        qualifyingStudentIds: Array.from(new Set(studentIds)),
        sources: [AnnouncementAudienceSource.MANUAL_GUARDIANS],
      });
    }
    return this.buildResult(recipients, {
      source: AnnouncementAudienceSource.MANUAL_GUARDIANS,
      guardianIds: ids,
      warnings,
    });
  };

  private aggregateLinks = (
    links: StudentParent[],
    source: AnnouncementAudienceSource,
  ): ResolvedAnnouncementRecipient[] => {
    const byGuardian = new Map<string, ResolvedAnnouncementRecipient>();
    for (const link of links) {
      const parent = link.parent;
      const existing = byGuardian.get(parent.id);
      if (existing) {
        existing.qualifyingStudentIds.push(link.studentId);
        continue;
      }
      byGuardian.set(
        parent.id,
        this.toRecipient(
          parent,
          AnnouncementRecipientKind.PARENT,
          [link.studentId],
          source,
        ),
      );
    }
    return Array.from(byGuardian.values());
  };

  private previewToRecipients = (
    preview: GuardianGroupPreviewType,
    source: AnnouncementAudienceSource,
  ): ResolvedAnnouncementRecipient[] =>
    preview.guardians
      .filter(
        (guardian) =>
          guardian.qualifyingStudentIds.length > 0 ||
          source === AnnouncementAudienceSource.CUSTOM_CONDITIONS,
      )
      .map((guardian) => this.previewGuardianToRecipient(guardian, source));

  private mergePreviewGuardians = (
    previews: GuardianGroupPreviewType[],
    source: AnnouncementAudienceSource,
  ): ResolvedAnnouncementRecipient[] => {
    const merged = new Map<string, ResolvedAnnouncementRecipient>();
    for (const preview of previews) {
      for (const guardian of preview.guardians) {
        const recipient = this.previewGuardianToRecipient(guardian, source);
        const existing = merged.get(recipient.userId);
        if (!existing) {
          merged.set(recipient.userId, recipient);
          continue;
        }
        existing.qualifyingStudentIds = Array.from(
          new Set([
            ...existing.qualifyingStudentIds,
            ...recipient.qualifyingStudentIds,
          ]),
        );
        existing.sources = Array.from(
          new Set([...existing.sources, ...recipient.sources]),
        );
      }
    }
    return Array.from(merged.values());
  };

  private previewGuardianToRecipient = (
    guardian: GuardianGroupGuardianPreviewType,
    source: AnnouncementAudienceSource,
  ): ResolvedAnnouncementRecipient => ({
    userId: guardian.guardianId,
    recipientKind: AnnouncementRecipientKind.PARENT,
    name: guardian.guardianName,
    email: guardian.email ?? null,
    qualifyingStudentIds: Array.from(new Set(guardian.qualifyingStudentIds)),
    sources: [source],
  });

  private toRecipient = (
    user: User,
    recipientKind: AnnouncementRecipientKind,
    qualifyingStudentIds: string[],
    source: AnnouncementAudienceSource,
  ): ResolvedAnnouncementRecipient => ({
    userId: user.id,
    recipientKind,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email ?? null,
    qualifyingStudentIds: Array.from(new Set(qualifyingStudentIds)),
    sources: [source],
  });

  private buildResult = (
    recipients: ResolvedAnnouncementRecipient[],
    details: Record<string, unknown>,
  ): ResolvedAnnouncementAudience => {
    const merged = new Map<string, ResolvedAnnouncementRecipient>();
    for (const recipient of recipients) {
      const existing = merged.get(recipient.userId);
      if (!existing) {
        merged.set(recipient.userId, {
          ...recipient,
          qualifyingStudentIds: Array.from(
            new Set(recipient.qualifyingStudentIds),
          ),
          sources: Array.from(new Set(recipient.sources)),
        });
        continue;
      }
      existing.qualifyingStudentIds = Array.from(
        new Set([
          ...existing.qualifyingStudentIds,
          ...recipient.qualifyingStudentIds,
        ]),
      );
      existing.sources = Array.from(
        new Set([...existing.sources, ...recipient.sources]),
      );
    }
    const unique = Array.from(merged.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const qualifiedStudentIds = new Set(
      unique.flatMap((recipient) => recipient.qualifyingStudentIds),
    );
    const warnings = Array.isArray(details.warnings)
      ? (details.warnings as string[])
      : [];
    const guardianRecipients = unique.filter(
      (recipient) =>
        recipient.recipientKind === AnnouncementRecipientKind.PARENT,
    );
    const generatedAt = new Date();
    const preview: AnnouncementAudiencePreviewType = {
      uniqueGuardianCount: guardianRecipients.length,
      qualifiedStudentCount: qualifiedStudentIds.size,
      excludedCount: Number(details.excludedCount ?? 0),
      unevaluableCount: Number(details.unevaluableCount ?? 0),
      warnings,
      breakdown: details,
      selectedGroups: Array.isArray(details.selectedGroups)
        ? (details.selectedGroups as Record<string, unknown>[])
        : [],
      guardians: guardianRecipients.map((recipient) =>
        this.toGuardianPreview(recipient),
      ),
      generatedAt,
    };
    return {
      recipients: unique,
      preview,
      snapshot: {
        selection: details,
        generatedAt: generatedAt.toISOString(),
        summary: {
          uniqueGuardianCount: preview.uniqueGuardianCount,
          qualifiedStudentCount: preview.qualifiedStudentCount,
          excludedCount: preview.excludedCount,
          unevaluableCount: preview.unevaluableCount,
          warnings: preview.warnings,
        },
        recipients: unique.map((recipient) => ({
          userId: recipient.userId,
          recipientKind: recipient.recipientKind,
          name: recipient.name,
          email: recipient.email,
          qualifyingStudentIds: recipient.qualifyingStudentIds,
          sources: recipient.sources,
        })),
      },
    };
  };

  private toGuardianPreview = (
    recipient: ResolvedAnnouncementRecipient,
  ): AnnouncementAudienceGuardianType => ({
    guardianId: recipient.userId,
    guardianName: recipient.name,
    email: recipient.email,
    qualifyingStudentIds: recipient.qualifyingStudentIds,
    sources: recipient.sources,
  });
}

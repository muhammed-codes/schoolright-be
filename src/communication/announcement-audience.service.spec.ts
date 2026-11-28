import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnnouncementAudienceService } from './services/announcement-audience.service';
import { AnnouncementAudience } from './entities/announcement.entity';
import { GuardianGroupType } from '../guardian-access/guardian-groups/enums/guardian-group.enums';
import { AnnouncementAudienceSource } from './enums/announcement-targeting.enums';

const guardianPreview = (studentIds: string[], guardianId = 'guardian-a') => ({
  guardianId,
  guardianName: 'Parent A',
  email: 'parent@example.com',
  qualifyingStudentIds: studentIds,
  state: 'ACTIVE' as any,
  generatedAt: new Date(),
});

describe('AnnouncementAudienceService', () => {
  const makeService = () => {
    const userRepo = { find: jest.fn().mockResolvedValue([]) };
    const studentRepo = { find: jest.fn().mockResolvedValue([]) };
    const studentParentRepo = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(),
    };
    const classRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'class-a' }),
    };
    const groupRepo = { find: jest.fn().mockResolvedValue([]) };
    const membershipService = {
      previewGroup: jest.fn(),
      previewDraft: jest.fn(),
    };
    const service = new AnnouncementAudienceService(
      userRepo as any,
      studentRepo as any,
      studentParentRepo as any,
      classRepo as any,
      groupRepo as any,
      membershipService as any,
    );
    return {
      service,
      userRepo,
      studentRepo,
      studentParentRepo,
      classRepo,
      groupRepo,
      membershipService,
    };
  };

  it('deduplicates guardians and merges qualifying students across groups', async () => {
    const { service, groupRepo, membershipService } = makeService();
    groupRepo.find.mockResolvedValue([
      {
        id: 'group-a',
        schoolId: 'school-a',
        name: 'Group A',
        type: GuardianGroupType.FIXED,
      },
      {
        id: 'group-b',
        schoolId: 'school-a',
        name: 'Group B',
        type: GuardianGroupType.DYNAMIC,
      },
    ]);
    membershipService.previewGroup
      .mockResolvedValueOnce({
        source: 'FIXED',
        studentCount: 1,
        matchedStudentCount: 1,
        unevaluableStudentCount: 0,
        uniqueGuardianCount: 1,
        students: [],
        exclusions: [],
        guardians: [guardianPreview(['student-a'])],
        breakdown: {},
        generatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        source: 'DYNAMIC',
        studentCount: 1,
        matchedStudentCount: 1,
        unevaluableStudentCount: 0,
        uniqueGuardianCount: 1,
        students: [],
        exclusions: [],
        guardians: [guardianPreview(['student-b'])],
        breakdown: {},
        generatedAt: new Date(),
      });

    const resolved = await service.resolveInput(
      {
        audience: AnnouncementAudience.GUARDIAN_GROUP,
        schoolId: 'school-a',
        targetGroupIds: ['group-a', 'group-b'],
      },
      'school-a',
    );

    expect(resolved.recipients).toHaveLength(1);
    expect(resolved.recipients[0].qualifyingStudentIds).toEqual(
      expect.arrayContaining(['student-a', 'student-b']),
    );
    expect(resolved.recipients[0].sources).toEqual([
      AnnouncementAudienceSource.GUARDIAN_GROUP,
    ]);
    expect(resolved.preview.uniqueGuardianCount).toBe(1);
    expect(resolved.preview.qualifiedStudentCount).toBe(2);
  });

  it('rejects guardians from another school when selecting manual recipients', async () => {
    const { service, userRepo } = makeService();
    userRepo.find.mockResolvedValue([]);

    await expect(
      service.resolveInput(
        {
          audience: AnnouncementAudience.MANUAL_GUARDIANS,
          schoolId: 'school-a',
          manualGuardianIds: ['guardian-other-school'],
        },
        'school-a',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires a selection for a targeted audience', async () => {
    const { service } = makeService();

    await expect(
      service.resolveCreation(
        {
          title: 'Notice',
          body: 'Body',
          audience: AnnouncementAudience.GUARDIAN_GROUP,
        },
        'school-a',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

import {
  Announcement,
  AnnouncementAudience,
} from './entities/announcement.entity';

const TARGETED_AUDIENCES = new Set([
  AnnouncementAudience.GUARDIAN_GROUP,
  AnnouncementAudience.CUSTOM_GUARDIANS,
  AnnouncementAudience.MANUAL_STUDENTS,
  AnnouncementAudience.MANUAL_GUARDIANS,
]);

export const filterAnnouncementsForGuardian = (
  announcements: Announcement[],
  allowedClassIds: Set<string>,
  targetedAnnouncementIds: Set<string> = new Set(),
): Announcement[] =>
  announcements.filter(
    (announcement) =>
      announcement.audience === AnnouncementAudience.SCHOOL ||
      announcement.audience === AnnouncementAudience.GUARDIANS ||
      (announcement.audience === AnnouncementAudience.CLASS &&
        (!announcement.targetClassId ||
          allowedClassIds.has(announcement.targetClassId))) ||
      (TARGETED_AUDIENCES.has(announcement.audience) &&
        targetedAnnouncementIds.has(announcement.id)),
  );

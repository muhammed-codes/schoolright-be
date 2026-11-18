import {
  Announcement,
  AnnouncementAudience,
} from './entities/announcement.entity';

export const filterAnnouncementsForGuardian = (
  announcements: Announcement[],
  allowedClassIds: Set<string>,
): Announcement[] =>
  announcements.filter(
    (announcement) =>
      announcement.audience === AnnouncementAudience.SCHOOL ||
      announcement.audience === AnnouncementAudience.GUARDIANS ||
      (announcement.audience === AnnouncementAudience.CLASS &&
        Boolean(announcement.targetClassId) &&
        allowedClassIds.has(announcement.targetClassId!)),
  );

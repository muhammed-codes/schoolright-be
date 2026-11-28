import { registerEnumType } from '@nestjs/graphql';

export enum AnnouncementDeliveryChannel {
  EXPO_PUSH = 'EXPO_PUSH',
}

export enum AnnouncementDeliveryStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  READ = 'READ',
}

export enum AnnouncementRecipientKind {
  PARENT = 'PARENT',
  STAFF = 'STAFF',
}

export enum AnnouncementAudienceSource {
  SCHOOL = 'SCHOOL',
  STAFF = 'STAFF',
  GUARDIANS = 'GUARDIANS',
  CLASS = 'CLASS',
  GUARDIAN_GROUP = 'GUARDIAN_GROUP',
  CUSTOM_CONDITIONS = 'CUSTOM_CONDITIONS',
  MANUAL_STUDENTS = 'MANUAL_STUDENTS',
  MANUAL_GUARDIANS = 'MANUAL_GUARDIANS',
}

registerEnumType(AnnouncementDeliveryChannel, {
  name: 'AnnouncementDeliveryChannel',
});
registerEnumType(AnnouncementDeliveryStatus, {
  name: 'AnnouncementDeliveryStatus',
});
registerEnumType(AnnouncementRecipientKind, {
  name: 'AnnouncementRecipientKind',
});
registerEnumType(AnnouncementAudienceSource, {
  name: 'AnnouncementAudienceSource',
});

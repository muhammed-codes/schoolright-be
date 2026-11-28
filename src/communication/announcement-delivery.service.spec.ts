import {
  AnnouncementAudience,
  AnnouncementStatus,
} from './entities/announcement.entity';
import {
  AnnouncementAudienceSource,
  AnnouncementDeliveryChannel,
  AnnouncementDeliveryStatus,
  AnnouncementRecipientKind,
} from './enums/announcement-targeting.enums';
import { AnnouncementDeliveryService } from './services/announcement-delivery.service';

describe('AnnouncementDeliveryService', () => {
  const announcement = {
    id: 'announcement-a',
    schoolId: 'school-a',
    title: 'Notice',
    body: 'Body',
    audience: AnnouncementAudience.SCHOOL,
    status: AnnouncementStatus.PUBLISHED,
  };

  const makeService = () => {
    const recipientRepo = {
      create: jest.fn((input: unknown) => input),
      upsert: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        findOne: jest.fn().mockResolvedValue(announcement),
      },
    };
    const deliveryRepo = {
      create: jest.fn((input: unknown) => input),
      upsert: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    const notificationsService = {
      deliverAnnouncementPush: jest.fn(),
    };
    const service = new AnnouncementDeliveryService(
      recipientRepo as any,
      deliveryRepo as any,
      notificationsService as any,
    );
    return { service, recipientRepo, deliveryRepo, notificationsService };
  };

  const resolved = {
    recipients: [
      {
        userId: 'guardian-a',
        recipientKind: AnnouncementRecipientKind.PARENT,
        name: 'Parent A',
        email: 'parent@example.com',
        qualifyingStudentIds: ['student-a'],
        sources: [AnnouncementAudienceSource.SCHOOL],
      },
    ],
    preview: {} as any,
    snapshot: {},
  };

  it('creates recipients and deliveries with idempotent conflict keys', async () => {
    const { service, recipientRepo, deliveryRepo } = makeService();
    recipientRepo.find.mockResolvedValue([
      {
        id: 'recipient-a',
        announcementId: announcement.id,
        userId: 'guardian-a',
      },
    ]);

    await service.createRecipients(
      announcement as any,
      'school-a',
      resolved as any,
    );

    expect(recipientRepo.upsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        conflictPaths: ['announcementId', 'userId'],
      }),
    );
    expect(deliveryRepo.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          announcementId: announcement.id,
          userId: 'guardian-a',
          channel: AnnouncementDeliveryChannel.EXPO_PUSH,
          status: AnnouncementDeliveryStatus.PENDING,
        }),
      ],
      expect.objectContaining({
        conflictPaths: ['announcementId', 'userId', 'channel'],
      }),
    );
  });

  it('records sent and failed delivery results without claiming confirmation', async () => {
    const { service, deliveryRepo, notificationsService } = makeService();
    deliveryRepo.find
      .mockResolvedValueOnce([
        {
          id: 'delivery-a',
          announcementId: announcement.id,
          userId: 'guardian-a',
          attemptCount: 0,
        },
        {
          id: 'delivery-b',
          announcementId: announcement.id,
          userId: 'guardian-b',
          attemptCount: 0,
        },
      ])
      .mockResolvedValueOnce([]);
    notificationsService.deliverAnnouncementPush
      .mockResolvedValueOnce({ status: 'SENT', sentAt: new Date() })
      .mockResolvedValueOnce({
        status: 'FAILED',
        failureReason: 'No valid Expo push token',
        sentAt: null,
      });

    const processed = await service.processPending(announcement.id);

    expect(processed).toBe(2);
    expect(deliveryRepo.update).toHaveBeenCalledWith(
      { id: 'delivery-a' },
      expect.objectContaining({ status: AnnouncementDeliveryStatus.SENT }),
    );
    expect(deliveryRepo.update).toHaveBeenCalledWith(
      { id: 'delivery-b' },
      expect.objectContaining({
        status: AnnouncementDeliveryStatus.FAILED,
        failureReason: 'No valid Expo push token',
      }),
    );
    expect(deliveryRepo.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: AnnouncementDeliveryStatus.DELIVERED }),
    );
  });

  it('does not retry failures that exhausted their attempts', async () => {
    const { service, deliveryRepo } = makeService();
    service.queueProcessing = jest.fn();
    deliveryRepo.find.mockResolvedValue([
      {
        id: 'delivery-a',
        attemptCount: 1,
        status: AnnouncementDeliveryStatus.FAILED,
      },
      {
        id: 'delivery-b',
        attemptCount: 3,
        status: AnnouncementDeliveryStatus.FAILED,
      },
    ]);

    const retried = await service.retryFailed(announcement.id, 'school-a');

    expect(retried).toBe(1);
    expect(deliveryRepo.update).toHaveBeenCalledTimes(1);
    expect(deliveryRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: AnnouncementDeliveryStatus.PENDING }),
    );
  });

  it('keeps an already-read delivery idempotent', async () => {
    const { service, deliveryRepo } = makeService();
    deliveryRepo.findOne.mockResolvedValue({
      id: 'delivery-a',
      status: AnnouncementDeliveryStatus.READ,
      readAt: new Date(),
    });

    await expect(
      service.markRead(announcement.id, 'guardian-a', 'school-a'),
    ).resolves.toBe(true);
    expect(deliveryRepo.update).not.toHaveBeenCalled();
  });
});

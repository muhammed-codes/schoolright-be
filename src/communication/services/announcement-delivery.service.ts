import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NotificationsService } from '../../notifications/notifications.service';
import { Announcement } from '../entities/announcement.entity';
import { AnnouncementDelivery } from '../entities/announcement-delivery.entity';
import { AnnouncementRecipient } from '../entities/announcement-recipient.entity';
import { ResolvedAnnouncementAudience } from './announcement-audience.service';
import {
  AnnouncementDeliveryChannel,
  AnnouncementDeliveryStatus,
  AnnouncementRecipientKind,
} from '../enums/announcement-targeting.enums';
import {
  AnnouncementDeliveryReportItemType,
  AnnouncementDeliverySummaryType,
  AnnouncementReadStateType,
} from '../dto/announcement-targeting-output.dto';

const MAX_ATTEMPTS = 3;

@Injectable()
export class AnnouncementDeliveryService {
  private readonly processing = new Set<string>();

  constructor(
    @InjectRepository(AnnouncementRecipient)
    private readonly recipientRepo: Repository<AnnouncementRecipient>,
    @InjectRepository(AnnouncementDelivery)
    private readonly deliveryRepo: Repository<AnnouncementDelivery>,
    private readonly notificationsService: NotificationsService,
  ) {}

  createRecipients = async (
    announcement: Announcement,
    schoolId: string,
    resolved: ResolvedAnnouncementAudience,
  ): Promise<{ recipientCount: number; deliveryCount: number }> => {
    const recipientRows = resolved.recipients.map((recipient) =>
      this.recipientRepo.create({
        schoolId,
        announcementId: announcement.id,
        userId: recipient.userId,
        recipientKind: recipient.recipientKind,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        qualifyingStudentIds: recipient.qualifyingStudentIds,
        audienceSources: recipient.sources,
        snapshot: {
          audience: announcement.audience,
          name: recipient.name,
          email: recipient.email,
          qualifyingStudentIds: recipient.qualifyingStudentIds,
          sources: recipient.sources,
          resolvedAt: new Date().toISOString(),
        },
      }),
    );
    if (recipientRows.length) {
      await this.recipientRepo.upsert(recipientRows, {
        conflictPaths: ['announcementId', 'userId'],
        skipUpdateIfNoValuesChanged: true,
      });
    }
    const recipients = await this.recipientRepo.find({
      where: { announcementId: announcement.id },
    });
    const deliveryRows = recipients.map((recipient) =>
      this.deliveryRepo.create({
        schoolId,
        announcementId: announcement.id,
        recipientId: recipient.id,
        userId: recipient.userId,
        channel: AnnouncementDeliveryChannel.EXPO_PUSH,
        status: AnnouncementDeliveryStatus.PENDING,
        attemptCount: 0,
        idempotencyKey: `${announcement.id}:${recipient.userId}:${AnnouncementDeliveryChannel.EXPO_PUSH}`,
      }),
    );
    if (deliveryRows.length) {
      await this.deliveryRepo.upsert(deliveryRows, {
        conflictPaths: ['announcementId', 'userId', 'channel'],
        skipUpdateIfNoValuesChanged: true,
      });
    }
    return {
      recipientCount: recipients.length,
      deliveryCount: deliveryRows.length,
    };
  };

  queueProcessing = (announcementId: string): void => {
    setImmediate(() => {
      void this.processPending(announcementId);
    });
  };

  processPending = async (announcementId: string): Promise<number> => {
    if (this.processing.has(announcementId)) return 0;
    this.processing.add(announcementId);
    try {
      const announcement = await this.getAnnouncement(announcementId);
      let processed = 0;
      while (true) {
        const pending = await this.deliveryRepo.find({
          where: {
            announcementId,
            status: AnnouncementDeliveryStatus.PENDING,
          },
          order: { createdAt: 'ASC' },
          take: 100,
        });
        if (pending.length === 0) break;
        for (const delivery of pending) {
          const claimed = await this.deliveryRepo.update(
            {
              id: delivery.id,
              status: AnnouncementDeliveryStatus.PENDING,
            },
            {
              status: AnnouncementDeliveryStatus.PROCESSING,
              attemptCount: delivery.attemptCount + 1,
              lastAttemptAt: new Date(),
            },
          );
          if (!claimed.affected) continue;
          processed += 1;
          const result =
            await this.notificationsService.deliverAnnouncementPush(
              delivery.userId,
              announcement.title,
              announcement.body,
              {
                announcementId: announcement.id,
                type: 'announcement',
              },
            );
          if (result.status === 'SENT') {
            await this.deliveryRepo.update(
              { id: delivery.id },
              {
                status: AnnouncementDeliveryStatus.SENT,
                sentAt: result.sentAt,
                failureReason: null,
              },
            );
          } else {
            await this.deliveryRepo.update(
              { id: delivery.id },
              {
                status: AnnouncementDeliveryStatus.FAILED,
                failedAt: new Date(),
                failureReason: result.failureReason ?? 'Delivery failed',
              },
            );
          }
        }
      }
      return processed;
    } finally {
      this.processing.delete(announcementId);
    }
  };

  retryFailed = async (
    announcementId: string,
    schoolId: string,
    deliveryId?: string,
  ): Promise<number> => {
    await this.getAnnouncement(announcementId, schoolId);
    const failed = await this.deliveryRepo.find({
      where: {
        announcementId,
        status: AnnouncementDeliveryStatus.FAILED,
        ...(deliveryId ? { id: deliveryId } : {}),
      },
    });
    const retryable = failed.filter(
      (delivery) => delivery.attemptCount < MAX_ATTEMPTS,
    );
    if (!retryable.length) return 0;
    await this.deliveryRepo.update(
      { id: In(retryable.map((delivery) => delivery.id)) },
      {
        status: AnnouncementDeliveryStatus.PENDING,
        failureReason: null,
        failedAt: null,
      },
    );
    this.queueProcessing(announcementId);
    return retryable.length;
  };

  markRead = async (
    announcementId: string,
    userId: string,
    schoolId: string,
  ): Promise<boolean> => {
    await this.getAnnouncement(announcementId, schoolId);
    const delivery = await this.deliveryRepo.findOne({
      where: {
        announcementId,
        userId,
        channel: AnnouncementDeliveryChannel.EXPO_PUSH,
      },
    });
    if (!delivery) {
      throw new NotFoundException('Announcement recipient record not found');
    }
    if (delivery.status === AnnouncementDeliveryStatus.READ) return true;
    await this.deliveryRepo.update(
      { id: delivery.id },
      {
        status: AnnouncementDeliveryStatus.READ,
        readAt: new Date(),
      },
    );
    return true;
  };

  getReadState = async (
    announcementId: string,
    userId: string,
    schoolId: string,
  ): Promise<AnnouncementReadStateType> => {
    await this.getAnnouncement(announcementId, schoolId);
    const delivery = await this.deliveryRepo.findOne({
      where: {
        announcementId,
        userId,
        channel: AnnouncementDeliveryChannel.EXPO_PUSH,
      },
    });
    return {
      announcementId,
      isRead: delivery?.status === AnnouncementDeliveryStatus.READ,
      readAt: delivery?.readAt ?? null,
    };
  };

  getRecipientAnnouncementIds = async (
    userId: string,
    schoolId: string,
  ): Promise<Set<string>> => {
    const recipients = await this.recipientRepo.find({
      where: { userId, schoolId },
      select: { announcementId: true },
    });
    return new Set(recipients.map((recipient) => recipient.announcementId));
  };

  getSummary = async (
    announcementId: string,
    schoolId: string,
  ): Promise<AnnouncementDeliverySummaryType> => {
    await this.getAnnouncement(announcementId, schoolId);
    const [total, grouped] = await Promise.all([
      this.recipientRepo.count({ where: { announcementId } }),
      this.deliveryRepo
        .createQueryBuilder('delivery')
        .select('delivery.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('delivery.announcementId = :announcementId', { announcementId })
        .groupBy('delivery.status')
        .getRawMany<{ status: AnnouncementDeliveryStatus; count: string }>(),
    ]);
    const counts = new Map(
      grouped.map((item) => [item.status, Number(item.count)]),
    );
    const count = (status: AnnouncementDeliveryStatus) =>
      counts.get(status) ?? 0;
    return {
      total,
      pending: count(AnnouncementDeliveryStatus.PENDING),
      processing: count(AnnouncementDeliveryStatus.PROCESSING),
      sent: count(AnnouncementDeliveryStatus.SENT),
      delivered: count(AnnouncementDeliveryStatus.DELIVERED),
      failed: count(AnnouncementDeliveryStatus.FAILED),
      read: count(AnnouncementDeliveryStatus.READ),
      successful:
        count(AnnouncementDeliveryStatus.SENT) +
        count(AnnouncementDeliveryStatus.DELIVERED) +
        count(AnnouncementDeliveryStatus.READ),
    };
  };

  getReport = async (
    announcementId: string,
    schoolId: string,
    options: {
      page?: number;
      limit?: number;
      status?: AnnouncementDeliveryStatus;
      channel?: AnnouncementDeliveryChannel;
    } = {},
  ): Promise<{
    items: AnnouncementDeliveryReportItemType[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    await this.getAnnouncement(announcementId, schoolId);
    const page = options.page || 1;
    const limit = options.limit || 50;
    const query = this.deliveryRepo
      .createQueryBuilder('delivery')
      .leftJoinAndMapOne(
        'delivery.recipient',
        AnnouncementRecipient,
        'recipient',
        'recipient.id = delivery.recipientId',
      )
      .where('delivery.announcementId = :announcementId', { announcementId })
      .orderBy('delivery.createdAt', 'ASC');
    if (options.status) {
      query.andWhere('delivery.status = :status', { status: options.status });
    }
    if (options.channel) {
      query.andWhere('delivery.channel = :channel', {
        channel: options.channel,
      });
    }
    const [deliveries, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return {
      items: deliveries.map((delivery) => ({
        id: delivery.id,
        announcementId: delivery.announcementId,
        userId: delivery.userId,
        recipientName: delivery.recipient?.recipientName ?? null,
        recipientEmail: delivery.recipient?.recipientEmail ?? null,
        recipientKind:
          delivery.recipient?.recipientKind ?? AnnouncementRecipientKind.PARENT,
        qualifyingStudentIds: delivery.recipient?.qualifyingStudentIds ?? [],
        audienceSources: delivery.recipient?.audienceSources ?? [],
        channel: delivery.channel,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        lastAttemptAt: delivery.lastAttemptAt,
        sentAt: delivery.sentAt,
        deliveredAt: delivery.deliveredAt,
        readAt: delivery.readAt,
        failureReason: delivery.failureReason,
        createdAt: delivery.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  };

  private getAnnouncement = async (
    id: string,
    schoolId?: string,
  ): Promise<Announcement> => {
    const announcement = await this.recipientRepo.manager.findOne(
      Announcement,
      {
        where: { id, ...(schoolId ? { schoolId } : {}) },
      },
    );
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  };
}

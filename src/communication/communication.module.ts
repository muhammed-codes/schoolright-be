import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessModule } from '../access/access.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClassEntity } from '../classes/entities/class.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { Student } from '../students/entities/student.entity';
import { User } from '../users/entities/user.entity';
import { GuardianGroup } from '../guardian-access/guardian-groups/entities/guardian-group.entity';
import { GuardianGroupsModule } from '../guardian-access/guardian-groups/guardian-groups.module';
import { Announcement } from './entities/announcement.entity';
import { AnnouncementDelivery } from './entities/announcement-delivery.entity';
import { AnnouncementRecipient } from './entities/announcement-recipient.entity';
import { AnnouncementAudienceService } from './services/announcement-audience.service';
import { AnnouncementDeliveryService } from './services/announcement-delivery.service';
import { CommunicationResolver } from './communication.resolver';
import { CommunicationService } from './communication.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Announcement,
      ClassEntity,
      StudentParent,
      Student,
      User,
      GuardianGroup,
      AnnouncementRecipient,
      AnnouncementDelivery,
    ]),
    AccessModule,
    NotificationsModule,
    GuardianGroupsModule,
  ],
  providers: [
    CommunicationResolver,
    CommunicationService,
    AnnouncementAudienceService,
    AnnouncementDeliveryService,
  ],
  exports: [CommunicationService],
})
export class CommunicationModule {}

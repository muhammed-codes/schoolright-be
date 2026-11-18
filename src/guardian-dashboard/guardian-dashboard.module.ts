import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { User } from '../users/entities/user.entity';
import { AttendanceModule } from '../attendance/attendance.module';
import { CommunicationModule } from '../communication/communication.module';
import { FeesModule } from '../fees/fees.module';
import { GuardianAccessModule } from '../guardian-access/guardian-access.module';
import { ResultsModule } from '../results/results.module';
import { SchoolsModule } from '../schools/schools.module';
import { TermsModule } from '../terms/terms.module';
import { TimetableModule } from '../timetable/timetable.module';
import { GuardianDashboardResolver } from './guardian-dashboard.resolver';
import { GuardianDashboardService } from './guardian-dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Student, StudentParent]),
    GuardianAccessModule,
    AttendanceModule,
    CommunicationModule,
    FeesModule,
    ResultsModule,
    SchoolsModule,
    TermsModule,
    TimetableModule,
  ],
  providers: [GuardianDashboardResolver, GuardianDashboardService],
  exports: [GuardianDashboardService],
})
export class GuardianDashboardModule {}

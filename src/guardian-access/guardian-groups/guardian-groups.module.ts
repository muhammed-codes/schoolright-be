import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from '../../classes/entities/class.entity';
import { Student } from '../../students/entities/student.entity';
import { StudentParent } from '../../students/entities/student-parent.entity';
import { User } from '../../users/entities/user.entity';
import { GuardianAccessModule } from '../guardian-access.module';
import { GuardianGroup } from './entities/guardian-group.entity';
import { GuardianGroupGuardian } from './entities/guardian-group-guardian.entity';
import { GuardianGroupStudent } from './entities/guardian-group-student.entity';
import { GuardianGroupResolver } from './guardian-groups.resolver';
import { GuardianGroupMembershipService } from './services/guardian-group-membership.service';
import { GuardianGroupService } from './services/guardian-group.service';

@Module({
  imports: [
    GuardianAccessModule,
    TypeOrmModule.forFeature([
      ClassEntity,
      GuardianGroup,
      GuardianGroupGuardian,
      GuardianGroupStudent,
      Student,
      StudentParent,
      User,
    ]),
  ],
  providers: [
    GuardianGroupResolver,
    GuardianGroupMembershipService,
    GuardianGroupService,
  ],
  exports: [GuardianGroupService, GuardianGroupMembershipService],
})
export class GuardianGroupsModule {}

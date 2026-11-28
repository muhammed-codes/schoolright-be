import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationModule } from '../automation/automation.module';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { Session } from '../terms/entities/session.entity';
import { Term } from '../terms/entities/term.entity';
import { FeeCategory } from '../fees/entities/fee-category.entity';
import { StudentInvoice } from '../fees/entities/student-invoice.entity';
import { TermsModule } from '../terms/terms.module';
import { User } from '../users/entities/user.entity';
import { GuardianAccessResolver } from './guardian-access.resolver';
import { GuardianAccessAuditLog } from './entities/guardian-access-audit-log.entity';
import { GuardianAccessException } from './entities/guardian-access-exception.entity';
import { GuardianAccessPolicy } from './entities/guardian-access-policy.entity';
import { GuardianAccessPolicyRule } from './entities/guardian-access-policy-rule.entity';
import { GuardianAccessAuditService } from './services/guardian-access-audit.service';
import { GuardianAccessEvaluator } from './services/guardian-access-evaluator.service';
import { GuardianConditionEvaluator } from './services/guardian-condition-evaluator.service';
import { GuardianConditionValidator } from './services/guardian-condition-validator.service';
import { GuardianEnforcementService } from './services/guardian-enforcement.service';
import { GuardianExceptionService } from './services/guardian-exception.service';
import { GuardianFeeMetricService } from './services/guardian-fee-metric.service';
import { GuardianPolicyManagementService } from './services/guardian-policy-management.service';
import { GuardianPolicyPreviewService } from './services/guardian-policy-preview.service';
import { GuardianPolicyRuleService } from './services/guardian-policy-rule.service';

@Global()
@Module({
  imports: [
    AutomationModule,
    TermsModule,
    TypeOrmModule.forFeature([
      GuardianAccessAuditLog,
      GuardianAccessException,
      GuardianAccessPolicy,
      GuardianAccessPolicyRule,
      Student,
      StudentParent,
      Session,
      Term,
      FeeCategory,
      StudentInvoice,
      User,
    ]),
  ],
  providers: [
    GuardianAccessResolver,
    GuardianAccessAuditService,
    GuardianAccessEvaluator,
    GuardianConditionEvaluator,
    GuardianConditionValidator,
    GuardianEnforcementService,
    GuardianExceptionService,
    GuardianFeeMetricService,
    GuardianPolicyManagementService,
    GuardianPolicyPreviewService,
    GuardianPolicyRuleService,
  ],
  exports: [
    GuardianAccessAuditService,
    GuardianAccessEvaluator,
    GuardianConditionEvaluator,
    GuardianConditionValidator,
    GuardianEnforcementService,
    GuardianFeeMetricService,
    GuardianPolicyPreviewService,
  ],
})
export class GuardianAccessModule {}

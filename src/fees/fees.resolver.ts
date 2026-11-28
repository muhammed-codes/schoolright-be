import { FeeClassLookup, FeeStudentLookup } from './dto/fee-directory.type';
import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import {
  ForbiddenException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';

import { FeesService } from './fees.service';
import { FeeCategory } from './entities/fee-category.entity';
import { FeeStructure } from './entities/fee-structure.entity';
import { StudentFeeOverride } from './entities/student-fee-override.entity';
import { SchoolBankAccount } from './entities/school-bank-account.entity';
import {
  StudentInvoice,
  InvoiceStatus,
} from './entities/student-invoice.entity';
import { PaymentSubmissionBatch } from './entities/payment-submission-batch.entity';
import {
  PaymentSubmissionStudentShare,
  PaymentShareStatus,
} from './entities/payment-submission-student-share.entity';
import { FeeApprovalConfig } from './entities/fee-approval-config.entity';
import { ReceiptTemplate } from './entities/receipt-template.entity';
import { Receipt } from './entities/receipt.entity';
import { StaffFeeVisibilityConfig } from './entities/staff-fee-visibility-config.entity';
import { GraphQLJSONObject } from '../common/scalars/json-object.scalar';

import { JwtAuthGuard, PermissionGuard, RolesGuard } from '../common/guards';
import { CurrentUser, RequirePermission, Roles } from '../common/decorators';
import { UserRole } from '../common/enums';
import { AppResource } from '../access/enums/resource.enum';
import { PermissionAction } from '../access/enums/permission-action.enum';
import { PaginationArgs, createPaginatedType } from '../common/pagination';
import { GuardianEnforcementService } from '../guardian-access/services/guardian-enforcement.service';
import {
  GuardianAction,
  GuardianResource,
} from '../guardian-access/enums/guardian-permission.enums';

const PaginatedPaymentSubmissionBatch = createPaginatedType(
  PaymentSubmissionBatch,
);
const PaginatedStudentInvoice = createPaginatedType(StudentInvoice);

import { FeeOverview, ClassFeeLedger } from './dto/fee-overview.type';

import {
  CreateFeeCategoryInput,
  UpdateFeeCategoryInput,
  CreateFeeStructureInput,
  BulkCreateFeeStructureInput,
  BulkCreateOverrideInput,
  CreateBankAccountInput,
  UpdateBankAccountInput,
  GenerateInvoicesInput,
  SubmitPaymentBatchInput,
  ApproveShareInput,
  RejectShareInput,
  UpsertApprovalConfigInput,
  UpdateVisibilityConfigInput,
  InvoiceFilterInput,
  RecordOfflinePaymentInput,
  CreateReceiptTemplateInput,
  UpdateReceiptTemplateInput,
} from './dto/fees.input';
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
class GenerateInvoicesResult {
  @Field(() => Int)
  generated!: number;

  @Field(() => Int)
  skipped!: number;
}

const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.BURSAR,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.HEAD_TEACHER,
  UserRole.CLASS_TEACHER,
  UserRole.SUBJECT_TEACHER,
];

const PARENT_AND_STAFF_ROLES: UserRole[] = [UserRole.PARENT, ...STAFF_ROLES];

type AuthUser = { sub: string; schoolId: string; role: UserRole };

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles(...STAFF_ROLES)
export class FeesResolver {
  constructor(
    private readonly feesService: FeesService,
    private readonly guardianEnforcement: GuardianEnforcementService,
  ) {}

  @Query(() => [FeeClassLookup])
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  feeClassLookup(@CurrentUser() user: AuthUser) {
    return this.feesService.getFeeClassLookup(
      user.schoolId,
      user.sub,
      user.role,
    );
  }

  @Query(() => [FeeStudentLookup])
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  feeStudentLookup(
    @CurrentUser() user: AuthUser,
    @Args('classId', { nullable: true }) classId?: string,
  ) {
    return this.feesService.getFeeStudentLookup(
      user.schoolId,
      user.sub,
      user.role,
      classId,
    );
  }

  // ─── Fee Categories ───────────────────────────────────────────────────────

  @Mutation(() => FeeCategory)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.CREATE)
  createFeeCategory(
    @Args('input') input: CreateFeeCategoryInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.createFeeCategory(input, user.schoolId, user.sub);
  }

  @Query(() => [FeeCategory])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  feeCategories(@CurrentUser() user: AuthUser) {
    return this.feesService.getFeeCategories(user.schoolId);
  }

  @Query(() => [FeeCategory])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  allFeeCategories(@CurrentUser() user: AuthUser) {
    return this.feesService.getAllFeeCategories(user.schoolId);
  }

  @Mutation(() => FeeCategory)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.UPDATE)
  updateFeeCategory(
    @Args('id') id: string,
    @Args('input') input: UpdateFeeCategoryInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.updateFeeCategory(id, input, user.schoolId);
  }

  // ─── Fee Structures ────────────────────────────────────────────────────────

  @Mutation(() => FeeStructure)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.CREATE)
  createFeeStructure(
    @Args('input') input: CreateFeeStructureInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.createFeeStructure(input, user.schoolId, user.sub);
  }

  @Mutation(() => [FeeStructure])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.CREATE)
  bulkCreateFeeStructures(
    @Args('input') input: BulkCreateFeeStructureInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.bulkCreateFeeStructures(
      input,
      user.schoolId,
      user.sub,
    );
  }

  @Query(() => [FeeStructure])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  feeStructures(
    @Args('sessionId') sessionId: string,
    @Args('termId', { type: () => String, nullable: true })
    termId: string | undefined,
    @CurrentUser() user: AuthUser,
    @Args('classId', { type: () => String, nullable: true })
    classId?: string,
  ) {
    return this.feesService.getFeeStructures(
      user.schoolId,
      sessionId,
      termId,
      classId,
    );
  }

  @Query(() => FeeStructure, { nullable: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  feeStructure(@Args('id') id: string, @CurrentUser() user: AuthUser) {
    return this.feesService.getFeeStructureById(id, user.schoolId);
  }

  @Mutation(() => FeeStructure)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.UPDATE)
  updateFeeStructureAmount(
    @Args('id') id: string,
    @Args('amount', { type: () => Int }) amount: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.updateFeeStructure(id, amount, user.schoolId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.UPDATE)
  deactivateFeeStructure(
    @Args('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.deactivateFeeStructure(id, user.schoolId);
  }

  // ─── Overrides / Discounts ────────────────────────────────────────────────

  @Mutation(() => [StudentFeeOverride])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.UPDATE)
  bulkCreateFeeOverrides(
    @Args('input') input: BulkCreateOverrideInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.bulkCreateOverrides(input, user.schoolId, user.sub);
  }

  @Query(() => [StudentFeeOverride])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  feeOverrides(
    @CurrentUser() user: AuthUser,
    @Args('feeStructureId', { type: () => String, nullable: true })
    feeStructureId?: string,
    @Args('studentId', { type: () => String, nullable: true })
    studentId?: string,
    @Args('sessionId', { type: () => String, nullable: true })
    sessionId?: string,
    @Args('termId', { type: () => String, nullable: true })
    termId?: string,
    @Args('classId', { type: () => String, nullable: true })
    classId?: string,
  ) {
    return this.feesService.getOverrides(
      user.schoolId,
      feeStructureId,
      studentId,
      sessionId,
      termId,
      classId,
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.UPDATE)
  removeFeeOverride(@Args('id') id: string, @CurrentUser() user: AuthUser) {
    return this.feesService.removeOverride(id, user.schoolId);
  }

  // ─── Bank Accounts ────────────────────────────────────────────────────────

  @Mutation(() => SchoolBankAccount)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.CREATE)
  createBankAccount(
    @Args('input') input: CreateBankAccountInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.createBankAccount(input, user.schoolId, user.sub);
  }

  @Query(() => [SchoolBankAccount])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PARENT_AND_STAFF_ROLES)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  async bankAccounts(@CurrentUser() user: AuthUser) {
    if (user.role === UserRole.PARENT) {
      const allowed = await this.guardianEnforcement.getAllowedChildren(
        user.sub,
        user.schoolId,
        GuardianResource.FEES,
        GuardianAction.VIEW,
      );
      if (!allowed.length) {
        throw new ForbiddenException(
          'Guardian policy does not allow fee access for any linked child',
        );
      }
    }
    return this.feesService.getBankAccounts(user.schoolId);
  }

  @Mutation(() => SchoolBankAccount)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.UPDATE)
  updateBankAccount(
    @Args('id') id: string,
    @Args('input') input: UpdateBankAccountInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.updateBankAccount(id, input, user.schoolId);
  }

  @Query(() => [SchoolBankAccount])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  resolvedBankAccounts(
    @CurrentUser() user: AuthUser,
    @Args('feeCategoryId', { type: () => String, nullable: true })
    feeCategoryId?: string,
  ) {
    return this.feesService.resolveBankAccountsForCategory(
      user.schoolId,
      feeCategoryId,
    );
  }

  // ─── Invoices ─────────────────────────────────────────────────────────────

  @Mutation(() => GenerateInvoicesResult)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.CREATE)
  generateInvoices(
    @Args('input') input: GenerateInvoicesInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.generateInvoices(input, user.schoolId);
  }

  @Query(() => StudentInvoice, { nullable: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PARENT_AND_STAFF_ROLES)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  async invoice(@Args('id') id: string, @CurrentUser() user: AuthUser) {
    const invoice = await this.feesService.getInvoiceById(
      id,
      user.schoolId,
      user.sub,
      user.role,
    );
    if (user.role === UserRole.PARENT) {
      await this.guardianEnforcement.assertPermission(
        user.sub,
        user.schoolId,
        invoice.studentId,
        GuardianResource.INVOICES,
        GuardianAction.VIEW,
      );
    }
    return invoice;
  }

  @Query(() => PaginatedStudentInvoice)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  invoices(
    @CurrentUser() user: AuthUser,
    @Args('filter', { type: () => InvoiceFilterInput, nullable: true })
    filter?: InvoiceFilterInput,
    @Args() pagination?: PaginationArgs,
  ) {
    return this.feesService.getPaginatedInvoices(
      user.schoolId,
      filter,
      pagination,
      user.sub,
      user.role,
    );
  }

  @Query(() => FeeOverview)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  feeOverview(
    @CurrentUser() user: AuthUser,
    @Args('sessionId', { type: () => String, nullable: true })
    sessionId?: string,
    @Args('termId', { type: () => String, nullable: true })
    termId?: string,
    @Args('classId', { type: () => String, nullable: true })
    classId?: string,
  ) {
    return this.feesService.getFeeOverview(
      user.schoolId,
      sessionId,
      termId,
      classId,
      user.sub,
      user.role,
    );
  }

  @Query(() => [StudentInvoice])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PARENT_AND_STAFF_ROLES)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  async myStudentInvoices(
    @Args('studentId') studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role === UserRole.PARENT) {
      await this.guardianEnforcement.assertPermission(
        user.sub,
        user.schoolId,
        studentId,
        GuardianResource.INVOICES,
        GuardianAction.VIEW,
      );
    }
    return this.feesService.getStudentInvoicesForUser(
      studentId,
      user.sub,
      user.role,
      user.schoolId,
    );
  }

  @Query(() => [StudentInvoice])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  classInvoices(
    @Args('classId') classId: string,
    @CurrentUser() user: AuthUser,
    @Args('sessionId', { type: () => String, nullable: true })
    sessionId?: string,
    @Args('termId', { type: () => String, nullable: true })
    termId?: string,
  ) {
    return this.feesService.getClassInvoicesForStaff(
      user.sub,
      user.role,
      classId,
      user.schoolId,
      sessionId,
      termId,
    );
  }

  @Query(() => ClassFeeLedger)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  classFeeLedger(
    @Args('classId') classId: string,
    @CurrentUser() user: AuthUser,
    @Args('sessionId', { type: () => String, nullable: true })
    sessionId?: string,
    @Args('termId', { type: () => String, nullable: true })
    termId?: string,
    @Args('search', { type: () => String, nullable: true })
    search?: string,
    @Args('status', { type: () => InvoiceStatus, nullable: true })
    status?: InvoiceStatus,
    @Args('sortBy', { type: () => String, nullable: true })
    sortBy?: string,
  ) {
    return this.feesService.getClassFeeLedger(
      classId,
      user.schoolId,
      sessionId,
      termId,
      user.role,
      search,
      status,
      sortBy,
      user.sub,
    );
  }

  // ─── Payment Submissions ──────────────────────────────────────────────────

  @Mutation(() => PaymentSubmissionBatch)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT)
  async submitPaymentBatch(
    @Args('input') input: SubmitPaymentBatchInput,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role === UserRole.PARENT) {
      await Promise.all(
        input.shares.map((share) =>
          this.guardianEnforcement.assertPermission(
            user.sub,
            user.schoolId,
            share.studentId,
            GuardianResource.PAYMENT_SUBMISSION,
            GuardianAction.SUBMIT,
          ),
        ),
      );
    }
    return this.feesService.submitPaymentBatch(input, user.schoolId, user.sub);
  }

  @Query(() => PaymentSubmissionBatch, { nullable: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PARENT_AND_STAFF_ROLES)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  async paymentSubmission(
    @Args('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const batch = await this.feesService.getPaymentSubmissionById(
      id,
      user.schoolId,
      user.sub,
      user.role,
    );
    if (user.role === UserRole.PARENT) {
      const allowed = await this.getAllowedPaymentHistoryStudents(user);
      if ((batch.shares ?? []).some((share) => !allowed.has(share.studentId))) {
        throw new ForbiddenException(
          'Guardian policy does not allow access to this payment submission',
        );
      }
    }
    return batch;
  }

  @Query(() => [PaymentSubmissionBatch])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT)
  async myPaymentSubmissions(@CurrentUser() user: AuthUser) {
    const batches = await this.feesService.getParentSubmissions(
      user.sub,
      user.schoolId,
    );
    return this.filterParentPaymentHistory(batches, user);
  }

  @Query(() => PaginatedPaymentSubmissionBatch)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT)
  async myPaymentSubmissionsPage(
    @Args() pagination: PaginationArgs,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role !== UserRole.PARENT) {
      return this.feesService.getParentSubmissionsPaginated(
        user.sub,
        user.schoolId,
        pagination,
      );
    }
    const batches = await this.filterParentPaymentHistory(
      await this.feesService.getParentSubmissions(user.sub, user.schoolId),
      user,
    );
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;
    const skip = (page - 1) * limit;
    return {
      items: batches.slice(skip, skip + limit),
      total: batches.length,
      page,
      totalPages: Math.ceil(batches.length / limit),
    };
  }

  private getAllowedPaymentHistoryStudents = async (user: AuthUser) => {
    const allowed = await this.guardianEnforcement.getAllowedChildren(
      user.sub,
      user.schoolId,
      GuardianResource.PAYMENT_HISTORY,
      GuardianAction.VIEW,
    );
    return new Set(allowed.map((child) => child.studentId));
  };

  private filterParentPaymentHistory = async (
    batches: PaymentSubmissionBatch[],
    user: AuthUser,
  ) => {
    if (user.role !== UserRole.PARENT) return batches;
    const allowed = await this.getAllowedPaymentHistoryStudents(user);
    return batches.filter((batch) =>
      (batch.shares ?? []).every((share) => allowed.has(share.studentId)),
    );
  };

  // ─── Approval Queue ────────────────────────────────────────────────────────

  @Query(() => [PaymentSubmissionStudentShare])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  pendingApprovalQueue(@CurrentUser() user: AuthUser) {
    return this.feesService.getPendingQueue(user.sub, user.role, user.schoolId);
  }

  @Query(() => [PaymentSubmissionStudentShare])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  schoolPaymentShares(
    @CurrentUser() user: AuthUser,
    @Args('status', { type: () => PaymentShareStatus, nullable: true })
    status?: PaymentShareStatus,
    @Args('search', { type: () => String, nullable: true })
    search?: string,
  ) {
    return this.feesService.getSchoolPaymentShares(
      user.schoolId,
      status,
      search,
      user.sub,
      user.role,
    );
  }

  @Mutation(() => PaymentSubmissionStudentShare)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.CREATE)
  recordOfflinePayment(
    @Args('input') input: RecordOfflinePaymentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.recordOfflinePayment(
      input,
      user.sub,
      user.schoolId,
    );
  }

  @Mutation(() => PaymentSubmissionStudentShare)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.APPROVE)
  approvePaymentShare(
    @Args('input') input: ApproveShareInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.approveShare(
      input,
      user.sub,
      user.role,
      user.schoolId,
    );
  }

  @Mutation(() => PaymentSubmissionStudentShare)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.APPROVE)
  rejectPaymentShare(
    @Args('input') input: RejectShareInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.rejectShare(input, user.sub, user.schoolId);
  }

  // ─── Approval Config ───────────────────────────────────────────────────────

  @Mutation(() => FeeApprovalConfig)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.CONFIGURE)
  upsertApprovalConfig(
    @Args('input') input: UpsertApprovalConfigInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.upsertApprovalConfig(
      input,
      user.schoolId,
      user.sub,
    );
  }

  @Query(() => [FeeApprovalConfig])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  approvalConfigs(@CurrentUser() user: AuthUser) {
    return this.feesService.getApprovalConfigs(user.schoolId);
  }

  // ─── Receipts ──────────────────────────────────────────────────────────────

  @Query(() => Receipt, { nullable: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PARENT_AND_STAFF_ROLES)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  async paymentReceipt(
    @Args('shareId') shareId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role === UserRole.PARENT) {
      const share = await this.feesService.getShareById(shareId);
      if (!share || share.batch?.schoolId !== user.schoolId) {
        throw new NotFoundException('Receipt not found');
      }
      await this.guardianEnforcement.assertPermission(
        user.sub,
        user.schoolId,
        share.studentId,
        GuardianResource.RECEIPTS,
        GuardianAction.VIEW,
      );
    }
    return this.feesService.getReceipt(
      shareId,
      user.sub,
      user.role,
      user.schoolId,
    );
  }

  @Query(() => [ReceiptTemplate])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  receiptTemplates(@CurrentUser() user: AuthUser) {
    return this.feesService.getReceiptTemplates(user.schoolId);
  }

  @Query(() => ReceiptTemplate, { nullable: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  receiptTemplate(@Args('id') id: string, @CurrentUser() user: AuthUser) {
    return this.feesService.getReceiptTemplateById(id, user.schoolId);
  }

  @Mutation(() => ReceiptTemplate, { nullable: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.UPDATE)
  setDefaultReceiptTemplate(
    @Args('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.setDefaultReceiptTemplate(id, user.schoolId);
  }

  @Mutation(() => ReceiptTemplate)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.CREATE)
  createReceiptTemplate(
    @Args('input', { type: () => CreateReceiptTemplateInput, nullable: true })
    input: CreateReceiptTemplateInput | undefined,
    @Args('name', { type: () => String, nullable: true })
    name: string | undefined,
    @Args('templateKey', { type: () => String, nullable: true })
    templateKey: string | undefined,
    @Args('thumbnailUrl', { type: () => String, nullable: true })
    thumbnailUrl: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const finalInput: CreateReceiptTemplateInput = input || {
      name: name || 'Custom Receipt',
      templateKey: templateKey || 'custom',
      thumbnailUrl,
    };
    return this.feesService.createReceiptTemplate(finalInput, user.schoolId);
  }

  @Mutation(() => ReceiptTemplate)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.UPDATE)
  updateReceiptTemplate(
    @Args('id') id: string,
    @Args('input') input: UpdateReceiptTemplateInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.updateReceiptTemplate(id, input, user.schoolId);
  }

  @Mutation(() => ReceiptTemplate)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.CREATE)
  duplicateReceiptTemplate(
    @Args('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.duplicateReceiptTemplate(id, user.schoolId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.DELETE)
  deleteReceiptTemplate(@Args('id') id: string, @CurrentUser() user: AuthUser) {
    return this.feesService.deleteReceiptTemplate(id, user.schoolId);
  }

  @Query(() => String)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  previewReceiptTemplateHtml(
    @Args('config', { type: () => GraphQLJSONObject, nullable: true })
    config: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.previewReceiptTemplateHtml(config, user.schoolId);
  }

  @Mutation(() => String)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PARENT_AND_STAFF_ROLES)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  async generateReceiptHtml(
    @Args('shareId') shareId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role === UserRole.PARENT) {
      const share = await this.feesService.getShareById(shareId);
      if (!share || share.batch?.schoolId !== user.schoolId) {
        throw new NotFoundException('Receipt not found');
      }
      await this.guardianEnforcement.assertPermission(
        user.sub,
        user.schoolId,
        share.studentId,
        GuardianResource.RECEIPTS,
        GuardianAction.VIEW,
      );
    }
    return this.feesService.generateReceiptHtml(
      shareId,
      user.sub,
      user.role,
      user.schoolId,
    );
  }

  @Mutation(() => String)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...PARENT_AND_STAFF_ROLES)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  async generateReceiptPdf(
    @Args('shareId') shareId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.role === UserRole.PARENT) {
      const share = await this.feesService.getShareById(shareId);
      if (!share || share.batch?.schoolId !== user.schoolId) {
        throw new NotFoundException('Receipt not found');
      }
      await this.guardianEnforcement.assertPermission(
        user.sub,
        user.schoolId,
        share.studentId,
        GuardianResource.RECEIPTS,
        GuardianAction.VIEW,
      );
    }
    return this.feesService.generateReceiptPdf(
      shareId,
      user.sub,
      user.role,
      user.schoolId,
    );
  }

  // ─── Staff Visibility ──────────────────────────────────────────────────────

  @Query(() => [StaffFeeVisibilityConfig])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.READ)
  staffFeeVisibilityConfigs(@CurrentUser() user: AuthUser) {
    return this.feesService.getVisibilityConfig(user.schoolId);
  }

  @Mutation(() => StaffFeeVisibilityConfig)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermission(AppResource.FEES, PermissionAction.CONFIGURE)
  upsertStaffFeeVisibility(
    @Args('input') input: UpdateVisibilityConfigInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.upsertVisibilityConfig(
      input,
      user.schoolId,
      user.sub,
    );
  }
}

import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard, PermissionGuard, RolesGuard } from '../common/guards';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { AppResource } from '../access/enums/resource.enum';
import { PermissionAction } from '../access/enums/permission-action.enum';
import { IdCardsService } from './id-cards.service';
import { IdCardTemplate } from './entities/id-card-template.entity';
import { SchoolIdCardSettings } from './entities/school-id-card-settings.entity';
import { IdCardType } from './enums/id-card.enums';
import {
  IdCardRenderResult,
  IdCardPdfResult,
  UpdateSchoolIdCardSettingsInput,
  RenderStudentIdCardInput,
  RenderStaffIdCardInput,
  RenderBatchStudentIdCardsInput,
  RenderBatchStaffIdCardsInput,
  GenerateStudentIdCardPdfInput,
  GenerateStaffIdCardPdfInput,
  GenerateBatchStudentIdCardsPdfInput,
  GenerateBatchStaffIdCardsPdfInput,
  CreateIdCardTemplateInput,
  UpdateIdCardTemplateInput,
  PreviewIdCardInput,
} from './dto/id-card.dto';

@Resolver()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
export class IdCardsResolver {
  constructor(private readonly idCardsService: IdCardsService) {}

  @Query(() => [IdCardTemplate], {
    name: 'idCardTemplates',
    description: 'List all active ID card templates',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.READ)
  idCardTemplates(
    @Args('cardType', { type: () => IdCardType, nullable: true })
    cardType?: IdCardType,
    @CurrentUser() user?: { schoolId: string },
  ): Promise<IdCardTemplate[]> {
    return this.idCardsService.getTemplates(cardType, user?.schoolId);
  }

  @Mutation(() => IdCardTemplate, {
    name: 'createIdCardTemplate',
    description: 'Create a custom ID card template for the school',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.CREATE)
  createIdCardTemplate(
    @Args('input') input: CreateIdCardTemplateInput,
    @CurrentUser() user: { schoolId: string },
  ): Promise<IdCardTemplate> {
    return this.idCardsService.createCustomTemplate(user.schoolId, input);
  }

  @Mutation(() => IdCardTemplate, {
    name: 'updateIdCardTemplate',
    description: 'Update a custom ID card template for the school',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.UPDATE)
  updateIdCardTemplate(
    @Args('id') id: string,
    @Args('input') input: UpdateIdCardTemplateInput,
    @CurrentUser() user: { schoolId: string },
  ): Promise<IdCardTemplate> {
    return this.idCardsService.updateCustomTemplate(id, user.schoolId, input);
  }

  @Mutation(() => IdCardTemplate, {
    name: 'duplicateIdCardTemplate',
    description: 'Duplicate an ID card template for customization',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.CREATE)
  duplicateIdCardTemplate(
    @Args('id') id: string,
    @CurrentUser() user: { schoolId: string },
  ): Promise<IdCardTemplate> {
    return this.idCardsService.duplicateCustomTemplate(id, user.schoolId);
  }

  @Mutation(() => Boolean, {
    name: 'deleteIdCardTemplate',
    description: 'Delete a custom ID card template',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.DELETE)
  deleteIdCardTemplate(
    @Args('id') id: string,
    @CurrentUser() user: { schoolId: string },
  ): Promise<boolean> {
    return this.idCardsService.deleteCustomTemplate(id, user.schoolId);
  }

  @Query(() => IdCardRenderResult, {
    name: 'previewIdCardHtml',
    description: 'Preview an ID card template design with sample data',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.READ)
  previewIdCardHtml(
    @Args('input') input: PreviewIdCardInput,
    @CurrentUser() user: { schoolId: string },
  ): Promise<IdCardRenderResult> {
    return this.idCardsService.previewIdCardHtml(user.schoolId, input);
  }

  @Query(() => IdCardTemplate, {
    name: 'idCardTemplate',
    description: 'Get an ID card template by ID or key',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.READ)
  idCardTemplate(@Args('id') id: string): Promise<IdCardTemplate> {
    return this.idCardsService.getTemplateById(id);
  }

  @Query(() => SchoolIdCardSettings, {
    name: 'schoolIdCardSettings',
    description:
      'Get ID card configuration and default template settings for the current school',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.READ)
  schoolIdCardSettings(
    @CurrentUser() user: { schoolId: string },
  ): Promise<SchoolIdCardSettings> {
    return this.idCardsService.getSchoolSettings(user.schoolId);
  }

  @Mutation(() => SchoolIdCardSettings, {
    name: 'updateSchoolIdCardSettings',
    description:
      'Update ID card configuration and default templates for the school',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.UPDATE)
  updateSchoolIdCardSettings(
    @Args('input') input: UpdateSchoolIdCardSettingsInput,
    @CurrentUser() user: { schoolId: string },
  ): Promise<SchoolIdCardSettings> {
    return this.idCardsService.updateSchoolSettings(user.schoolId, input);
  }

  @Query(() => IdCardRenderResult, {
    name: 'renderStudentIdCard',
    description: 'Render HTML for a single student ID card with preview',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.READ)
  renderStudentIdCard(
    @Args('input') input: RenderStudentIdCardInput,
    @CurrentUser() user: { sub: string; schoolId: string; role: string },
  ): Promise<IdCardRenderResult> {
    return this.idCardsService.renderStudentCard(user.schoolId, input, {
      userId: user.sub,
      role: user.role,
    });
  }

  @Query(() => IdCardRenderResult, {
    name: 'renderStaffIdCard',
    description: 'Render HTML for a single staff ID card with preview',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.READ)
  renderStaffIdCard(
    @Args('input') input: RenderStaffIdCardInput,
    @CurrentUser() user: { schoolId: string },
  ): Promise<IdCardRenderResult> {
    return this.idCardsService.renderStaffCard(user.schoolId, input);
  }

  @Query(() => IdCardRenderResult, {
    name: 'renderBatchStudentIdCards',
    description: 'Render HTML for multiple student ID cards in batch',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.READ)
  renderBatchStudentIdCards(
    @Args('input') input: RenderBatchStudentIdCardsInput,
    @CurrentUser() user: { sub: string; schoolId: string; role: string },
  ): Promise<IdCardRenderResult> {
    return this.idCardsService.renderBatchStudentCards(user.schoolId, input, {
      userId: user.sub,
      role: user.role,
    });
  }

  @Query(() => IdCardRenderResult, {
    name: 'renderBatchStaffIdCards',
    description: 'Render HTML for multiple staff ID cards in batch',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.READ)
  renderBatchStaffIdCards(
    @Args('input') input: RenderBatchStaffIdCardsInput,
    @CurrentUser() user: { schoolId: string },
  ): Promise<IdCardRenderResult> {
    return this.idCardsService.renderBatchStaffCards(user.schoolId, input);
  }

  @Mutation(() => IdCardPdfResult, {
    name: 'generateStudentIdCardPdf',
    description: 'Generate print-ready PDF for a single student ID card',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.GENERATE)
  generateStudentIdCardPdf(
    @Args('input') input: GenerateStudentIdCardPdfInput,
    @CurrentUser() user: { sub: string; schoolId: string; role: string },
  ): Promise<IdCardPdfResult> {
    return this.idCardsService.generateStudentCardPdf(user.schoolId, input, {
      userId: user.sub,
      role: user.role,
    });
  }

  @Mutation(() => IdCardPdfResult, {
    name: 'generateStaffIdCardPdf',
    description: 'Generate print-ready PDF for a single staff ID card',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.GENERATE)
  generateStaffIdCardPdf(
    @Args('input') input: GenerateStaffIdCardPdfInput,
    @CurrentUser() user: { schoolId: string },
  ): Promise<IdCardPdfResult> {
    return this.idCardsService.generateStaffCardPdf(user.schoolId, input);
  }

  @Mutation(() => IdCardPdfResult, {
    name: 'generateBatchStudentIdCardsPdf',
    description:
      'Generate print-ready PDF for multiple student ID cards in batch',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.GENERATE)
  generateBatchStudentIdCardsPdf(
    @Args('input') input: GenerateBatchStudentIdCardsPdfInput,
    @CurrentUser() user: { sub: string; schoolId: string; role: string },
  ): Promise<IdCardPdfResult> {
    return this.idCardsService.generateBatchStudentCardsPdf(
      user.schoolId,
      input,
      { userId: user.sub, role: user.role },
    );
  }

  @Mutation(() => IdCardPdfResult, {
    name: 'generateBatchStaffIdCardsPdf',
    description:
      'Generate print-ready PDF for multiple staff ID cards in batch',
  })
  @RequirePermission(AppResource.ID_CARDS, PermissionAction.GENERATE)
  generateBatchStaffIdCardsPdf(
    @Args('input') input: GenerateBatchStaffIdCardsPdfInput,
    @CurrentUser() user: { schoolId: string },
  ): Promise<IdCardPdfResult> {
    return this.idCardsService.generateBatchStaffCardsPdf(user.schoolId, input);
  }
}

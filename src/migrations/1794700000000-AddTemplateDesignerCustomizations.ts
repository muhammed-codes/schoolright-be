import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemplateDesignerCustomizations1794700000000
  implements MigrationInterface
{
  name = 'AddTemplateDesignerCustomizations1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Receipt templates customizations
    await queryRunner.query(
      `ALTER TABLE "receipt_templates" ADD COLUMN IF NOT EXISTS "config" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_templates" ADD COLUMN IF NOT EXISTS "description" text`,
    );

    // 2. ID card templates school scoping
    await queryRunner.query(
      `ALTER TABLE "id_card_templates" ADD COLUMN IF NOT EXISTS "schoolId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_id_card_templates_schoolId" ON "id_card_templates" ("schoolId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "id_card_templates" DROP CONSTRAINT IF EXISTS "UQ_id_card_templates_key"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_id_card_templates_school_key" ON "id_card_templates" (COALESCE("schoolId", '00000000-0000-0000-0000-000000000000'::uuid), "key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_id_card_templates_school_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_id_card_templates_schoolId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "id_card_templates" DROP COLUMN IF EXISTS "schoolId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_templates" DROP COLUMN IF EXISTS "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "receipt_templates" DROP COLUMN IF EXISTS "config"`,
    );
  }
}

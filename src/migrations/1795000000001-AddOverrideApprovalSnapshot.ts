import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOverrideApprovalSnapshot1795000000001 implements MigrationInterface {
  name = 'AddOverrideApprovalSnapshot1795000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        ADD COLUMN IF NOT EXISTS "overrideApprovalStatus"
          "public"."fee_override_approval_status_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        DROP COLUMN IF EXISTS "overrideApprovalStatus"
    `);
  }
}

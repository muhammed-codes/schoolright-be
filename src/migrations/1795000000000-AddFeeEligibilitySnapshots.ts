import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeeEligibilitySnapshots1795000000000
  implements MigrationInterface
{
  name = 'AddFeeEligibilitySnapshots1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."fee_override_approval_status_enum"
          AS ENUM ('PENDING','APPROVED','REJECTED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "student_fee_overrides"
        ADD COLUMN IF NOT EXISTS "approvalStatus"
          "public"."fee_override_approval_status_enum"
          NOT NULL DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
      ALTER TABLE "student_fee_overrides"
        ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "student_fee_overrides"
        ADD COLUMN IF NOT EXISTS "approvedBy" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        ADD COLUMN IF NOT EXISTS "originalAmount" integer
    `);

    await queryRunner.query(`
      UPDATE "student_invoice_items"
      SET "originalAmount" = "amount"
      WHERE "originalAmount" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        ALTER COLUMN "originalAmount" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        ADD COLUMN IF NOT EXISTS "overrideAmount" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        ADD COLUMN IF NOT EXISTS "overrideType"
          "public"."fee_override_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        ADD COLUMN IF NOT EXISTS "overrideId" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        DROP COLUMN IF EXISTS "overrideId"
    `);

    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        DROP COLUMN IF EXISTS "overrideType"
    `);

    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        DROP COLUMN IF EXISTS "overrideAmount"
    `);

    await queryRunner.query(`
      ALTER TABLE "student_invoice_items"
        DROP COLUMN IF EXISTS "originalAmount"
    `);

    await queryRunner.query(`
      ALTER TABLE "student_fee_overrides"
        DROP COLUMN IF EXISTS "approvedBy"
    `);

    await queryRunner.query(`
      ALTER TABLE "student_fee_overrides"
        DROP COLUMN IF EXISTS "approvedAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "student_fee_overrides"
        DROP COLUMN IF EXISTS "approvalStatus"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."fee_override_approval_status_enum"
    `);
  }
}

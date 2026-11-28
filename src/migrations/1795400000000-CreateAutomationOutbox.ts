import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAutomationOutbox1795400000000 implements MigrationInterface {
  name = 'CreateAutomationOutbox1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."automation_event_type_enum" AS ENUM (
          'PAYMENT_APPROVED',
          'PAYMENT_REVERSED',
          'PAYMENT_REJECTED',
          'FEE_ALLOCATION_CHANGED',
          'FEE_DISCOUNT_CHANGED',
          'FEE_WAIVER_CHANGED',
          'INVOICE_CHANGED',
          'ATTENDANCE_RECORDED',
          'ATTENDANCE_CORRECTED',
          'ATTENDANCE_STATUS_CHANGED',
          'STUDENT_CLASS_CHANGED',
          'STUDENT_STATUS_CHANGED',
          'GUARDIAN_RELATIONSHIP_ADDED',
          'GUARDIAN_RELATIONSHIP_CHANGED',
          'GUARDIAN_RELATIONSHIP_REMOVED',
          'GUARDIAN_GROUP_CREATED',
          'GUARDIAN_GROUP_UPDATED',
          'GUARDIAN_GROUP_MEMBERS_CHANGED',
          'GUARDIAN_GROUP_CONDITION_CHANGED',
          'GUARDIAN_GROUP_ACTIVATED',
          'GUARDIAN_GROUP_DEACTIVATED',
          'GUARDIAN_ACCESS_POLICY_CHANGED',
          'GUARDIAN_ACCESS_POLICY_DISABLED',
          'TERM_CHANGED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE "public"."automation_outbox_status_enum" AS ENUM (
          'PENDING',
          'PROCESSING',
          'COMPLETED',
          'FAILED',
          'DEAD'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "automation_outbox_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "schoolId" uuid NOT NULL,
        "type" "public"."automation_event_type_enum" NOT NULL,
        "aggregateType" varchar NOT NULL,
        "aggregateId" uuid,
        "actorId" uuid,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "status" "public"."automation_outbox_status_enum" NOT NULL DEFAULT 'PENDING',
        "attemptCount" integer NOT NULL DEFAULT 0,
        "availableAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastAttemptAt" TIMESTAMP,
        "processedAt" TIMESTAMP,
        "failureReason" text,
        "idempotencyKey" varchar(128) NOT NULL,
        CONSTRAINT "PK_automation_outbox_events" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_automation_outbox_idempotency" UNIQUE ("idempotencyKey")
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_automation_outbox_status_available"
      ON "automation_outbox_events" ("status", "availableAt");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_automation_outbox_school_created"
      ON "automation_outbox_events" ("schoolId", "createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "automation_outbox_events";`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."automation_outbox_status_enum";`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."automation_event_type_enum";`,
    );
  }
}

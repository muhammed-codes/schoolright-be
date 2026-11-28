import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTargetedAnnouncementDelivery1795300000000 implements MigrationInterface {
  name = 'CreateTargetedAnnouncementDelivery1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."announcement_audience_enum" ADD VALUE IF NOT EXISTS 'guardian_group';
      ALTER TYPE "public"."announcement_audience_enum" ADD VALUE IF NOT EXISTS 'custom_guardians';
      ALTER TYPE "public"."announcement_audience_enum" ADD VALUE IF NOT EXISTS 'manual_students';
      ALTER TYPE "public"."announcement_audience_enum" ADD VALUE IF NOT EXISTS 'manual_guardians';
      DO $$ BEGIN
        CREATE TYPE "public"."announcement_delivery_channel_enum" AS ENUM ('EXPO_PUSH');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE "public"."announcement_delivery_status_enum" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'READ');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE "public"."announcement_recipient_kind_enum" AS ENUM ('PARENT', 'STAFF');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "announcements"
      ADD COLUMN IF NOT EXISTS "targetGroupIds" uuid[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "audienceCondition" jsonb,
      ADD COLUMN IF NOT EXISTS "manualStudentIds" uuid[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "manualGuardianIds" uuid[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "audienceSnapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "audienceResolvedAt" TIMESTAMP;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcement_recipients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "schoolId" uuid NOT NULL,
        "announcementId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "recipientKind" "public"."announcement_recipient_kind_enum" NOT NULL,
        "recipientName" varchar,
        "recipientEmail" varchar,
        "qualifyingStudentIds" uuid[] NOT NULL DEFAULT '{}',
        "audienceSources" jsonb NOT NULL DEFAULT '[]',
        "snapshot" jsonb NOT NULL DEFAULT '{}',
        CONSTRAINT "PK_announcement_recipients" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_announcement_recipients_announcement_user"
      ON "announcement_recipients" ("announcementId", "userId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_announcement_recipients_school_user"
      ON "announcement_recipients" ("schoolId", "userId");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcement_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "schoolId" uuid NOT NULL,
        "announcementId" uuid NOT NULL,
        "recipientId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "channel" "public"."announcement_delivery_channel_enum" NOT NULL,
        "status" "public"."announcement_delivery_status_enum" NOT NULL DEFAULT 'PENDING',
        "attemptCount" integer NOT NULL DEFAULT 0,
        "idempotencyKey" varchar NOT NULL,
        "lastAttemptAt" TIMESTAMP,
        "sentAt" TIMESTAMP,
        "deliveredAt" TIMESTAMP,
        "readAt" TIMESTAMP,
        "failedAt" TIMESTAMP,
        "failureReason" text,
        CONSTRAINT "PK_announcement_deliveries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_announcement_deliveries_idempotency_key" UNIQUE ("idempotencyKey")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_announcement_deliveries_announcement_user_channel"
      ON "announcement_deliveries" ("announcementId", "userId", "channel");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_announcement_deliveries_status"
      ON "announcement_deliveries" ("status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_announcement_deliveries_announcement"
      ON "announcement_deliveries" ("announcementId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "announcement_deliveries";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "announcement_recipients";`);
    await queryRunner.query(`
      ALTER TABLE "announcements"
      DROP COLUMN IF EXISTS "audienceResolvedAt",
      DROP COLUMN IF EXISTS "audienceSnapshot",
      DROP COLUMN IF EXISTS "manualGuardianIds",
      DROP COLUMN IF EXISTS "manualStudentIds",
      DROP COLUMN IF EXISTS "audienceCondition",
      DROP COLUMN IF EXISTS "targetGroupIds";
    `);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."announcement_recipient_kind_enum";`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."announcement_delivery_status_enum";`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."announcement_delivery_channel_enum";`,
    );
  }
}

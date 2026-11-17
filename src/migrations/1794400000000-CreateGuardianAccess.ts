import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuardianAccess1794400000000 implements MigrationInterface {
  name = 'CreateGuardianAccess1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "guardian_policy_scope_enum" AS ENUM ('SCHOOL_DEFAULT', 'DYNAMIC_SEGMENT', 'STUDENT_OVERRIDE');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE "guardian_effect_enum" AS ENUM ('ALLOW', 'DENY');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE "guardian_resource_enum" AS ENUM ('CHILD_PROFILE', 'RESULTS', 'ATTENDANCE', 'TIMETABLE', 'FEES', 'INVOICES', 'PAYMENT_SUBMISSION', 'PAYMENT_HISTORY', 'RECEIPTS', 'COMMUNICATION');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE "guardian_action_enum" AS ENUM ('VIEW', 'SUBMIT');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE "guardian_audit_action_enum" AS ENUM ('POLICY_CREATED', 'POLICY_UPDATED', 'POLICY_DELETED', 'POLICY_ENABLED', 'POLICY_DISABLED', 'RULE_CREATED', 'RULE_UPDATED', 'RULE_DELETED', 'EXCEPTION_CREATED', 'EXCEPTION_UPDATED', 'EXCEPTION_REMOVED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guardian_access_policies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "schoolId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "scope" "guardian_policy_scope_enum" NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "priority" integer NOT NULL DEFAULT 0,
        "condition" jsonb,
        "studentId" uuid,
        "createdById" uuid NOT NULL,
        "updatedById" uuid NOT NULL,
        CONSTRAINT "PK_guardian_access_policies" PRIMARY KEY ("id")
      );`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_guardian_policies_school_default"
      ON "guardian_access_policies" ("schoolId")
      WHERE "scope" = 'SCHOOL_DEFAULT';`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_guardian_policies_school_student"
      ON "guardian_access_policies" ("schoolId", "studentId")
      WHERE "scope" = 'STUDENT_OVERRIDE';`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_access_policies_school_scope"
      ON "guardian_access_policies" ("schoolId", "scope");`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_access_policies_school_student"
      ON "guardian_access_policies" ("schoolId", "studentId");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guardian_access_policy_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "policyId" uuid NOT NULL,
        "resource" "guardian_resource_enum" NOT NULL,
        "action" "guardian_action_enum" NOT NULL,
        "effect" "guardian_effect_enum" NOT NULL,
        CONSTRAINT "PK_guardian_access_policy_rules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_guardian_policy_rules_policy_resource_action" UNIQUE ("policyId", "resource", "action"),
        CONSTRAINT "FK_guardian_policy_rules_policy" FOREIGN KEY ("policyId")
          REFERENCES "guardian_access_policies" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_policy_rules_policy"
      ON "guardian_access_policy_rules" ("policyId");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guardian_access_exceptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "schoolId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        "guardianId" uuid,
        "resource" "guardian_resource_enum" NOT NULL,
        "action" "guardian_action_enum" NOT NULL,
        "effect" "guardian_effect_enum" NOT NULL,
        "reason" text NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "createdById" uuid NOT NULL,
        "updatedById" uuid NOT NULL,
        CONSTRAINT "PK_guardian_access_exceptions" PRIMARY KEY ("id")
      );`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_exceptions_school_student"
      ON "guardian_access_exceptions" ("schoolId", "studentId");`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_exceptions_guardian"
      ON "guardian_access_exceptions" ("schoolId", "guardianId");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guardian_access_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "schoolId" uuid NOT NULL,
        "actorId" uuid NOT NULL,
        "action" "guardian_audit_action_enum" NOT NULL,
        "entityType" character varying NOT NULL,
        "entityId" uuid,
        "beforeState" jsonb,
        "afterState" jsonb,
        CONSTRAINT "PK_guardian_access_audit_logs" PRIMARY KEY ("id")
      );`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_audit_school_created"
      ON "guardian_access_audit_logs" ("schoolId", "createdAt");`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_audit_school_entity"
      ON "guardian_access_audit_logs" ("schoolId", "entityType", "entityId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "guardian_access_audit_logs";`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "guardian_access_exceptions";`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "guardian_access_policy_rules";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "guardian_access_policies";`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "guardian_audit_action_enum";`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "guardian_action_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "guardian_resource_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "guardian_effect_enum";`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "guardian_policy_scope_enum";`,
    );
  }
}

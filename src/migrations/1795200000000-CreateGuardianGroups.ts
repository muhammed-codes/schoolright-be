import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuardianGroups1795200000000 implements MigrationInterface {
  name = 'CreateGuardianGroups1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "guardian_group_type_enum" AS ENUM ('DYNAMIC', 'FIXED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE "guardian_group_membership_source_enum" AS ENUM ('DYNAMIC', 'FIXED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE "guardian_group_membership_state_enum" AS ENUM ('ACTIVE', 'INACTIVE', 'UNEVALUABLE');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      ALTER TYPE "guardian_audit_action_enum" ADD VALUE IF NOT EXISTS 'GROUP_CREATED';
      ALTER TYPE "guardian_audit_action_enum" ADD VALUE IF NOT EXISTS 'GROUP_UPDATED';
      ALTER TYPE "guardian_audit_action_enum" ADD VALUE IF NOT EXISTS 'GROUP_ACTIVATED';
      ALTER TYPE "guardian_audit_action_enum" ADD VALUE IF NOT EXISTS 'GROUP_ARCHIVED';
      ALTER TYPE "guardian_audit_action_enum" ADD VALUE IF NOT EXISTS 'GROUP_DELETED';
      ALTER TYPE "guardian_audit_action_enum" ADD VALUE IF NOT EXISTS 'GROUP_MEMBERS_UPDATED';
      ALTER TYPE "guardian_audit_action_enum" ADD VALUE IF NOT EXISTS 'GROUP_EVALUATED';
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guardian_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "schoolId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "type" "guardian_group_type_enum" NOT NULL,
        "condition" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdById" uuid NOT NULL,
        "updatedById" uuid NOT NULL,
        CONSTRAINT "PK_guardian_groups" PRIMARY KEY ("id")
      );`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_guardian_groups_school_name"
      ON "guardian_groups" ("schoolId", "name")
      WHERE "isDeleted" = false;`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_groups_school_active_type"
      ON "guardian_groups" ("schoolId", "isActive", "type");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guardian_group_students" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "groupId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        "schoolId" uuid NOT NULL,
        "source" "guardian_group_membership_source_enum" NOT NULL,
        "state" "guardian_group_membership_state_enum" NOT NULL,
        "reason" text,
        "evaluation" jsonb,
        "evaluatedAt" TIMESTAMP WITH TIME ZONE,
        "actorId" uuid,
        CONSTRAINT "PK_guardian_group_students" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_guardian_group_students_group_student" UNIQUE ("groupId", "studentId"),
        CONSTRAINT "FK_guardian_group_students_group" FOREIGN KEY ("groupId")
          REFERENCES "guardian_groups" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_group_students_group_state"
      ON "guardian_group_students" ("groupId", "state");`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_group_students_school_student"
      ON "guardian_group_students" ("schoolId", "studentId");`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guardian_group_guardians" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "groupId" uuid NOT NULL,
        "guardianId" uuid NOT NULL,
        "schoolId" uuid NOT NULL,
        "qualifyingStudentIds" uuid array NOT NULL DEFAULT '{}',
        "source" "guardian_group_membership_source_enum" NOT NULL,
        "state" "guardian_group_membership_state_enum" NOT NULL,
        "reason" text,
        "evaluatedAt" TIMESTAMP WITH TIME ZONE,
        "actorId" uuid,
        CONSTRAINT "PK_guardian_group_guardians" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_guardian_group_guardians_group_guardian" UNIQUE ("groupId", "guardianId"),
        CONSTRAINT "FK_guardian_group_guardians_group" FOREIGN KEY ("groupId")
          REFERENCES "guardian_groups" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_group_guardians_group_state"
      ON "guardian_group_guardians" ("groupId", "state");`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_group_guardians_school_guardian"
      ON "guardian_group_guardians" ("schoolId", "guardianId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "guardian_group_guardians";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guardian_group_students";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "guardian_groups";`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "guardian_group_membership_state_enum";`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "guardian_group_membership_source_enum";`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "guardian_group_type_enum";`);
  }
}

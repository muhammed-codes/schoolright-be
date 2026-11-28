import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Fix teacher role permissions for FEES and EXPENSES resources.
 *
 * Problem: Due to a cross-join in a previous migration (PreserveSchoolPermissionProfiles),
 * CLASS_TEACHER and SUBJECT_TEACHER roles ended up with canRead=true on 'fees' and 'expenses'
 * resources. This is incorrect — these roles should NOT have access to finance modules by default.
 *
 * Fix: Set canRead=false (and all other permissions=false) for class_teacher and subject_teacher
 * on fees and expenses resources. This is non-destructive: if a school admin explicitly re-enables
 * these permissions via the Permissions page, that individual grant will override the defaults.
 *
 * This migration is reversible (down() restores canRead=true if needed), though restoration
 * is not recommended.
 */
export class FixTeacherFinancePermissions1795100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove canRead (and all permissions) for class_teacher and subject_teacher on fees and expenses
    await queryRunner.query(`
      UPDATE role_permissions
      SET
        "canRead"   = false,
        "canCreate" = false,
        "canUpdate" = false,
        "canDelete" = false
      WHERE
        role IN ('class_teacher', 'subject_teacher')
        AND resource IN ('fees', 'expenses')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore canRead=true for class_teacher and subject_teacher on fees and expenses
    // (this would re-introduce the original incorrect permissions — only use in emergency rollback)
    await queryRunner.query(`
      UPDATE role_permissions
      SET "canRead" = true
      WHERE
        role IN ('class_teacher', 'subject_teacher')
        AND resource IN ('fees', 'expenses')
    `);
  }
}

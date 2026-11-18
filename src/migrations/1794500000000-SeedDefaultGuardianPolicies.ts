import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDefaultGuardianPolicies1794500000000 implements MigrationInterface {
  name = 'SeedDefaultGuardianPolicies1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schools: Array<{ id: string }> = await queryRunner.query(
      `SELECT "id" FROM "schools"`,
    );

    const resources = [
      'CHILD_PROFILE',
      'RESULTS',
      'ATTENDANCE',
      'TIMETABLE',
      'FEES',
      'INVOICES',
      'PAYMENT_SUBMISSION',
      'PAYMENT_HISTORY',
      'RECEIPTS',
      'COMMUNICATION',
    ];

    for (const school of schools) {
      const existing: Array<{ id: string }> = await queryRunner.query(
        `SELECT "id" FROM "guardian_access_policies" WHERE "schoolId" = $1 AND "scope" = 'SCHOOL_DEFAULT'`,
        [school.id],
      );

      if (existing.length === 0) {
        const users: Array<{ id: string }> = await queryRunner.query(
          `SELECT "id" FROM "users" WHERE "schoolId" = $1 ORDER BY CASE WHEN "role" = 'school_admin' THEN 0 ELSE 1 END LIMIT 1`,
          [school.id],
        );
        if (users.length === 0) continue;
        const actorId = users[0].id;

        const inserted: Array<{ id: string }> = await queryRunner.query(
          `INSERT INTO "guardian_access_policies" ("schoolId", "name", "description", "scope", "enabled", "priority", "createdById", "updatedById")
           VALUES ($1, 'School Default Access Policy', 'Default policy granting linked guardians standard view and payment access.', 'SCHOOL_DEFAULT', true, 0, $2, $2)
           RETURNING "id"`,
          [school.id, actorId],
        );
        const policyId = inserted[0].id;

        for (const res of resources) {
          const action = res === 'PAYMENT_SUBMISSION' ? 'SUBMIT' : 'VIEW';
          await queryRunner.query(
            `INSERT INTO "guardian_access_policy_rules" ("policyId", "resource", "action", "effect")
             VALUES ($1, $2, $3, 'ALLOW')
             ON CONFLICT ("policyId", "resource", "action") DO NOTHING`,
            [policyId, res, action],
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "guardian_access_policies" WHERE "scope" = 'SCHOOL_DEFAULT' AND "name" = 'School Default Access Policy'`,
    );
  }
}

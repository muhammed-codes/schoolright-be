import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolTimezone1794600000000 implements MigrationInterface {
  name = 'AddSchoolTimezone1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "timezone" varchar NOT NULL DEFAULT 'Africa/Lagos'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "schools" DROP COLUMN IF EXISTS "timezone"`,
    );
  }
}

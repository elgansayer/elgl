import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessProfiles1723832325123 implements MigrationInterface {
  name = 'AddBusinessProfiles1723832325123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "business_name" text,
        ADD COLUMN IF NOT EXISTS "business_hours" text,
        ADD COLUMN IF NOT EXISTS "website_url" text,
        ADD COLUMN IF NOT EXISTS "catalog" jsonb DEFAULT '[]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "business_name",
        DROP COLUMN IF EXISTS "business_hours",
        DROP COLUMN IF EXISTS "website_url",
        DROP COLUMN IF EXISTS "catalog";
    `);
  }
}

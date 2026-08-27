import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionSummary20260730000002 implements MigrationInterface {
  name = 'AddSessionSummary20260730000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audio_room_transcripts"
        ADD COLUMN IF NOT EXISTS "session_summary" text,
        ADD COLUMN IF NOT EXISTS "vocabulary_list" jsonb DEFAULT '[]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audio_room_transcripts"
        DROP COLUMN IF EXISTS "session_summary",
        DROP COLUMN IF EXISTS "vocabulary_list";
    `);
  }
}

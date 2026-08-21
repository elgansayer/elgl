import { MigrationInterface, QueryRunner } from 'typeorm';

// Audit: all foreign key columns below have covering indexes.
export class CreateQuickPolls20260730000001 implements MigrationInterface {
  name = 'CreateQuickPolls20260730000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS quick_polls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES audio_rooms(id) ON DELETE CASCADE,
        host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        options TEXT[] NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS poll_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        poll_id UUID NOT NULL REFERENCES quick_polls(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        option_index INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(poll_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_quick_polls_room_id ON quick_polls (room_id);
      CREATE INDEX IF NOT EXISTS idx_quick_polls_host_id ON quick_polls (host_id);
      CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes (poll_id);
      CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON poll_votes (user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS poll_votes;
      DROP TABLE IF EXISTS quick_polls;
    `);
  }
}

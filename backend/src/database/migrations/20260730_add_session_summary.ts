import { MigrationBuilder } from 'node-pg-migrate';
import { ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('audio_room_transcripts', {
    session_summary: { type: 'text', notNull: false },
    vocabulary_list: {
      type: 'jsonb',
      notNull: false,
      default: '[]'::jsonb,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('audio_room_transcripts', 'session_summary');
  pgm.dropColumn('audio_room_transcripts', 'vocabulary_list');
}

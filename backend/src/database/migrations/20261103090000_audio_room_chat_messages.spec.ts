import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    __dirname,
    '../../../../supabase/migrations/20261103090000_audio_room_chat_messages.sql',
  ),
  'utf8',
);

describe('audio-room chat messages migration', () => {
  it('creates cascade-owned durable message storage with bounded text', () => {
    expect(migration).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.audio_room_messages/,
    );
    expect(migration).toMatch(
      /room_id UUID NOT NULL REFERENCES public\.audio_rooms\(id\) ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /sender_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /CHECK \(char_length\(btrim\(text_content\)\) BETWEEN 1 AND 1000\)/,
    );
  });

  it('makes concurrent and retried sends idempotent', () => {
    expect(migration).toMatch(
      /UNIQUE \(room_id, sender_id, client_message_id\)/,
    );
  });

  it('indexes bounded newest-first room history', () => {
    expect(migration).toMatch(
      /audio_room_messages_room_created_idx\s+ON public\.audio_room_messages \(room_id, created_at DESC, id DESC\)/,
    );
  });

  it('allows participant reads but no direct authenticated writes', () => {
    expect(migration).toContain(
      'ALTER TABLE public.audio_room_messages ENABLE ROW LEVEL SECURITY;',
    );
    expect(migration).toMatch(
      /participant\.room_id = audio_room_messages\.room_id[\s\S]*participant\.user_id = auth\.uid\(\)/,
    );
    expect(migration).not.toMatch(
      /FOR (?:INSERT|UPDATE|DELETE|ALL)\s+TO authenticated/,
    );
  });

  it('documents retention, query shape and rollback without destructive forward SQL', () => {
    expect(migration).toContain(
      'Rows are retained until their room or sender account is deleted.',
    );
    expect(migration).toContain(
      'WHERE room_id = $1 ORDER BY created_at DESC, id DESC LIMIT 101 OFFSET $2;',
    );
    expect(migration).toContain('Rollback: stop the message API writer first');
    const executable = migration
      .replace(/--.*$/gm, '')
      .replace(/DROP POLICY IF EXISTS[\s\S]*?;/g, '')
      .replace(/CREATE POLICY[\s\S]*?;/g, '')
      .replace(/\s+/g, ' ');
    expect(executable).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/);
  });
});

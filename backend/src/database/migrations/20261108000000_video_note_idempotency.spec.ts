import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261108000000_video_note_idempotency.sql',
);

describe('Video note idempotency migration (#1879)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  it('prevents concurrent retries and conflicting media presentations', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_sender_media_url_v2_unique_idx\s+ON public\.chat_messages \(sender_id, media_url\)\s+WHERE media_url IS NOT NULL\s+AND message_type IN \('image', 'video', 'video_note'\)/,
    );
  });

  it('is additive and safe to retry with mixed application versions', () => {
    const executable = sql
      .replace(/--.*$/gm, '')
      .split(';')
      .map((statement) => statement.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    expect(executable).toHaveLength(1);
    expect(executable[0]).toMatch(/^CREATE UNIQUE INDEX IF NOT EXISTS /);
  });

  it('documents the query pattern and rollback', () => {
    expect(sql).toContain('WHERE sender_id = $1 AND media_url = $2');
    expect(sql).toContain(
      'DROP INDEX IF EXISTS public.chat_messages_sender_media_url_v2_unique_idx',
    );
  });
});

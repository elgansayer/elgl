import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '..',
    'supabase/migrations/20261103010000_chat_media_upload_intents.sql',
  ),
  'utf8',
);

describe('chat media upload intents migration contract', () => {
  it('creates retry-safe owned intents with a bounded-cleanup index', () => {
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS public.chat_media_upload_intents',
    );
    expect(migration).toContain(
      'user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE',
    );
    expect(migration).toContain('object_key TEXT PRIMARY KEY');
    expect(migration).toContain('expires_at TIMESTAMPTZ NOT NULL');
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS chat_media_upload_intents_expiry_idx',
    );
    expect(migration).toContain(
      'ALTER TABLE public.chat_media_upload_intents ENABLE ROW LEVEL SECURITY',
    );
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.chat_media_upload_intents FROM anon, authenticated',
    );
    expect(migration).toContain(
      'CREATE POLICY chat_media_upload_intents_service_role',
    );
    expect(migration).toContain('TO service_role');
  });
});

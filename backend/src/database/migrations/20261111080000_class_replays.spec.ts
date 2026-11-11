import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261111080000_class_replays.sql',
);

describe('class replay migration (#2043)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  it('creates the replay table additively', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.class_replays/);
    expect(sql).toMatch(
      /host_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(
      /room_id UUID REFERENCES public\.audio_rooms\(id\) ON DELETE SET NULL/,
    );
  });

  it('stores adaptive sources without exposing provider identities', () => {
    expect(sql).toMatch(/hls_url TEXT/);
    expect(sql).toMatch(/dash_url TEXT/);
    expect(sql).toMatch(/download_url TEXT/);
    expect(sql).toMatch(/provider_video_id TEXT/);
  });

  it('bounds replay states, attempts and retention', () => {
    expect(sql).toMatch(
      /CHECK \(status IN \('pending', 'processing', 'ready', 'failed'\)\)/,
    );
    expect(sql).toMatch(
      /attempts INTEGER NOT NULL DEFAULT 0 CHECK \(attempts >= 0\)/,
    );
    expect(sql).toMatch(/expires_at TIMESTAMPTZ/);
  });

  it('prevents duplicate room and provider recordings', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS class_replays_room_unique_idx/,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS class_replays_provider_video_unique_idx/,
    );
  });

  it('denies direct authenticated access and is replay safe', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.class_replays ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).not.toMatch(/CREATE POLICY/);
    expect(sql).not.toMatch(/\bDROP\b|\bTRUNCATE\b/);
  });
});

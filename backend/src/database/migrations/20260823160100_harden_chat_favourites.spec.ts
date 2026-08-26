import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260823160100_harden_chat_favourites.sql',
  ),
  'utf8',
);

describe('harden chat favourites migration', () => {
  it('adds the snapshot fields consumed by the Angular favourites UI without rewriting migration 003', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS item_type TEXT');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS item_payload JSONB');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS notes TEXT');
    expect(migration).toContain("ALTER COLUMN item_type SET DEFAULT 'message'");
    expect(migration).toContain('ALTER COLUMN item_type SET NOT NULL');
  });

  it('canonicalises the payload from chat_messages instead of trusting a client snapshot', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.normalise_chat_favourite()',
    );
    expect(migration).toMatch(/FROM public\.chat_messages AS message_row/);
    expect(migration).toMatch(/NEW\.item_payload := canonical_payload/);
    expect(migration).toMatch(/NEW\.message_id := canonical_message_id/);
  });

  it('enforces room membership even when the backend uses service-role database access', () => {
    expect(migration).toMatch(/FROM public\.chat_room_members AS member/);
    expect(migration).toMatch(/member\.user_id = NEW\.user_id/);
    expect(migration).toMatch(/member\.room_id::TEXT = canonical_room_id/);
    expect(migration).toContain(
      'Cannot favourite a message outside your rooms',
    );
  });

  it('bounds notes, strips reusable view-once media URLs, and makes retries idempotent', () => {
    expect(migration).toMatch(
      /CHAR_LENGTH\(COALESCE\(NEW\.note_text, ''\)\) > 500/,
    );
    expect(migration).toContain(
      "canonical_payload := canonical_payload - 'media_url'",
    );
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toMatch(
      /WHERE existing\.user_id = NEW\.user_id[\s\S]*existing\.message_id = canonical_message_id/,
    );
    expect(migration).toContain('RETURN NULL;');
  });

  it('keeps the migration additive and replay-safe', () => {
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).not.toMatch(/TRUNCATE/i);
    expect(migration).toContain(
      'DROP TRIGGER IF EXISTS normalise_chat_favourite_before_write',
    );
    expect(migration).toContain(
      'CREATE TRIGGER normalise_chat_favourite_before_write',
    );
  });
});

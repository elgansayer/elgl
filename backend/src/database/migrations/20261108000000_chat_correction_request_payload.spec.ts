import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20261108000000_chat_correction_request_payload.sql',
  ),
  'utf8',
);

describe('chat correction request payload migration', () => {
  it('adds replay-safe JSONB persistence for correction requests', () => {
    expect(migration).toMatch(
      /ALTER TABLE public\.chat_messages[\s\S]*ADD COLUMN IF NOT EXISTS correction_request_payload JSONB/,
    );
    expect(migration).toContain(
      'COMMENT ON COLUMN public.chat_messages.correction_request_payload',
    );
  });

  it('does not rewrite or remove existing chat messages', () => {
    expect(migration).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i);
  });
});

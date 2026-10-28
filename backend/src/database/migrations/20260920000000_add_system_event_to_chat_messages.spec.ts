import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    __dirname,
    '../../../../supabase/migrations/20260920000000_add_system_event_to_chat_messages.sql',
  ),
  'utf8',
);

describe('persisted chat system events migration', () => {
  it('adds the JSON payload without rewriting existing messages', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS system_event JSONB');
    expect(migration).not.toMatch(/DELETE FROM|TRUNCATE/i);
  });

  it('allows a null sender only for a valid system-event row', () => {
    expect(migration).toContain("message_type = 'system'");
    expect(migration).toContain('sender_id IS NULL');
    expect(migration).toContain("jsonb_typeof(system_event) = 'object'");
    expect(migration).toContain("system_event ? 'type'");
    expect(migration).toContain("message_type <> 'system'");
    expect(migration).toContain('sender_id IS NOT NULL');
    expect(migration).toContain('system_event IS NULL');
  });

  it('validates the additive constraint for existing data', () => {
    expect(migration).toContain('NOT VALID');
    expect(migration).toContain(
      'VALIDATE CONSTRAINT chat_messages_sender_system_event_check',
    );
  });
});

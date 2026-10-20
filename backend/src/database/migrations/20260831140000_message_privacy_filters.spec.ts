import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260831140000_message_privacy_filters.sql',
);

describe('message privacy filter migration (#772)', () => {
  let sql: string;

  beforeAll(() => {
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('upgrades the existing nullable column without discarding preferences', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS message_filters jsonb;/);
    expect(sql).toMatch(/WHERE message_filters IS NULL/);
    expect(sql).toMatch(/ALTER COLUMN message_filters SET NOT NULL/);
  });

  it('serialises first-message admission and verifies sender membership', () => {
    expect(sql).toMatch(/FROM public\.chat_rooms[\s\S]*FOR UPDATE/);
    expect(sql).toMatch(/user_id = NEW\.sender_id/);
    expect(sql).toMatch(/message_sender_is_not_a_room_member/);
  });

  it('exempts every established direct conversation, including replies', () => {
    const existingConversationCheck = sql.match(
      /IF EXISTS \([\s\S]*?FROM public\.chat_messages[\s\S]*?\) THEN/,
    )?.[0];
    expect(existingConversationCheck).toBeTruthy();
    expect(existingConversationCheck).not.toMatch(/sender_id = NEW\.sender_id/);
  });

  it('supports canonical snake-case rules and legacy camel-case values', () => {
    expect(sql).toContain("filters ->> 'allow_everyone'");
    expect(sql).toContain("filters ->> 'same_native_language'");
    expect(sql).toContain("filters ->> 'allowEveryone'");
    expect(sql).toContain("filters ->> 'sameNativeLanguage'");
  });
});

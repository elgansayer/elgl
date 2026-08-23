import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260823010000_chat_room_pins.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('per-user chat priority pins migration (#1167)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('creates an idempotent per-user pin relation with cascade deletion', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.chat_room_pins/i);
    expect(sql).toMatch(
      /user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/i,
    );
    expect(sql).toMatch(
      /room_id UUID NOT NULL REFERENCES public\.chat_rooms\(id\) ON DELETE CASCADE/i,
    );
    expect(sql).toMatch(/PRIMARY KEY \(user_id, room_id\)/i);
    expect(sql).toMatch(/FOREIGN KEY \(room_id, user_id\)/i);
    expect(sql).toMatch(
      /REFERENCES public\.chat_room_members\(room_id, user_id\)[\s\S]*ON DELETE CASCADE/i,
    );
  });

  it('indexes the bounded user-first read path', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_chat_room_pins_user_created/i,
    );
    expect(sql).toMatch(
      /ON public\.chat_room_pins \(user_id, created_at, room_id\)/i,
    );
  });

  it('enables RLS and scopes reads and mutations to the authenticated owner', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.chat_room_pins ENABLE ROW LEVEL SECURITY/i,
    );
    expect(sql).toMatch(/auth\.uid\(\) = user_id/i);
    expect(sql).toMatch(/FOR SELECT[\s\S]*TO authenticated/i);
    expect(sql).toMatch(/FOR INSERT[\s\S]*TO authenticated/i);
    expect(sql).toMatch(/FOR DELETE[\s\S]*TO authenticated/i);
    expect(sql).toMatch(/REVOKE ALL ON public\.chat_room_pins FROM anon/i);
  });

  it('requires current chat membership before a direct authenticated read or insert', () => {
    expect(sql).toMatch(/FROM public\.chat_room_members member/i);
    expect(sql).toMatch(/member\.room_id = chat_room_pins\.room_id/i);
    expect(sql).toMatch(/member\.user_id = auth\.uid\(\)/i);
  });

  it('backfills the legacy shared pin only as an initial per-member preference', () => {
    expect(sql).toMatch(
      /JOIN public\.chat_rooms room ON room\.id = member\.room_id/i,
    );
    expect(sql).toMatch(/COALESCE\(room\.is_pinned, false\) = true/i);
    expect(sql).toMatch(/ON CONFLICT \(user_id, room_id\) DO NOTHING/i);
  });

  it('is replay safe without rewriting deployed chat room migrations', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/i);
    expect(sql).toMatch(/DROP POLICY IF EXISTS chat_room_pins_select_own/i);
    expect(sql).toMatch(/DROP POLICY IF EXISTS chat_room_pins_insert_own/i);
    expect(sql).toMatch(/DROP POLICY IF EXISTS chat_room_pins_delete_own/i);
  });
});

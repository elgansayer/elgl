import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(
    repositoryRoot,
    'supabase/migrations/20260823133000_direct_chat_opening.sql',
  ),
  'utf8',
);

describe('direct chat opening migration contract', () => {
  it('serializes an unordered participant pair inside the database transaction', () => {
    expect(migration).toMatch(/pg_advisory_xact_lock/i);
    expect(migration).toMatch(/LEAST\(p_user_id::TEXT, p_partner_id::TEXT\)/i);
    expect(migration).toMatch(/GREATEST\(p_user_id::TEXT, p_partner_id::TEXT\)/i);
  });

  it('reuses only rooms with exactly two memberships before creating another room', () => {
    expect(migration).toMatch(/COUNT\(\*\)[\s\S]*?= 2/i);
    expect(migration).toMatch(/second_member\.user_id = p_partner_id/i);
    expect(migration).toMatch(/first_member\.user_id = p_user_id/i);
  });

  it('creates the room and both memberships in one RPC transaction', () => {
    expect(migration).toMatch(/INSERT INTO public\.chat_rooms/i);
    expect(migration).toMatch(/INSERT INTO public\.chat_room_members/i);
    expect(migration).toMatch(/VALUES \(p_user_id\), \(p_partner_id\)/i);
  });

  it('keeps the privileged mutation unavailable to browser database roles', () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_or_create_direct_chat\(UUID, UUID\) FROM authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_or_create_direct_chat\(UUID, UUID\) TO service_role/i,
    );
  });

  it('is replay safe and compatible with historical TEXT or UUID room ids', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION/i);
    expect(migration).toMatch(/v_room_id_type/i);
    expect(migration).toMatch(/\$1::uuid/i);
    expect(migration).toMatch(/room\.id::TEXT = v_new_room_id/i);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(
    repositoryRoot,
    'supabase/migrations/20261102090000_atomic_chat_preferences.sql',
  ),
  'utf8',
);

describe('atomic chat preferences migration contract', () => {
  it('merges each partial patch in one database update', () => {
    expect(migration).toMatch(
      /SET chat_preferences = COALESCE\(chat_preferences, '\{\}'::JSONB\) \|\| p_patch/i,
    );
    expect(migration).toMatch(/RETURNING chat_preferences INTO v_preferences/i);
  });

  it('rejects non-object patches and unsupported keys', () => {
    expect(migration).toMatch(/jsonb_typeof\(p_patch\) <> 'object'/i);
    expect(migration).toMatch(/jsonb_object_keys\(p_patch\)/i);
    expect(migration).toMatch(/v_allowed_keys/i);
  });

  it('keeps the mutation behind the backend service role', () => {
    expect(migration).toMatch(/SECURITY DEFINER/i);
    expect(migration).toMatch(/SET search_path = public, pg_temp/i);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.merge_chat_preferences\(UUID, JSONB\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.merge_chat_preferences\(UUID, JSONB\)[\s\S]*TO service_role/i,
    );
  });
});

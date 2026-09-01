import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(
    repositoryRoot,
    'supabase/migrations/20260831160000_harden_daily_checkin_reward_rng.sql',
  ),
  'utf8',
);

describe('daily check-in reward RNG migration contract', () => {
  it('replaces the production claim function with secure random bytes', () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.claim_daily_checkin\(p_user_id UUID\)/i,
    );
    expect(migration).toMatch(/gen_random_bytes\(1\)/i);
    expect(migration).not.toMatch(/\brandom\s*\(\s*\)/i);
  });

  it('resolves pgcrypto from Supabase without exposing a writable search path', () => {
    expect(migration).toMatch(
      /SET search_path = extensions, public, pg_temp/i,
    );
  });

  it('uses rejection sampling to map bytes uniformly onto rewards 5 through 10', () => {
    expect(migration).toMatch(/EXIT WHEN v_random_byte < 252/i);
    expect(migration).toMatch(/v_reward := \(v_random_byte % 6\) \+ 5/i);
  });

  it('preserves the database-authoritative transaction and privilege boundary', () => {
    expect(migration).toMatch(/FOR UPDATE/i);
    expect(migration).toMatch(/INSERT INTO public\.daily_checkins/i);
    expect(migration).toMatch(/INSERT INTO public\.coin_transactions/i);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.claim_daily_checkin\(UUID\) FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_daily_checkin\(UUID\) TO service_role/i,
    );
  });
});

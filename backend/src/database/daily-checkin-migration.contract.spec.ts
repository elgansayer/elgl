import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(
    repositoryRoot,
    'supabase/migrations/20260825090000_atomic_daily_checkins.sql',
  ),
  'utf8',
);

describe('atomic daily check-in migration contract', () => {
  it('stores at most one reward per user and UTC calendar day', () => {
    expect(migration).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.daily_checkins/i,
    );
    expect(migration).toMatch(/PRIMARY KEY\s*\(user_id,\s*checkin_date\)/i);
    expect(migration).toMatch(
      /reward\s+SMALLINT\s+NOT NULL\s+CHECK\s*\(reward BETWEEN 5 AND 10\)/i,
    );
    expect(migration).toMatch(/now\(\) AT TIME ZONE 'UTC'/i);
  });

  it('serializes claims by locking the authoritative user balance row', () => {
    expect(migration).toMatch(
      /SELECT coins_balance[\s\S]*FROM public\.users[\s\S]*WHERE id = p_user_id[\s\S]*FOR UPDATE/i,
    );
    expect(migration).toMatch(
      /UPDATE public\.users[\s\S]*SET coins_balance = v_balance/i,
    );
  });

  it('records the reward ledger entry inside the same database function', () => {
    expect(migration).toMatch(/INSERT INTO public\.coin_transactions/i);
    expect(migration).toMatch(/'daily_checkin'/i);
    expect(migration).toMatch(/'Daily check-in reward'/i);
  });

  it('keeps browser roles away from the mutation boundary', () => {
    expect(migration).toMatch(
      /ALTER TABLE public\.daily_checkins ENABLE ROW LEVEL SECURITY/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.claim_daily_checkin\(UUID\) FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_daily_checkin\(UUID\) TO service_role/i,
    );
  });
});

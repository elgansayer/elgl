import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260824155000_atomic_daily_checkin_rewards.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('atomic daily check-in rewards migration (#1385)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('stores at most one claim marker per user and UTC date', () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.daily_checkin_claims/,
    );
    expect(sql).toMatch(/PRIMARY KEY \(user_id, claim_date\)/);
    expect(sql).toMatch(/\(now\(\) AT TIME ZONE 'UTC'\)::date/);
    expect(sql).toMatch(/ON CONFLICT \(user_id, claim_date\) DO NOTHING/);
  });

  it('constrains rewards to the advertised 5 to 10 coin range', () => {
    expect(sql).toMatch(/CHECK \(coins_rewarded BETWEEN 5 AND 10\)/);
    expect(sql).toMatch(/p_reward < 5 OR p_reward > 10/);
  });

  it('serializes the user balance and increments it inside the RPC transaction', () => {
    expect(sql).toMatch(/FROM public\.users AS u[\s\S]*FOR UPDATE/);
    expect(sql).toMatch(
      /SET coins_balance = COALESCE\(coins_balance, 0\) \+ p_reward/,
    );
    expect(sql).toMatch(/RETURNING coins_balance INTO v_new_balance/);
  });

  it('writes the coin ledger in the same function as the balance grant', () => {
    expect(sql).toMatch(/INSERT INTO public\.coin_transactions/);
    expect(sql).toMatch(/'daily_checkin'/);
    expect(sql).toMatch(/jsonb_build_object\('claim_date', v_claim_date\)/);
  });

  it('keeps claim markers and the privileged RPC inaccessible to browser roles', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.daily_checkin_claims ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON TABLE public\.daily_checkin_claims FROM PUBLIC, anon, authenticated/,
    );
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public, pg_temp/);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.claim_daily_checkin_reward\(UUID, SMALLINT\)[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.claim_daily_checkin_reward\(UUID, SMALLINT\)[\s\S]*TO service_role/,
    );
  });

  it('cascades claim retention with account deletion and avoids logging user data', () => {
    expect(sql).toMatch(/REFERENCES public\.users\(id\) ON DELETE CASCADE/);
    expect(sql).not.toMatch(/RAISE\s+(?:LOG|NOTICE|INFO|WARNING)/i);
  });
});

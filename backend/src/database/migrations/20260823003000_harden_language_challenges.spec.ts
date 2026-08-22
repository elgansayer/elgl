import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260823003000_harden_language_challenges.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('language challenge economy migration (#1157)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('creates challenge, participant, and daily activity persistence with bounded indexes', () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.language_challenges/,
    );
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.language_challenge_participants/,
    );
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.language_challenge_daily_activity/,
    );
    expect(sql).toMatch(/UNIQUE \(challenge_id, user_id\)/);
    expect(sql).toMatch(/UNIQUE \(challenge_id, user_id, activity_date\)/);
    expect(sql).toMatch(/language_challenges_status_end_idx/);
    expect(sql).toMatch(/language_challenge_activity_progress_idx/);
  });

  it('enforces bounded entry fees, durations, types, and challenge lifecycle values', () => {
    expect(sql).toMatch(/entry_fee_coins BETWEEN 1 AND 1000/);
    expect(sql).toMatch(/duration_days BETWEEN 1 AND 30/);
    expect(sql).toMatch(/challenge_type IN \('streak', 'points'\)/);
    expect(sql).toMatch(/status IN \('open', 'completed', 'cancelled'\)/);
    expect(sql).toMatch(/CHECK \(ends_at > starts_at\)/);
  });

  it('keeps browser writes behind the authenticated backend boundary', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.language_challenges ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(/language_challenge_participants_select_own/);
    expect(sql).toMatch(/language_challenge_activity_select_own/);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.join_language_challenge\(UUID, UUID\) FROM PUBLIC, anon, authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.join_language_challenge\(UUID, UUID\) TO service_role/,
    );
  });

  it('makes entry charging and prize-pool contribution one atomic RPC', () => {
    const joinFunction = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.join_language_challenge'),
      sql.indexOf(
        'CREATE OR REPLACE FUNCTION public.checkin_language_challenge',
      ),
    );

    expect(joinFunction).toMatch(/FOR UPDATE/);
    expect(joinFunction).toMatch(
      /coins_balance = coins_balance - v_challenge\.entry_fee_coins/,
    );
    expect(joinFunction).toMatch(
      /INSERT INTO public\.language_challenge_participants/,
    );
    expect(joinFunction).toMatch(
      /prize_pool_coins = prize_pool_coins \+ v_challenge\.entry_fee_coins/,
    );
    expect(joinFunction).toMatch(/'challenge_entry'/);
    expect(joinFunction).toMatch(/alreadyJoined/);
  });

  it('makes daily progress retry-safe and defines days in UTC', () => {
    const checkinFunction = sql.slice(
      sql.indexOf(
        'CREATE OR REPLACE FUNCTION public.checkin_language_challenge',
      ),
      sql.indexOf(
        'CREATE OR REPLACE FUNCTION public.claim_language_challenge_prize',
      ),
    );

    expect(checkinFunction).toMatch(/now\(\) AT TIME ZONE 'UTC'/);
    expect(checkinFunction).toMatch(
      /ON CONFLICT \(challenge_id, user_id, activity_date\) DO NOTHING/,
    );
    expect(checkinFunction).toMatch(/alreadyCheckedIn/);
  });

  it('settles all eligible winners exactly once under a challenge row lock', () => {
    const claimFunction = sql.slice(
      sql.indexOf(
        'CREATE OR REPLACE FUNCTION public.claim_language_challenge_prize',
      ),
      sql.indexOf('-- Backend-only RPC execution'),
    );

    expect(claimFunction).toMatch(/FOR UPDATE/);
    expect(claimFunction).toMatch(/IF v_challenge\.status = 'completed' THEN/);
    expect(claimFunction).toMatch(
      /coins_balance = u\.coins_balance \+ v_share/,
    );
    expect(claimFunction).toMatch(/'challenge_prize'/);
    expect(claimFunction).toMatch(
      /status = 'completed', completed_at = now\(\)/,
    );
    expect(claimFunction).toMatch(/prize_pool_coins = v_remainder/);
  });

  it('is restart-safe without rewriting deployed migration history', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/);
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.join_language_challenge/,
    );
    expect(sql).toMatch(/DROP POLICY IF EXISTS/);
  });

  it('does not log challenge content or coin-economy secrets from SQL', () => {
    expect(sql).not.toMatch(/RAISE\s+(?:LOG|NOTICE|INFO|WARNING)/i);
  });
});

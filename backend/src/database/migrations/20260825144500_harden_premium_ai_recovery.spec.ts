import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260825144500_harden_premium_ai_recovery.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('premium AI coin recovery migration (#1700)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('keeps pending-run recovery bounded and index-backed', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS premium_ai_runs_pending_updated_idx[\s\S]*?WHERE status = 'pending'/,
    );
    expect(sql).toMatch(/v_run\.updated_at <= now\(\) - INTERVAL '5 minutes'/);
  });

  it('binds every idempotency key to the original conversation subject', () => {
    expect(sql).toMatch(/IF v_run\.subject_id <> p_subject_id THEN/);
    expect(sql).toMatch(/premium ai idempotency subject mismatch/);
  });

  it('atomically refunds stale charged runs and preserves an audit trail', () => {
    expect(sql).toMatch(
      /SET coins_balance = COALESCE\(coins_balance, 0\) \+ v_run\.cost_coins/,
    );
    expect(sql).toMatch(
      /SET status = 'failed',[\s\S]*?error_code = 'stale_timeout'/,
    );
    expect(sql).toMatch(/'premium_ai_refund'/);
    expect(sql).toMatch(/'reason', 'stale_timeout'/);
  });

  it('uses a consistent user-then-run lock order for spend and refund paths', () => {
    const startFunction = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.start_premium_ai_service'),
      sql.indexOf('CREATE OR REPLACE FUNCTION public.fail_premium_ai_service'),
    );
    const failFunction = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.fail_premium_ai_service'),
    );

    for (const fn of [startFunction, failFunction]) {
      expect(fn.indexOf('FROM public.users')).toBeGreaterThanOrEqual(0);
      expect(fn.indexOf('FROM public.premium_ai_runs')).toBeGreaterThanOrEqual(
        0,
      );
      expect(fn.indexOf('FROM public.users')).toBeLessThan(
        fn.indexOf('FROM public.premium_ai_runs'),
      );
      expect(fn).toMatch(/FOR UPDATE/);
    }
  });

  it('keeps all money-moving RPCs unavailable to browser roles', () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.start_premium_ai_service\(UUID, TEXT, UUID, UUID\) FROM PUBLIC, anon, authenticated/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.fail_premium_ai_service\(UUID, UUID, TEXT\) FROM PUBLIC, anon, authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.start_premium_ai_service\(UUID, TEXT, UUID, UUID\) TO service_role/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fail_premium_ai_service\(UUID, UUID, TEXT\) TO service_role/,
    );
  });
});

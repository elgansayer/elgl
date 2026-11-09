import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261107090000_developer_api_usage_metrics.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('Developer API usage metrics migration (#1861)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('documents the issue and the missing analytics write path', () => {
    expect(sql).toMatch(/#1861/);
    expect(sql).toMatch(/developer_metrics/i);
  });

  it('defines an atomic security-definer recording function', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.record_developer_api_usage/i,
    );
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public, pg_temp/);
    expect(sql).toMatch(/ON CONFLICT \(user_id\) DO UPDATE/);
  });

  it('resets the daily counter on the first call of a new UTC day', () => {
    expect(sql).toMatch(/metrics\.updated_at < date_trunc\('day', now\(\)\)/);
    expect(sql).toMatch(/THEN 1/);
  });

  it('maintains a running average latency without unbounded scans', () => {
    expect(sql).toMatch(
      /metrics\.avg_latency_ms \* metrics\.total_api_calls_today/,
    );
    expect(sql).not.toMatch(
      /FROM public\.developer_metrics\s+WHERE user_id = p_user_id\s+ORDER BY/i,
    );
  });

  it('restricts execution to the trusted service role', () => {
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.record_developer_api_usage\(UUID, INTEGER\) FROM PUBLIC/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.record_developer_api_usage\(UUID, INTEGER\) TO service_role/,
    );
  });
});

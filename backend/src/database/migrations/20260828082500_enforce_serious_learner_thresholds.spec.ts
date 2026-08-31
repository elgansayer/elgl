import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260828082500_enforce_serious_learner_thresholds.sql',
);

describe('algorithmic Serious Learner location filtering migration (#1701)', () => {
  let sql: string;

  beforeAll(() => {
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('preserves the active search_nearby_users signature and bounded query', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.search_nearby_users\(/,
    );
    expect(sql).toMatch(/serious_only BOOLEAN DEFAULT FALSE/);
    expect(sql).toMatch(/ORDER BY distance ASC, u\.id ASC/);
    expect(sql).toMatch(/LIMIT 100/);
  });

  it('uses the documented algorithmic thresholds instead of the legacy flag', () => {
    expect(sql).toMatch(/COALESCE\(u\.study_streak_days, 0\) > 7/);
    expect(sql).toMatch(/COALESCE\(u\.correction_ratio, 0\) >= 0\.8/);
    expect(sql).not.toMatch(/OR u\.is_serious_learner = true/i);
  });

  it('retains the hardened input and privacy boundaries', () => {
    expect(sql).toMatch(/search_lat BETWEEN -90 AND 90/);
    expect(sql).toMatch(/search_lon BETWEEN -180 AND 180/);
    expect(sql).toMatch(/radius_m BETWEEN 1000 AND 20000000/);
    expect(sql).toMatch(/u\.privacy_hide_from_search = false/);
    expect(sql).toMatch(/COALESCE\(u\.is_deletion_pending, false\) = false/);
    expect(sql).toMatch(/u\.scheduled_for_deletion_at IS NULL/);
  });

  it('keeps SECURITY DEFINER execution restricted to the service role', () => {
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.search_nearby_users[\s\S]*FROM PUBLIC/,
    );
    expect(sql).toMatch(/FROM anon, authenticated/);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.search_nearby_users[\s\S]*TO service_role/,
    );
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261030033000_align_nearby_serious_learner_policy.sql',
);

describe('nearby Serious Learner policy alignment migration (#1715)', () => {
  let sql: string;

  beforeAll(() => {
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('preserves the active RPC signature and bounded PostGIS query', () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.search_nearby_users\(/,
    );
    expect(sql).toMatch(/serious_only BOOLEAN DEFAULT FALSE/);
    expect(sql).toMatch(/ST_DWithin\(/);
    expect(sql).toMatch(/ORDER BY distance ASC, u\.id ASC/);
    expect(sql).toMatch(/LIMIT 100/);
  });

  it('uses the canonical active-streak policy', () => {
    expect(sql).toMatch(/COALESCE\(u\.study_streak_days, 0\) >= 7/);
    expect(sql).toMatch(/u\.last_active_at >= now\(\) - INTERVAL '24 hours'/);
    expect(sql).not.toMatch(/correction_ratio[^\n]*>=\s*0\.8/i);
    expect(sql).not.toMatch(/study_streak_days, 0\) > 7/);
  });

  it('retains validation, privacy, and service-role boundaries', () => {
    expect(sql).toMatch(/search_lat BETWEEN -90 AND 90/);
    expect(sql).toMatch(/search_lon BETWEEN -180 AND 180/);
    expect(sql).toMatch(/radius_m BETWEEN 1000 AND 20000000/);
    expect(sql).toMatch(/u\.privacy_hide_from_search = false/);
    expect(sql).toMatch(/COALESCE\(u\.is_deletion_pending, false\) = false/);
    expect(sql).toMatch(/u\.scheduled_for_deletion_at IS NULL/);
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).toMatch(/FROM PUBLIC/);
    expect(sql).toMatch(/FROM anon, authenticated/);
    expect(sql).toMatch(/TO service_role/);
  });
});

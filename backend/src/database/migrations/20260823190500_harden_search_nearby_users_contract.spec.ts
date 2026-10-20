import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260823190500_harden_search_nearby_users_contract.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('PostGIS nearby discovery migration (#1302)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('preserves the active named-argument RPC signature for mixed-version backends', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.search_nearby_users\(/);
    expect(sql).toMatch(/search_lat DOUBLE PRECISION/);
    expect(sql).toMatch(/search_lon DOUBLE PRECISION/);
    expect(sql).toMatch(/radius_m DOUBLE PRECISION/);
    expect(sql).toMatch(/filter_native_arr VARCHAR\(10\)\[\]/);
    expect(sql).toMatch(/filter_audio_intro BOOLEAN DEFAULT FALSE/);
  });

  it('uses PostGIS ST_DWithin and returns nearest results first with a hard cap', () => {
    expect(sql).toMatch(/ST_DWithin\(/);
    expect(sql).toMatch(/ST_SetSRID\(ST_MakePoint\(search_lon, search_lat\), 4326\)/);
    expect(sql).toMatch(/ST_Distance\(/);
    expect(sql).toMatch(/ORDER BY distance ASC, u\.id ASC/);
    expect(sql).toMatch(/LIMIT 100/);
  });

  it('validates coordinate and radius bounds inside the privileged function', () => {
    expect(sql).toMatch(/search_lat BETWEEN -90 AND 90/);
    expect(sql).toMatch(/search_lon BETWEEN -180 AND 180/);
    expect(sql).toMatch(/radius_m BETWEEN 1000 AND 20000000/);
    expect(sql).toMatch(/ERRCODE = '22023'/);
  });

  it('validates optional age bounds and rejects inverted ranges', () => {
    expect(sql).toMatch(/filter_age_min BETWEEN 1 AND 120/);
    expect(sql).toMatch(/filter_age_max BETWEEN 1 AND 120/);
    expect(sql).toMatch(/filter_age_min > filter_age_max/);
  });

  it('keeps hidden and deletion-pending profiles outside spatial results', () => {
    expect(sql).toMatch(/u\.privacy_hide_from_search = false/);
    expect(sql).toMatch(/COALESCE\(u\.is_deletion_pending, false\) = false/);
    expect(sql).toMatch(/u\.scheduled_for_deletion_at IS NULL/);
  });

  it('keeps the current user and null locations outside the result set', () => {
    expect(sql).toMatch(/u\.location IS NOT NULL/);
    expect(sql).toMatch(/exclude_user_id IS NULL OR u\.id <> exclude_user_id/);
  });

  it('keeps supported discovery filters inside the spatial query', () => {
    expect(sql).toMatch(/u\.native_languages && filter_native_arr/);
    expect(sql).toMatch(/filter_target = ANY\(u\.target_languages\)/);
    expect(sql).toMatch(/u\.is_serious_learner = true/);
    expect(sql).toMatch(/u\.proficiency_level = filter_level/);
    expect(sql).toMatch(/u\.gender = filter_gender/);
    expect(sql).toMatch(/u\.audio_intro_url IS NOT NULL/);
  });

  it('keeps SECURITY DEFINER execution behind the service role', () => {
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.search_nearby_users[\s\S]*FROM PUBLIC/);
    expect(sql).toMatch(/FROM anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.search_nearby_users[\s\S]*TO service_role/);
  });

  it('does not log coordinates or other location data from the database function', () => {
    expect(sql).not.toMatch(/RAISE\s+(?:LOG|NOTICE|INFO|WARNING)/i);
  });
});

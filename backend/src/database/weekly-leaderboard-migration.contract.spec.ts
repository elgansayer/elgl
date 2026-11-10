import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(
    repositoryRoot,
    'supabase/migrations/20261109090000_weekly_community_leaderboard.sql',
  ),
  'utf8',
);

describe('weekly community leaderboard migration contract', () => {
  it('bounds the current UTC week and validates the requested limit', () => {
    expect(migration).toMatch(
      /date_trunc\('week', \(now\(\) AT TIME ZONE 'UTC'\)\) AT TIME ZONE 'UTC'/i,
    );
    expect(migration).toMatch(/v_week_start \+ INTERVAL '7 days'/i);
    expect(migration).toMatch(
      /p_limit IS NULL OR p_limit < 1 OR p_limit > 100/i,
    );
  });

  it('ranks weekly corrections and weekly study hours separately', () => {
    expect(migration).toMatch(
      /FROM public\.moment_comments[\s\S]*correction_payload IS NOT NULL[\s\S]*mc\.created_at >= v_week_start/i,
    );
    expect(migration).toMatch(
      /SELECT[\s\S]*cl\.caller_id[\s\S]*FROM public\.call_logs[\s\S]*UNION ALL[\s\S]*cl\.receiver_id/i,
    );
    expect(migration).toMatch(/'correctors'::TEXT/i);
    expect(migration).toMatch(/'study_hours'::TEXT/i);
  });

  it('excludes GDPR-deleted accounts from both public rankings', () => {
    expect(migration).toMatch(
      /ON u\.id = mc\.user_id\s+WHERE mc\.correction_payload IS NOT NULL\s+AND u\.is_deleted = false/i,
    );
    expect(migration).toMatch(
      /ON u\.id = cp\.participant_user_id\s+WHERE u\.is_deleted = false/i,
    );
  });

  it('exposes the aggregate only to the service role', () => {
    expect(migration).toMatch(/SECURITY DEFINER/i);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_weekly_leaderboard\(INTEGER\) FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_weekly_leaderboard\(INTEGER\) TO service_role/i,
    );
  });

  it('adds a partial index for weekly corrected comments', () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS moment_comments_correction_created_idx[\s\S]*WHERE correction_payload IS NOT NULL/i,
    );
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readMigration = (name: string) =>
  readFileSync(
    resolve(process.cwd(), '..', 'supabase', 'migrations', name),
    'utf8',
  );

const trustAndSafety = readMigration('002_trust_and_safety.sql');
const rowLevelSecurity = readMigration('009_row_level_security.sql');

describe('002_trust_and_safety migration contract', () => {
  it('creates profile visits with cascade cleanup and bounded visitor-history indexes', () => {
    expect(trustAndSafety).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.profile_visits\s*\([\s\S]*?id UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\)/,
    );
    expect(trustAndSafety).toMatch(
      /visitor_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(trustAndSafety).toMatch(
      /viewed_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(trustAndSafety).toContain(
      'CREATE INDEX IF NOT EXISTS profile_visits_viewed_id_idx ON public.profile_visits (viewed_id, created_at DESC);',
    );
    expect(trustAndSafety).toContain(
      'CREATE INDEX IF NOT EXISTS profile_visits_visitor_id_idx ON public.profile_visits (visitor_id);',
    );
  });

  it('creates duplicate-safe blocking relationships with lookup indexes in both directions', () => {
    expect(trustAndSafety).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.blocks\s*\([\s\S]*?id UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\)/,
    );
    expect(trustAndSafety).toMatch(
      /blocker_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(trustAndSafety).toMatch(
      /blocked_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(trustAndSafety).toContain(
      'CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)',
    );
    expect(trustAndSafety).toContain(
      'CREATE INDEX IF NOT EXISTS blocks_blocker_id_idx ON public.blocks (blocker_id);',
    );
    expect(trustAndSafety).toContain(
      'CREATE INDEX IF NOT EXISTS blocks_blocked_id_idx ON public.blocks (blocked_id);',
    );
  });

  it('creates moderation reports with privacy-preserving reporter deletion semantics', () => {
    expect(trustAndSafety).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.reports\s*\([\s\S]*?id UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\)/,
    );
    expect(trustAndSafety).toMatch(
      /reporter_id UUID REFERENCES public\.users\(id\) ON DELETE SET NULL/,
    );
    expect(trustAndSafety).toMatch(
      /reported_user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(trustAndSafety).toMatch(/reason_category VARCHAR\(100\) NOT NULL/);
    expect(trustAndSafety).toMatch(
      /status VARCHAR\(50\) NOT NULL DEFAULT 'pending'/,
    );
    expect(trustAndSafety).toContain(
      'CREATE INDEX IF NOT EXISTS reports_reported_user_id_idx ON public.reports (reported_user_id);',
    );
    expect(trustAndSafety).toContain(
      'CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);',
    );
  });

  it('keeps the historical migration replay-safe and non-destructive', () => {
    const tableCreates = trustAndSafety.match(/CREATE TABLE IF NOT EXISTS/g) ?? [];
    const indexCreates = trustAndSafety.match(/CREATE INDEX IF NOT EXISTS/g) ?? [];

    expect(tableCreates).toHaveLength(3);
    expect(indexCreates).toHaveLength(6);
    expect(trustAndSafety).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(trustAndSafety).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('enforces authenticated owner-scoped RLS for trust and safety data', () => {
    expect(rowLevelSecurity).toContain(
      'ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;',
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY profile_visits_select_own[\s\S]*?USING \(auth\.uid\(\) = viewed_id OR auth\.uid\(\) = visitor_id\)/,
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY profile_visits_insert_own[\s\S]*?WITH CHECK \(auth\.uid\(\) = visitor_id\)/,
    );

    expect(rowLevelSecurity).toContain(
      'ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;',
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY blocks_select_own[\s\S]*?USING \(auth\.uid\(\) = blocker_id\)/,
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY blocks_insert_own[\s\S]*?WITH CHECK \(auth\.uid\(\) = blocker_id\)/,
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY blocks_delete_own[\s\S]*?USING \(auth\.uid\(\) = blocker_id\)/,
    );

    expect(rowLevelSecurity).toContain(
      'ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;',
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY reports_select_own[\s\S]*?USING \(auth\.uid\(\) = reporter_id\)/,
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY reports_insert_own[\s\S]*?WITH CHECK \(auth\.uid\(\) = reporter_id\)/,
    );
  });
});

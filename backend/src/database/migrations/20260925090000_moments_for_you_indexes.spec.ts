import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260925090000_moments_for_you_indexes.sql',
);

function statements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

describe('Moments For You index migration (#1668)', () => {
  let sql: string;

  beforeAll(() => {
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('indexes newest-first Moment retrieval for candidate sourcing', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moments_created_at_idx\s+ON public\.moments \(created_at DESC\)/,
    );
  });

  it("indexes the viewer's most recent likes for engagement history", () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moment_likes_user_created_idx\s+ON public\.moment_likes \(user_id, created_at DESC\)/,
    );
  });

  it('is additive and safe to retry', () => {
    const executable = statements(sql);

    expect(executable).toHaveLength(2);
    for (const statement of executable) {
      expect(statement).toMatch(/^CREATE INDEX IF NOT EXISTS /);
    }
    // Rollback guidance lives in comments only, never in executable SQL.
    expect(executable.join(' ')).not.toMatch(
      /\b(?:ALTER|DROP|DELETE|UPDATE|TRUNCATE)\b/i,
    );
  });

  it('documents the query patterns and the rollback', () => {
    expect(sql).toMatch(/ORDER BY created_at DESC LIMIT 100/);
    expect(sql).toMatch(/WHERE user_id = \$1 ORDER BY created_at DESC/);
    expect(sql).toMatch(
      /Rollback: DROP INDEX IF EXISTS public\.moments_created_at_idx/,
    );
    expect(sql).toMatch(
      /DROP INDEX IF EXISTS public\.moment_likes_user_created_idx/,
    );
  });

  it('does not touch existing indexes or row-level security', () => {
    expect(sql).not.toMatch(/moments_user_created_idx/);
    expect(sql).not.toMatch(/ROW LEVEL SECURITY|CREATE POLICY/i);
  });
});

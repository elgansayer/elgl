import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MOMENTS_MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/005_moments.sql',
);
const RLS_MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/009_row_level_security.sql',
);

function loadMigration(path: string): string {
  return readFileSync(path, 'utf-8');
}

describe('historical migration: 005_moments (#1345)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration(MOMENTS_MIGRATION_PATH);
  });

  it('creates the moments, moment_comments, and moment_likes tables', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.moments \(/);
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.moment_comments \(/,
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.moment_likes \(/);
  });

  it('ties moments and interactions to users with cascading ownership cleanup', () => {
    expect(sql).toMatch(
      /public\.moments[\s\S]*?user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(
      /public\.moment_likes[\s\S]*?moment_id UUID NOT NULL REFERENCES public\.moments\(id\) ON DELETE CASCADE[\s\S]*?user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(
      /public\.moment_comments[\s\S]*?moment_id UUID NOT NULL REFERENCES public\.moments\(id\) ON DELETE CASCADE[\s\S]*?user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
  });

  it('prevents duplicate likes from the same user on one moment', () => {
    expect(sql).toMatch(
      /CONSTRAINT unique_moment_like UNIQUE \(moment_id, user_id\)/,
    );
  });

  it('supports threaded comments without orphaning replies', () => {
    expect(sql).toMatch(
      /parent_comment_id UUID REFERENCES public\.moment_comments\(id\) ON DELETE CASCADE/,
    );
    expect(sql).toMatch(
      /reply_to_user_id UUID REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
  });

  it('creates the feed, likes, and comment indexes required by current query paths', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moments_user_created_idx ON public\.moments \(user_id, created_at DESC\)/,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moments_lang_idx ON public\.moments \(target_language\)/,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moment_likes_moment_user_idx ON public\.moment_likes \(moment_id, user_id\)/,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS moment_comments_idx ON public\.moment_comments \(moment_id, created_at ASC\)/,
    );
  });
});

describe('moments row-level security contract (#1345)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration(RLS_MIGRATION_PATH);
  });

  it('enables RLS on moments, likes, and comments', () => {
    for (const table of ['moments', 'moment_likes', 'moment_comments']) {
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
      );
    }
  });

  it('allows authenticated reads while restricting writes to the owning user', () => {
    expect(sql).toMatch(
      /CREATE POLICY moments_select_authenticated ON public\.moments[\s\S]*?FOR SELECT TO authenticated USING \(true\)/,
    );
    expect(sql).toMatch(
      /CREATE POLICY moments_insert_own ON public\.moments[\s\S]*?WITH CHECK \(auth\.uid\(\) = user_id\)/,
    );
    expect(sql).toMatch(
      /CREATE POLICY moment_likes_insert_own ON public\.moment_likes[\s\S]*?WITH CHECK \(auth\.uid\(\) = user_id\)/,
    );
    expect(sql).toMatch(
      /CREATE POLICY moment_comments_insert_own ON public\.moment_comments[\s\S]*?WITH CHECK \(auth\.uid\(\) = user_id\)/,
    );
    expect(sql).toMatch(
      /CREATE POLICY moment_likes_delete_own ON public\.moment_likes[\s\S]*?USING \(auth\.uid\(\) = user_id\)/,
    );
    expect(sql).toMatch(
      /CREATE POLICY moment_comments_delete_own ON public\.moment_comments[\s\S]*?USING \(auth\.uid\(\) = user_id\)/,
    );
  });
});

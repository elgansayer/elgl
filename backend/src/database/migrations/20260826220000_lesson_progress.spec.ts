import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260826220000_lesson_progress.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('lesson progress migration (#617)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('stores one resumable progress row per user and lesson', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.lesson_progress/);
    expect(sql).toMatch(/user_id uuid NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/lesson_id uuid NOT NULL REFERENCES public\.lessons\(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/PRIMARY KEY \(user_id, lesson_id\)/);
  });

  it('bounds resume positions and indexes recent progress reads', () => {
    expect(sql).toMatch(/segment_index >= 0 AND segment_index <= 10000/);
    expect(sql).toMatch(/lesson_progress_user_updated_idx/);
    expect(sql).toMatch(/\(user_id, updated_at DESC\)/);
  });

  it('enables owner-only authenticated row-level security', () => {
    expect(sql).toMatch(/ALTER TABLE public\.lesson_progress ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/CREATE POLICY lesson_progress_select_own[\s\S]*TO authenticated[\s\S]*auth\.uid\(\) = user_id/);
    expect(sql).toMatch(/CREATE POLICY lesson_progress_insert_own[\s\S]*WITH CHECK \(auth\.uid\(\) = user_id\)/);
    expect(sql).toMatch(/CREATE POLICY lesson_progress_update_own[\s\S]*USING \(auth\.uid\(\) = user_id\)[\s\S]*WITH CHECK \(auth\.uid\(\) = user_id\)/);
  });

  it('makes lesson completion monotonic across retries and stale writes', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.preserve_lesson_completion\(\)/);
    expect(sql).toMatch(/NEW\.completed := OLD\.completed OR NEW\.completed/);
    expect(sql).toMatch(/NEW\.completed_at := OLD\.completed_at/);
    expect(sql).toMatch(/BEFORE UPDATE ON public\.lesson_progress/);
  });

  it('does not grant the trigger function to arbitrary callers', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.preserve_lesson_completion\(\) FROM PUBLIC/);
  });
});

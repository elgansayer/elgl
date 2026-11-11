import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261110000000_learning_practice_attempts.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('learning practice attempts migration (#2035)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('creates the attempt table for both learning modules', () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.learning_practice_attempts/,
    );
    expect(sql).toMatch(
      /module text NOT NULL CHECK \(module IN \('verb_conjugation', 'ipa_alphabet'\)\)/,
    );
    expect(sql).toMatch(
      /user_id uuid NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
  });

  it('bounds stored identifiers and answers', () => {
    expect(sql).toMatch(
      /item_id text NOT NULL CHECK \(char_length\(item_id\) BETWEEN 1 AND 200\)/,
    );
    expect(sql).toMatch(
      /submitted_answer text NOT NULL CHECK \(char_length\(submitted_answer\) BETWEEN 1 AND 200\)/,
    );
  });

  it('indexes recent progress reads per learner and module', () => {
    expect(sql).toMatch(/learning_practice_attempts_user_module_created_idx/);
    expect(sql).toMatch(/\(user_id, module, created_at DESC\)/);
  });

  it('enables owner-only authenticated row-level security', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.learning_practice_attempts ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(
      /CREATE POLICY learning_practice_attempts_select_own[\s\S]*TO authenticated[\s\S]*auth\.uid\(\) = user_id/,
    );
    expect(sql).toMatch(
      /CREATE POLICY learning_practice_attempts_insert_own[\s\S]*WITH CHECK \(auth\.uid\(\) = user_id\)/,
    );
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression coverage for the canonical flashcards/SRS schema (#971).
 *
 * Supabase migrations are not executed by the NestJS unit-test runner, so this
 * suite verifies the migration contract that the flashcards service relies on.
 */
const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/004_flashcards_srs.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('migration: 004_flashcards_srs (#971)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  describe('schema and retry safety', () => {
    it('creates the flashcards table idempotently', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.flashcards/);
    });

    it('cascades card deletion with its owning user', () => {
      expect(sql).toMatch(
        /user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
      );
    });

    it('rejects empty word tokens', () => {
      expect(sql).toMatch(
        /word_token TEXT NOT NULL CHECK \(btrim\(word_token\) <> ''\)/,
      );
    });

    it('defines the fields consumed by the current FlashcardsService', () => {
      for (const column of [
        'original_context',
        'definition',
        'pronunciation_url',
        'srs_level',
        'easiness_factor',
        'repetitions',
        'interval_days',
        'next_review_at',
      ]) {
        expect(sql).toContain(column);
      }
    });

    it('bounds persisted SRS values', () => {
      expect(sql).toMatch(/srs_level >= 0 AND srs_level <= 4/);
      expect(sql).toMatch(/easiness_factor >= 1\.3/);
      expect(sql).toMatch(/repetitions >= 0/);
      expect(sql).toMatch(/interval_days >= 0/);
    });
  });

  describe('query indexes and concurrency', () => {
    it('provides a unique composite user/word index for PostgREST upserts', () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_user_word_unique\s+ON public\.flashcards \(user_id, word_token\)/,
      );
    });

    it('indexes the initial per-user due-review query', () => {
      expect(sql).toMatch(
        /CREATE INDEX IF NOT EXISTS idx_flashcards_user_review_date\s+ON public\.flashcards \(user_id, next_review_at\)/,
      );
    });
  });

  describe('privacy boundary', () => {
    it('enables row-level security', () => {
      expect(sql).toMatch(
        /ALTER TABLE public\.flashcards ENABLE ROW LEVEL SECURITY/,
      );
    });

    it('defines all CRUD policies for authenticated users', () => {
      expect(sql).toMatch(/FOR SELECT\s+TO authenticated/);
      expect(sql).toMatch(/FOR INSERT\s+TO authenticated/);
      expect(sql).toMatch(/FOR UPDATE\s+TO authenticated/);
      expect(sql).toMatch(/FOR DELETE\s+TO authenticated/);
    });

    it('scopes every policy to auth.uid() = user_id', () => {
      const ownershipChecks = sql.match(/auth\.uid\(\) = user_id/g) ?? [];
      // SELECT, INSERT, UPDATE USING, UPDATE WITH CHECK, DELETE.
      expect(ownershipChecks).toHaveLength(5);
    });

    it('prevents UPDATE from transferring a card to another user', () => {
      expect(sql).toMatch(
        /FOR UPDATE[\s\S]*?USING \(auth\.uid\(\) = user_id\)[\s\S]*?WITH CHECK \(auth\.uid\(\) = user_id\)/,
      );
    });

    it('does not create an anon or public access policy', () => {
      const policySection = sql.slice(sql.indexOf('DROP POLICY'));
      expect(policySection).not.toMatch(/TO anon\b/);
      expect(policySection).not.toMatch(/TO public\b/i);
    });
  });

  describe('idempotent policy deployment', () => {
    it('drops every named policy before recreating it', () => {
      const drops = sql.match(/DROP POLICY IF EXISTS/g) ?? [];
      const creates = sql.match(/CREATE POLICY/g) ?? [];
      expect(drops).toHaveLength(4);
      expect(creates).toHaveLength(4);
    });

    it('uses IF NOT EXISTS for every index', () => {
      const indexStatements = sql.match(/CREATE (?:UNIQUE )?INDEX[^;]+;/g) ?? [];
      expect(indexStatements).toHaveLength(2);
      for (const statement of indexStatements) {
        expect(statement).toContain('IF NOT EXISTS');
      }
    });
  });
});

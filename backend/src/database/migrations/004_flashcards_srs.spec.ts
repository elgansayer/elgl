import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression coverage for the flashcards/SRS migration chain (#971).
 *
 * Migration history is append-only in this repository. The historical 004 file
 * therefore remains unchanged, while the forward migration converges deployed
 * databases with the schema and RLS contract required by the current service.
 */
const BASE_MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/004_flashcards_srs.sql',
);
const FORWARD_MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260821080200_harden_flashcards_srs_contract.sql',
);

function loadMigration(path: string): string {
  return readFileSync(path, 'utf-8');
}

describe('historical migration: 004_flashcards_srs (#971)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration(BASE_MIGRATION_PATH);
  });

  it('creates the flashcards table owned by public.users', () => {
    expect(sql).toMatch(/CREATE TABLE public\.flashcards/);
    expect(sql).toMatch(
      /user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
  });

  it('defines the original per-user word-token index requested by the issue', () => {
    expect(sql).toMatch(
      /CREATE INDEX idx_flashcards_user_word ON public\.flashcards \(user_id, word_token\)/,
    );
  });

  it('defines the original per-user review queue index', () => {
    expect(sql).toMatch(
      /CREATE INDEX idx_flashcards_user_review_date ON public\.flashcards \(user_id, next_review_date\)/,
    );
  });

  it('enables row-level security with owner-scoped CRUD policies', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.flashcards ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(/FOR SELECT[\s\S]*?USING \(auth\.uid\(\) = user_id\)/);
    expect(sql).toMatch(
      /FOR INSERT[\s\S]*?WITH CHECK \(auth\.uid\(\) = user_id\)/,
    );
    expect(sql).toMatch(/FOR UPDATE[\s\S]*?USING \(auth\.uid\(\) = user_id\)/);
    expect(sql).toMatch(/FOR DELETE[\s\S]*?USING \(auth\.uid\(\) = user_id\)/);
  });
});

describe('forward migration: flashcards SRS contract hardening (#971)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration(FORWARD_MIGRATION_PATH);
  });

  describe('mixed-version schema convergence', () => {
    it('renames legacy review/content columns only when current names are absent', () => {
      expect(sql).toMatch(/column_name = 'next_review_date'[\s\S]*?NOT EXISTS/);
      expect(sql).toMatch(/column_name = 'context_sentence'[\s\S]*?NOT EXISTS/);
      expect(sql).toMatch(
        /column_name = 'audio_pronunciation_url'[\s\S]*?NOT EXISTS/,
      );
    });

    it('adds every field required by current flashcard writes idempotently', () => {
      for (const column of [
        'original_context',
        'definition',
        'pronunciation_url',
        'easiness_factor',
        'repetitions',
        'interval_days',
        'next_review_at',
      ]) {
        expect(sql).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
      }
    });

    it('relaxes historical fields that current writes legitimately omit', () => {
      expect(sql).toMatch(/ALTER COLUMN source_language DROP NOT NULL/);
      expect(sql).toMatch(/ALTER COLUMN original_context DROP NOT NULL/);
    });
  });

  describe('idempotent upsert contract', () => {
    it('creates the unique user/word index required by PostgREST onConflict', () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_user_word_unique\s+ON public\.flashcards \(user_id, word_token\)/,
      );
    });
  });

  describe('privacy boundary', () => {
    it('reasserts row-level security', () => {
      expect(sql).toMatch(
        /ALTER TABLE public\.flashcards ENABLE ROW LEVEL SECURITY/,
      );
    });

    it('recreates all CRUD policies for authenticated users only', () => {
      expect(sql).toMatch(/FOR SELECT\s+TO authenticated/);
      expect(sql).toMatch(/FOR INSERT\s+TO authenticated/);
      expect(sql).toMatch(/FOR UPDATE\s+TO authenticated/);
      expect(sql).toMatch(/FOR DELETE\s+TO authenticated/);

      const policySection = sql.slice(sql.indexOf('DROP POLICY'));
      expect(policySection).not.toMatch(/TO anon\b/);
      expect(policySection).not.toMatch(/TO public\b/i);
    });

    it('scopes every policy mutation/read to the authenticated owner', () => {
      const ownershipChecks = sql.match(/auth\.uid\(\) = user_id/g) ?? [];
      // SELECT, INSERT, UPDATE USING, UPDATE WITH CHECK, DELETE.
      expect(ownershipChecks).toHaveLength(5);
    });

    it('prevents UPDATE from transferring a flashcard to another user', () => {
      expect(sql).toMatch(
        /FOR UPDATE[\s\S]*?USING \(auth\.uid\(\) = user_id\)[\s\S]*?WITH CHECK \(auth\.uid\(\) = user_id\)/,
      );
    });
  });

  describe('retry safety', () => {
    it('drops every named policy before recreating it', () => {
      expect(sql.match(/DROP POLICY IF EXISTS/g) ?? []).toHaveLength(4);
      expect(sql.match(/CREATE POLICY/g) ?? []).toHaveLength(4);
    });

    it('uses conditional DDL for schema additions and the unique index', () => {
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS definition');
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
    });
  });
});

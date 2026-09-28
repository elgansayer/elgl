import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/004_flashcards_srs.sql'),
  'utf8',
);

describe('004_flashcards_srs migration contract', () => {
  it('creates user-owned flashcards with the required vocabulary fields', () => {
    expect(migration).toMatch(/CREATE TABLE public\.flashcards/i);
    expect(migration).toMatch(
      /user_id\s+UUID\s+NOT NULL\s+REFERENCES public\.users\(id\)\s+ON DELETE CASCADE/i,
    );
    expect(migration).toMatch(/word_token\s+TEXT\s+NOT NULL/i);
    expect(migration).toMatch(/source_language\s+TEXT\s+NOT NULL/i);
    expect(migration).toMatch(/translation\s+TEXT\s+NOT NULL/i);
    expect(migration).toMatch(/context_sentence\s+TEXT\s+NOT NULL/i);
  });

  it('bounds the SRS level and initializes review scheduling safely', () => {
    expect(migration).toMatch(
      /srs_level\s+INTEGER\s+NOT NULL\s+DEFAULT 0\s+CHECK\s*\(srs_level >= 0 AND srs_level <= 4\)/i,
    );
    expect(migration).toMatch(
      /next_review_date\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT NOW\(\)/i,
    );
    expect(migration).toMatch(
      /created_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT NOW\(\)/i,
    );
  });

  it('indexes user/token lookup and the chronological review queue', () => {
    expect(migration).toMatch(
      /idx_flashcards_user_word\s+ON public\.flashcards\s*\(user_id,\s*word_token\)/i,
    );
    expect(migration).toMatch(
      /idx_flashcards_user_review_date\s+ON public\.flashcards\s*\(user_id,\s*next_review_date\)/i,
    );
  });

  it('enables row-level security and scopes CRUD policies to the owner', () => {
    expect(migration).toMatch(
      /ALTER TABLE public\.flashcards ENABLE ROW LEVEL SECURITY/i,
    );
    expect(migration).toMatch(
      /ON public\.flashcards FOR SELECT\s+USING \(auth\.uid\(\) = user_id\)/i,
    );
    expect(migration).toMatch(
      /ON public\.flashcards FOR INSERT\s+WITH CHECK \(auth\.uid\(\) = user_id\)/i,
    );
    expect(migration).toMatch(
      /ON public\.flashcards FOR UPDATE\s+USING \(auth\.uid\(\) = user_id\)/i,
    );
    expect(migration).toMatch(
      /ON public\.flashcards FOR DELETE\s+USING \(auth\.uid\(\) = user_id\)/i,
    );
  });
});

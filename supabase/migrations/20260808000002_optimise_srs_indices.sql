-- Migration: 20260808000002_optimise_srs_indices.sql
-- Description: Optimise database indices for SRS (Spaced Repetition System) query performance.
-- Fixes #2343.
--
-- Problems addressed:
--   1. Column name mismatch: 004_flashcards_srs.sql created `next_review_date` but all
--      TypeScript code queries `next_review_at`.  The old index was on the wrong column.
--   2. No covering index for getDueReviews (highest-frequency SRS query): the
--      WHERE clause combines user_id, srs_level, and next_review_at with an ORDER BY.
--   3. No composite index for getFlashcards filtered by level (user_id + srs_level + ORDER BY created_at).
--   4. No index for the suggestFlashcards known-words lookup (user_id + srs_level = 4).
--   5. No index for the metrics aggregator "stuck cards" query (srs_level = 0 + repetitions >= 5).
--   6. No index for the metrics aggregator avg easiness_factor scan.
--   7. No composite index on deck_flashcards for ORDER BY added_at when listing deck cards.
--   8. Missing unique constraint on (user_id, word_token) - the createOrUpdateFlashcard
--      upsert uses onConflict: 'user_id, word_token' but no constraint exists.
--   9. No index on srs_level alone - the SRS metrics aggregator queries cards
--      per level without filtering by user_id, so composite indices with user_id
--      as the leading column cannot be used.
--  10. No global partial index for counting due cards (metrics aggregator queries
--      without user_id).

-- ── 1. Rename next_review_date → next_review_at (idempotent) ─────────────
-- The column was originally created as `next_review_date` in 004.  All
-- application code uses `next_review_at`.  Rename if the old name still
-- exists; otherwise this is a no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'next_review_date'
  ) THEN
    ALTER TABLE public.flashcards RENAME COLUMN next_review_date TO next_review_at;
  END IF;
END $$;

-- Ensure the column has a usable default (if column was created under the
-- new name and doesn't have one, or add one if it's missing completely).
ALTER TABLE public.flashcards
  ALTER COLUMN next_review_at SET DEFAULT NOW();

-- ── 2. Drop the obsolete index on the old column name ────────────────────
-- The index from 004 references next_review_date which may no longer exist
-- or is now named next_review_at.  We'll drop by the known index name (safe
-- regardless of column rename) and replace with properly-optimised versions.

DROP INDEX IF EXISTS public.idx_flashcards_user_review_date;

-- ── 3. Core SRS indices for flashcards ──────────────────────────────────

-- 3a. getDueReviews: WHERE user_id = ? AND srs_level < 4 AND next_review_at <= now()
--     ORDER BY next_review_at ASC.  Partial index covering the common srs_level filter.
CREATE INDEX IF NOT EXISTS idx_flashcards_due
  ON public.flashcards (user_id, next_review_at)
  WHERE srs_level < 4;

-- 3b. getFlashcards with level filter: WHERE user_id = ? AND srs_level = ?
--     ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_flashcards_user_level
  ON public.flashcards (user_id, srs_level, created_at DESC);

-- 3c. getFlashcards without level: WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_flashcards_user_created
  ON public.flashcards (user_id, created_at DESC);

-- 3d. suggestFlashcards known-words lookup: WHERE user_id = ? AND srs_level = 4
--     selecting only word_token.  Partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_flashcards_known_words
  ON public.flashcards (user_id, word_token)
  WHERE srs_level = 4;

-- 3e. Metrics: stuck cards (srs_level = 0 AND repetitions >= 5)
CREATE INDEX IF NOT EXISTS idx_flashcards_stuck
  ON public.flashcards (repetitions)
  WHERE srs_level = 0 AND repetitions >= 5;

-- 3f. Metrics: average easiness_factor scan (NOT NULL)
CREATE INDEX IF NOT EXISTS idx_flashcards_easiness
  ON public.flashcards (easiness_factor)
  WHERE easiness_factor IS NOT NULL;

-- ── 4. deck_flashcards ordering index ────────────────────────────────────
-- getDeckFlashcards: WHERE deck_id = ? ORDER BY added_at DESC
CREATE INDEX IF NOT EXISTS idx_deck_flashcards_deck_added
  ON public.deck_flashcards (deck_id, added_at DESC);

-- ── 5. decks: composite index for getDeck (id + user_id) ────────────────
-- The PK on id already exists, but a composite ensures user-scoped lookups
-- avoid a secondary filter step.  Also helps RLS policy evaluation.
CREATE INDEX IF NOT EXISTS idx_decks_id_user
  ON public.decks (id, user_id);

-- ── 6. Unique constraint on (user_id, word_token) ───────────────────────
-- createOrUpdateFlashcard uses upsert with onConflict: 'user_id, word_token'
-- but no unique index existed.  This prevents duplicate flashcards for the
-- same word per user.  The existing idx_flashcards_user_word is a plain
-- composite index, not a unique one, so we replace it.
DROP INDEX IF EXISTS public.idx_flashcards_user_word;
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_user_word_unique
  ON public.flashcards (user_id, word_token);

-- ── 7. srs_level index for aggregator per-level queries ─────────────────
-- collectSrsStats loops over levels 0-4 with .eq('srs_level', level)
-- without filtering by user_id.  Composite indices with user_id as the
-- leading column cannot be used for global scans by level.
CREATE INDEX IF NOT EXISTS idx_flashcards_srs_level
  ON public.flashcards (srs_level);

-- ── 8. Global partial index for counting due cards ──────────────────────
-- collectSrsStats also counts due cards globally (srs_level < 4 AND
-- next_review_at <= now()) without user_id filter.  A partial index
-- covers this aggregator query efficiently.
CREATE INDEX IF NOT EXISTS idx_flashcards_due_global
  ON public.flashcards (next_review_at)
  WHERE srs_level < 4;
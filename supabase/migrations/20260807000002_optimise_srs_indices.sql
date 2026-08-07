-- Migration: 20260807000002_optimise_srs_indices.sql
-- Fixes #2343: Optimise database indices for Spaced Repetition (SRS) query performance.
--
-- Problem analysis:
--   1. Column `next_review_date` in 004_flashcards_srs.sql was named inconsistently
--      with the rest of the codebase which uses `next_review_at`.
--   2. The only review-queue index (idx_flashcards_user_review_date on user_id +
--      next_review_date) does not cover the srs_level filter (srs_level < 4), forcing
--      a partial index scan.
--   3. getFlashcards(user_id, level?) hits (user_id, created_at DESC) but has no
--      covering index for the srs_level filter.
--   4. The upsert on conflict (user_id, word_token) has no backing unique index,
--      causing a sequential scan.
--   5. suggestFromMessage queries (user_id + srs_level = 4, select word_token only)
--      has no covering index.

-- ── 1. Rename next_review_date → next_review_at (if not already renamed) ──
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'flashcards'
          AND table_schema = 'public'
          AND column_name = 'next_review_date'
    ) THEN
        ALTER TABLE public.flashcards RENAME COLUMN next_review_date TO next_review_at;
    END IF;
END $$;

-- Drop the old index that referenced the old column name.
DROP INDEX IF EXISTS public.idx_flashcards_user_review_date;

-- ── 2. Unique index for upsert on (user_id, word_token) ──────────────────
-- The createOrUpdateFlashcard service method uses onConflict: 'user_id, word_token'.
-- Without this index, every upsert performs a sequential scan to detect conflicts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_user_word_unique
  ON public.flashcards (user_id, word_token);

-- The old non-unique index on (user_id, word_token) is superseded by the unique one.
DROP INDEX IF EXISTS public.idx_flashcards_user_word;

-- ── 3. Core review-queue index: getDueReviews ────────────────────────────
-- Query: WHERE user_id = ? AND srs_level < 4 AND next_review_at <= ?
--        ORDER BY next_review_at ASC
-- This composite index covers filtering on user_id + srs_level and then
-- ordering by next_review_at, enabling an index-only scan for the due-reviews queue.
CREATE INDEX IF NOT EXISTS idx_flashcards_user_level_review
  ON public.flashcards (user_id, srs_level, next_review_at);

-- ── 4. Filtered list index: getFlashcards(user_id, level?) ───────────────
-- Query: WHERE user_id = ? AND srs_level = ? ORDER BY created_at DESC
-- Covers the level-filtered flashcard list with sorted results.
CREATE INDEX IF NOT EXISTS idx_flashcards_user_level_created
  ON public.flashcards (user_id, srs_level, created_at DESC);

-- ── 5. Unfiltered list index: getFlashcards(user_id) ─────────────────────
-- Query: WHERE user_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_flashcards_user_created
  ON public.flashcards (user_id, created_at DESC);

-- ── 6. Known-words lookup: suggestFromMessage ────────────────────────────
-- Query: WHERE user_id = ? AND srs_level = 4 (SELECT word_token only)
-- This index covers the exact lookup for known (mastered) words, enabling
-- an index-only scan that never touches the heap.
CREATE INDEX IF NOT EXISTS idx_flashcards_user_mastered_words
  ON public.flashcards (user_id, srs_level, word_token)
  WHERE srs_level = 4;

-- ── 7. Deck junction indices ─────────────────────────────────────────────
-- Ensure the FK indices exist for join performance (created by TypeScript migration
-- 20260801000000-create-flashcard-decks.ts but guarded here for idempotency).
CREATE INDEX IF NOT EXISTS idx_deck_flashcards_deck_id
  ON public.deck_flashcards (deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_flashcards_flashcard_id
  ON public.deck_flashcards (flashcard_id);
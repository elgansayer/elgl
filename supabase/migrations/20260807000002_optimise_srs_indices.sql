-- Migration: 20260807000002_optimise_srs_indices.sql
-- Description: Fix column naming inconsistencies and add optimised indices
-- for Spaced Repetition System (SRS) query performance.  Fixes #2343.
--
-- Background:
--   original migration 004 uses next_review_date, later migrations added
--   easiness_factor / repetition_count / repetitions / interval_days with
--   overlapping ALTERs.  Application code (NestJS + Angular) uniformly reads
--   and writes next_review_at, original_context, definition, pronunciation_url.
--
--   Queries that benefit from new indices:
--     1. getDueReviews:  WHERE user_id= AND srs_level<4 AND next_review_at<=now() ORDER BY next_review_at ASC
--     2. suggestFromMessage: WHERE user_id= AND srs_level=4  (needs word_token)
--     3. getFlashcards: WHERE user_id= ORDER BY created_at DESC
--     4. upsert on (user_id, word_token) needs a UNIQUE index
-- ---------------------------------------------------------------------------

-- === Column hygiene (all safe IF NOT EXISTS) ===============================

-- If the column was created as next_review_date by migration 004, rename it
-- so the application's next_review_at references work.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'flashcards'
          AND column_name  = 'next_review_date'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'flashcards'
          AND column_name  = 'next_review_at'
    ) THEN
        ALTER TABLE public.flashcards RENAME COLUMN next_review_date TO next_review_at;
    END IF;
END $$;

-- Ensure next_review_at exists even if migration 004 wasn't run
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add application-level columns that the code base already references
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS original_context TEXT,
  ADD COLUMN IF NOT EXISTS definition       TEXT,
  ADD COLUMN IF NOT EXISTS pronunciation_url TEXT;

-- Consolidate SM-2 algorithm columns (some may already exist from earlier migrations)
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS easiness_factor REAL    NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS repetitions     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interval_days   INTEGER NOT NULL DEFAULT 0;

-- If the older repetition_count column exists, copy data to repetitions and drop it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'flashcards'
          AND column_name  = 'repetition_count'
    ) THEN
        UPDATE public.flashcards
           SET repetitions = repetition_count
         WHERE repetitions IS DISTINCT FROM repetition_count;
        ALTER TABLE public.flashcards DROP COLUMN repetition_count;
    END IF;
END $$;

-- === Optimised Indices =====================================================

-- 1. Unique index for upsert (onConflict: 'user_id, word_token')
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_user_word_unique
    ON public.flashcards (user_id, word_token);

-- Drop the old non-unique index if it exists (superseded by the unique one above)
DROP INDEX IF EXISTS idx_flashcards_user_word;

-- 2. Core SRS due-review query:
--    SELECT * FROM flashcards WHERE user_id = X AND srs_level < 4
--          AND next_review_at <= NOW() ORDER BY next_review_at ASC
CREATE INDEX IF NOT EXISTS idx_flashcards_user_srs_review
    ON public.flashcards (user_id, srs_level, next_review_at)
    WHERE srs_level < 4;

-- 3. Suggest-flashcards query:
--    SELECT word_token FROM flashcards WHERE user_id = X AND srs_level = 4
CREATE INDEX IF NOT EXISTS idx_flashcards_user_mastered
    ON public.flashcards (user_id, word_token)
    WHERE srs_level = 4;

-- 4. Flashcard list ordered by creation date:
--    SELECT * FROM flashcards WHERE user_id = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_flashcards_user_created
    ON public.flashcards (user_id, created_at DESC);

-- Drop the old next_review_date index if it references the wrong column
DROP INDEX IF EXISTS idx_flashcards_user_review_date;

-- Re-create it pointing at the correct column (next_review_at) for backwards compat
CREATE INDEX IF NOT EXISTS idx_flashcards_user_review_date
    ON public.flashcards (user_id, next_review_at);

-- 5. Flashcard-SRS level filtering (widely used for per-level decks)
CREATE INDEX IF NOT EXISTS idx_flashcards_user_level_created
    ON public.flashcards (user_id, srs_level, created_at DESC);

-- === Deck-related Indices ==================================================

-- 6. Deck list ordering (getDecks: SELECT * FROM decks WHERE user_id = X ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_decks_user_created
    ON public.decks (user_id, created_at DESC);
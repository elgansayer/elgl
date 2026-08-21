-- Migration: 004_flashcards_srs.sql
-- Description: Create the per-user flashcards table used by the vocabulary/SRS flows.
-- Fixes #971.
--
-- Query contract:
--   * createOrUpdateFlashcard upserts on (user_id, word_token)
--   * getFlashcards scopes every read to user_id
--   * getDueReviews scopes by user_id and orders by next_review_at
--
-- This base migration intentionally uses the column names consumed by the current
-- application. Later compatibility migrations use IF EXISTS / IF NOT EXISTS and
-- therefore remain safe on both databases created from the historical schema and
-- databases bootstrapped from this canonical definition.

CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    word_token TEXT NOT NULL CHECK (btrim(word_token) <> ''),
    -- Retained as nullable metadata for backwards compatibility. Current writes do
    -- not require callers to send a source language.
    source_language TEXT,
    translation TEXT NOT NULL,
    original_context TEXT,
    definition TEXT,
    pronunciation_url TEXT,
    srs_level INTEGER NOT NULL DEFAULT 0 CHECK (srs_level >= 0 AND srs_level <= 4),
    easiness_factor REAL NOT NULL DEFAULT 2.5 CHECK (easiness_factor >= 1.3),
    repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
    interval_days INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The application uses PostgREST upsert(..., { onConflict: 'user_id, word_token' }).
-- A UNIQUE index is therefore required, not only a performance index. It also makes
-- retries/concurrent saves idempotent for a user's normalized word token.
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_user_word_unique
    ON public.flashcards (user_id, word_token);

-- Supports the initial review queue until the later SRS optimisation migration
-- replaces it with a partial index tuned for srs_level < 4.
CREATE INDEX IF NOT EXISTS idx_flashcards_user_review_date
    ON public.flashcards (user_id, next_review_at);

-- Flashcards contain private learner vocabulary and review history. Row-level
-- security is the database boundary even if a client bypasses the API layer.
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Recreate named policies so this migration can be retried without duplicate-policy
-- failures. Explicitly scope them to authenticated users; anon receives no policy.
DROP POLICY IF EXISTS "Users can select their own flashcards" ON public.flashcards;
CREATE POLICY "Users can select their own flashcards"
    ON public.flashcards FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own flashcards" ON public.flashcards;
CREATE POLICY "Users can insert their own flashcards"
    ON public.flashcards FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own flashcards" ON public.flashcards;
CREATE POLICY "Users can update their own flashcards"
    ON public.flashcards FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own flashcards" ON public.flashcards;
CREATE POLICY "Users can delete their own flashcards"
    ON public.flashcards FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Supabase normally provisions these grants at schema level; keeping the table
-- grants explicit makes the RLS contract deterministic in fresh environments.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;

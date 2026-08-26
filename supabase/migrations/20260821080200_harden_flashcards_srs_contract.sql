-- Migration: 20260821080200_harden_flashcards_srs_contract.sql
-- Description: Converge deployed flashcards schemas with the canonical #971 contract.
--
-- Editing 004_flashcards_srs.sql fixes clean bootstrap environments, but already
-- deployed databases do not replay historical migrations. This forward migration
-- therefore applies the non-destructive compatibility changes needed by the current
-- FlashcardsService and reasserts the per-user RLS/index invariants.

-- Historical databases used next_review_date. Rename it only when the current
-- next_review_at column is not already present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'next_review_date'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'next_review_at'
  ) THEN
    ALTER TABLE public.flashcards RENAME COLUMN next_review_date TO next_review_at;
  END IF;
END $$;

-- Historical databases used context_sentence/audio_pronunciation_url. Keep the
-- rename conditional so mixed-version and already-upgraded environments are safe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'context_sentence'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'original_context'
  ) THEN
    ALTER TABLE public.flashcards RENAME COLUMN context_sentence TO original_context;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'audio_pronunciation_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'pronunciation_url'
  ) THEN
    ALTER TABLE public.flashcards RENAME COLUMN audio_pronunciation_url TO pronunciation_url;
  END IF;
END $$;

-- Ensure all fields written/read by FlashcardsService exist. ADD COLUMN IF NOT
-- EXISTS makes this safe after either the historical or canonical base migration.
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS original_context TEXT,
  ADD COLUMN IF NOT EXISTS definition TEXT,
  ADD COLUMN IF NOT EXISTS pronunciation_url TEXT,
  ADD COLUMN IF NOT EXISTS easiness_factor REAL NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS repetitions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- The current API does not require source_language or original_context. Relax the
-- historical NOT NULL constraints when those legacy columns are present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'source_language'
  ) THEN
    ALTER TABLE public.flashcards ALTER COLUMN source_language DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'original_context'
  ) THEN
    ALTER TABLE public.flashcards ALTER COLUMN original_context DROP NOT NULL;
  END IF;
END $$;

-- Required by PostgREST onConflict: 'user_id, word_token'. A database that still
-- contains duplicate rows should fail here rather than silently preserve ambiguous
-- upsert behavior; operators can deduplicate intentionally before retrying.
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_user_word_unique
  ON public.flashcards (user_id, word_token);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;

-- Issue #1153: account-scoped muted words for the Moments feed.
--
-- Muted terms are user preferences and can reveal sensitive interests, so rows are
-- private to their owner. The API normally accesses this table through the backend
-- service-role client; RLS also protects direct authenticated Supabase clients.

CREATE TABLE IF NOT EXISTS public.user_muted_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word text NOT NULL,
  normalized_word text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_muted_words_word_length CHECK (char_length(word) BETWEEN 1 AND 64),
  CONSTRAINT user_muted_words_normalized_word_length CHECK (
    char_length(normalized_word) BETWEEN 1 AND 64
  ),
  CONSTRAINT user_muted_words_owner_word_unique UNIQUE (user_id, normalized_word)
);

CREATE INDEX IF NOT EXISTS user_muted_words_user_created_idx
  ON public.user_muted_words (user_id, created_at);

ALTER TABLE public.user_muted_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_muted_words FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_muted_words_select_own ON public.user_muted_words;
CREATE POLICY user_muted_words_select_own
  ON public.user_muted_words
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_muted_words_insert_own ON public.user_muted_words;
CREATE POLICY user_muted_words_insert_own
  ON public.user_muted_words
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_muted_words_delete_own ON public.user_muted_words;
CREATE POLICY user_muted_words_delete_own
  ON public.user_muted_words
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.user_muted_words FROM anon;
REVOKE UPDATE ON public.user_muted_words FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_muted_words TO authenticated;

-- Keep the preference bounded even when two devices add terms concurrently. An
-- advisory transaction lock scopes contention to one user instead of locking the
-- entire table. The duplicate check lets the unique constraint preserve idempotency.
CREATE OR REPLACE FUNCTION public.enforce_user_muted_words_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.user_muted_words
    WHERE user_id = NEW.user_id
      AND normalized_word = NEW.normalized_word
  ) THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT count(*)
    FROM public.user_muted_words
    WHERE user_id = NEW.user_id
  ) >= 100 THEN
    RAISE EXCEPTION 'muted word limit reached' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_user_muted_words_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS user_muted_words_limit_trigger ON public.user_muted_words;
CREATE TRIGGER user_muted_words_limit_trigger
  BEFORE INSERT ON public.user_muted_words
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_muted_words_limit();

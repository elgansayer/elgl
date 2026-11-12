-- Persist learner practice attempts for the verb conjugation trainer and the
-- IPA alphabet module. The API is the authoritative write boundary; RLS is
-- retained as defence in depth. Attempts are deleted with the owning account.

CREATE TABLE IF NOT EXISTS public.learning_practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('verb_conjugation', 'ipa_alphabet')),
  item_id text NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 200),
  language_code text NOT NULL CHECK (char_length(language_code) BETWEEN 2 AND 16),
  submitted_answer text NOT NULL CHECK (char_length(submitted_answer) BETWEEN 1 AND 200),
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_practice_attempts_user_module_created_idx
  ON public.learning_practice_attempts (user_id, module, created_at DESC);

ALTER TABLE public.learning_practice_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_practice_attempts_select_own
  ON public.learning_practice_attempts;
CREATE POLICY learning_practice_attempts_select_own
  ON public.learning_practice_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS learning_practice_attempts_insert_own
  ON public.learning_practice_attempts;
CREATE POLICY learning_practice_attempts_insert_own
  ON public.learning_practice_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

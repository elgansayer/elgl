-- Persist resumable, per-user lesson progress for the learner-facing Lessons module.
-- The API remains the authoritative write boundary; RLS is retained as defence in depth.

CREATE TABLE IF NOT EXISTS public.lesson_progress (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  segment_index integer NOT NULL DEFAULT 0 CHECK (segment_index >= 0 AND segment_index <= 10000),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_progress_user_updated_idx
  ON public.lesson_progress (user_id, updated_at DESC);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lesson_progress_select_own ON public.lesson_progress;
CREATE POLICY lesson_progress_select_own
  ON public.lesson_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS lesson_progress_insert_own ON public.lesson_progress;
CREATE POLICY lesson_progress_insert_own
  ON public.lesson_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS lesson_progress_update_own ON public.lesson_progress;
CREATE POLICY lesson_progress_update_own
  ON public.lesson_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Completion is monotonic. Retries or a stale client may move the resume position,
-- but once a lesson is completed it cannot be accidentally marked incomplete.
CREATE OR REPLACE FUNCTION public.preserve_lesson_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.completed := OLD.completed OR NEW.completed;

  IF OLD.completed_at IS NOT NULL THEN
    NEW.completed_at := OLD.completed_at;
  ELSIF NEW.completed THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSE
    NEW.completed_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_lesson_completion_trigger ON public.lesson_progress;
CREATE TRIGGER preserve_lesson_completion_trigger
BEFORE UPDATE ON public.lesson_progress
FOR EACH ROW
EXECUTE FUNCTION public.preserve_lesson_completion();

REVOKE ALL ON FUNCTION public.preserve_lesson_completion() FROM PUBLIC;

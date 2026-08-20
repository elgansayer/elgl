-- Production learner-facing Lessons support.
-- The legacy application already models a lessons table, but historical migration
-- history did not create it. Creating the table conditionally makes clean resets
-- deterministic while remaining a no-op on deployed databases where it exists.
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  content_json JSONB,
  language_code VARCHAR(16) NOT NULL,
  difficulty_level INTEGER,
  cover_image_url TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- Existing lessons stay visible after rollout to preserve current behaviour.
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lessons_visibility_check'
      AND conrelid = 'public.lessons'::regclass
  ) THEN
    ALTER TABLE public.lessons
      ADD CONSTRAINT lessons_visibility_check
      CHECK (visibility IN ('public', 'vip', 'hidden'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lessons_learner_feed_idx
  ON public.lessons (is_published, visibility, language_code, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.lesson_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  progress_percent SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  last_position INTEGER NOT NULL DEFAULT 0 CHECK (last_position >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_progress_user_updated_idx
  ON public.lesson_progress (user_id, updated_at DESC);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own lesson progress" ON public.lesson_progress;
CREATE POLICY "Users can read own lesson progress"
  ON public.lesson_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated clients intentionally have no INSERT/UPDATE policy. All mutations
-- go through the authenticated NestJS API and the service-role-only function below,
-- preserving monotonic progress semantics even if a client talks to Supabase directly.
DROP POLICY IF EXISTS "Users can insert own lesson progress" ON public.lesson_progress;
DROP POLICY IF EXISTS "Users can update own lesson progress" ON public.lesson_progress;

-- The backend calls this with the service role. GREATEST/COALESCE make retries and
-- concurrent resume updates monotonic: progress cannot move backwards and a
-- completed lesson cannot become incomplete.
CREATE OR REPLACE FUNCTION public.upsert_lesson_progress(
  p_user_id UUID,
  p_lesson_id UUID,
  p_progress_percent INTEGER,
  p_last_position INTEGER,
  p_complete BOOLEAN DEFAULT false
)
RETURNS public.lesson_progress
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result public.lesson_progress;
  bounded_progress INTEGER := LEAST(100, GREATEST(0, p_progress_percent));
  bounded_position INTEGER := GREATEST(0, p_last_position);
BEGIN
  INSERT INTO public.lesson_progress (
    user_id,
    lesson_id,
    progress_percent,
    last_position,
    completed_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_lesson_id,
    CASE WHEN p_complete THEN 100 ELSE bounded_progress END,
    bounded_position,
    CASE WHEN p_complete OR bounded_progress >= 100 THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (user_id, lesson_id) DO UPDATE
  SET progress_percent = GREATEST(
        public.lesson_progress.progress_percent,
        EXCLUDED.progress_percent
      ),
      last_position = GREATEST(
        public.lesson_progress.last_position,
        EXCLUDED.last_position
      ),
      completed_at = COALESCE(
        public.lesson_progress.completed_at,
        CASE
          WHEN p_complete
            OR GREATEST(public.lesson_progress.progress_percent, EXCLUDED.progress_percent) >= 100
          THEN now()
          ELSE NULL
        END
      ),
      updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_lesson_progress(UUID, UUID, INTEGER, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_lesson_progress(UUID, UUID, INTEGER, INTEGER, BOOLEAN) TO service_role;

COMMENT ON TABLE public.lesson_progress IS
  'Per-user learner progress for published lessons. Completion and position updates are monotonic.';

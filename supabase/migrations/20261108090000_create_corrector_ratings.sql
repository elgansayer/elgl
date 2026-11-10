-- Persist one 1-5 corrector rating per rater and expose only an aggregate score.
-- The NestJS API is the supported boundary. Browser roles cannot enumerate the
-- individual rating graph or write ratings directly.

CREATE TABLE IF NOT EXISTS public.corrector_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT corrector_ratings_rater_rated_key UNIQUE (rater_id, rated_user_id),
  CONSTRAINT corrector_ratings_no_self_check CHECK (rater_id <> rated_user_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.corrector_ratings'::regclass
      AND conname = 'corrector_ratings_no_self_check'
  ) THEN
    ALTER TABLE public.corrector_ratings
      ADD CONSTRAINT corrector_ratings_no_self_check
      CHECK (rater_id <> rated_user_id) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.corrector_ratings
  VALIDATE CONSTRAINT corrector_ratings_no_self_check;

CREATE INDEX IF NOT EXISTS corrector_ratings_rated_user_idx
  ON public.corrector_ratings (rated_user_id);
CREATE INDEX IF NOT EXISTS corrector_ratings_rater_idx
  ON public.corrector_ratings (rater_id);

ALTER TABLE public.corrector_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.corrector_ratings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.corrector_ratings TO service_role;

CREATE OR REPLACE FUNCTION public.get_corrector_score(p_user_id UUID)
RETURNS TABLE (
  average_score DOUBLE PRECISION,
  total_ratings BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    round(avg(cr.score)::numeric, 1)::double precision AS average_score,
    count(*)::bigint AS total_ratings
  FROM public.corrector_ratings AS cr
  WHERE cr.rated_user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_corrector_score(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_corrector_score(UUID) TO service_role;

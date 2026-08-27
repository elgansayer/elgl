-- Persist account-scoped hashtag follows for Moments topic discovery.
-- The NestJS API is the authoritative mutation boundary; RLS remains defence in depth.

CREATE TABLE IF NOT EXISTS public.followed_hashtags (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hashtag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hashtag),
  CONSTRAINT followed_hashtags_format_check CHECK (
    char_length(hashtag) BETWEEN 1 AND 50
    AND hashtag = lower(hashtag)
    AND hashtag = btrim(hashtag)
    AND hashtag !~ '[#[:space:]]'
  )
);

CREATE INDEX IF NOT EXISTS followed_hashtags_hashtag_created_idx
  ON public.followed_hashtags (hashtag, created_at DESC);

ALTER TABLE public.followed_hashtags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS followed_hashtags_select_own ON public.followed_hashtags;
CREATE POLICY followed_hashtags_select_own
  ON public.followed_hashtags
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Writes are performed by the authenticated NestJS API using the service role.
REVOKE INSERT, UPDATE, DELETE ON public.followed_hashtags FROM anon, authenticated;
GRANT SELECT ON public.followed_hashtags TO authenticated;

-- Atomic/idempotent follow mutation. The advisory lock makes the 100-topic cap
-- deterministic when the same account sends concurrent follow requests.
CREATE OR REPLACE FUNCTION public.follow_hashtag(
  p_user_id uuid,
  p_hashtag text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF p_user_id IS NULL OR p_hashtag IS NULL THEN
    RAISE EXCEPTION 'invalid_hashtag_follow' USING ERRCODE = '22023';
  END IF;

  IF char_length(p_hashtag) NOT BETWEEN 1 AND 50
     OR p_hashtag <> lower(p_hashtag)
     OR p_hashtag <> btrim(p_hashtag)
     OR p_hashtag ~ '[#[:space:]]' THEN
    RAISE EXCEPTION 'invalid_hashtag_follow' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2027));

  IF EXISTS (
    SELECT 1
    FROM public.followed_hashtags
    WHERE user_id = p_user_id AND hashtag = p_hashtag
  ) THEN
    RETURN false;
  END IF;

  IF (
    SELECT count(*)
    FROM public.followed_hashtags
    WHERE user_id = p_user_id
  ) >= 100 THEN
    RAISE EXCEPTION 'hashtag_follow_limit_reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.followed_hashtags (user_id, hashtag)
  VALUES (p_user_id, p_hashtag)
  ON CONFLICT (user_id, hashtag) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.follow_hashtag(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.follow_hashtag(uuid, text) TO service_role;

COMMENT ON TABLE public.followed_hashtags IS
  'Account-scoped Moments hashtag follows. Deleted automatically with the owning user.';

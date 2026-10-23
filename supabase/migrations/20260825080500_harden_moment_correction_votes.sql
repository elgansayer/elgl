-- Harden Moment correction-quality votes around a single server-owned transaction.
-- The API is the supported write boundary; browser roles cannot mutate or enumerate
-- the individual-voter social graph directly.

CREATE OR REPLACE FUNCTION public.rate_moment_correction(
  p_user_id uuid,
  p_moment_id uuid,
  p_comment_id uuid,
  p_vote text
)
RETURNS TABLE (
  comment_id uuid,
  user_vote text,
  up_votes bigint,
  down_votes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment public.moment_comments%ROWTYPE;
  v_existing_vote text;
BEGIN
  IF p_user_id IS NULL OR p_moment_id IS NULL OR p_comment_id IS NULL THEN
    RAISE EXCEPTION 'invalid_vote_target' USING ERRCODE = '22023';
  END IF;

  IF p_vote NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'invalid_vote_value' USING ERRCODE = '22023';
  END IF;

  -- Lock the correction row so vote mutation + aggregate counts are consistent
  -- even when multiple application replicas process votes concurrently.
  SELECT mc.*
  INTO v_comment
  FROM public.moment_comments AS mc
  WHERE mc.id = p_comment_id
    AND mc.moment_id = p_moment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'correction_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_comment.correction_payload IS NULL THEN
    RAISE EXCEPTION 'not_a_correction' USING ERRCODE = '22023';
  END IF;

  IF v_comment.user_id = p_user_id THEN
    RAISE EXCEPTION 'self_vote_not_allowed' USING ERRCODE = '42501';
  END IF;

  SELECT mcv.vote
  INTO v_existing_vote
  FROM public.moment_comment_votes AS mcv
  WHERE mcv.comment_id = p_comment_id
    AND mcv.user_id = p_user_id;

  IF v_existing_vote = p_vote THEN
    DELETE FROM public.moment_comment_votes AS mcv
    WHERE mcv.comment_id = p_comment_id
      AND mcv.user_id = p_user_id;
    v_existing_vote := NULL;
  ELSIF v_existing_vote IS NULL THEN
    INSERT INTO public.moment_comment_votes (comment_id, user_id, vote)
    VALUES (p_comment_id, p_user_id, p_vote);
    v_existing_vote := p_vote;
  ELSE
    UPDATE public.moment_comment_votes AS mcv
    SET vote = p_vote
    WHERE mcv.comment_id = p_comment_id
      AND mcv.user_id = p_user_id;
    v_existing_vote := p_vote;
  END IF;

  RETURN QUERY
  SELECT
    p_comment_id,
    v_existing_vote,
    count(*) FILTER (WHERE mcv.vote = 'up')::bigint,
    count(*) FILTER (WHERE mcv.vote = 'down')::bigint
  FROM public.moment_comment_votes AS mcv
  WHERE mcv.comment_id = p_comment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_moment_correction(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_moment_correction(uuid, uuid, uuid, text)
  TO service_role;

-- Existing clients use the authenticated NestJS API. Remove direct browser DML
-- so callers cannot bypass correction-only/self-vote checks or atomic toggling.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.moment_comment_votes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moment_comment_votes TO service_role;

-- Keep RLS as defence in depth if direct grants are intentionally restored later.
DROP POLICY IF EXISTS "Users can view all comment votes" ON public.moment_comment_votes;
DROP POLICY IF EXISTS "Users can insert their own votes" ON public.moment_comment_votes;
DROP POLICY IF EXISTS "Users can update their own votes" ON public.moment_comment_votes;
DROP POLICY IF EXISTS "Users can delete their own votes" ON public.moment_comment_votes;

CREATE POLICY "Users can view own correction votes"
  ON public.moment_comment_votes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own correction votes"
  ON public.moment_comment_votes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.moment_comments AS mc
      WHERE mc.id = comment_id
        AND mc.correction_payload IS NOT NULL
        AND mc.user_id <> auth.uid()
    )
  );

CREATE POLICY "Users can update own correction votes"
  ON public.moment_comment_votes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.moment_comments AS mc
      WHERE mc.id = comment_id
        AND mc.correction_payload IS NOT NULL
        AND mc.user_id <> auth.uid()
    )
  );

CREATE POLICY "Users can delete own correction votes"
  ON public.moment_comment_votes
  FOR DELETE
  USING (auth.uid() = user_id);

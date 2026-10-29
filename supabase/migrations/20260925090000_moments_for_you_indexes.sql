-- Support the bounded queries behind the Moments For You feed (issue #1668).
--
--   * Candidate retrieval reads the newest Moments network-wide:
--       SELECT * FROM public.moments ORDER BY created_at DESC LIMIT 100;
--   * Viewer engagement history reads the viewer's most recent likes:
--       SELECT moment_id FROM public.moment_likes
--        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100;
--
-- Neither query had a matching index, so each request scanned and sorted the
-- whole table. Both indexes are additive and IF NOT EXISTS keeps the migration
-- safe to retry. Older application versions ignore them.
--
-- Rollback: DROP INDEX IF EXISTS public.moments_created_at_idx;
--           DROP INDEX IF EXISTS public.moment_likes_user_created_idx;

CREATE INDEX IF NOT EXISTS moments_created_at_idx
  ON public.moments (created_at DESC);

CREATE INDEX IF NOT EXISTS moment_likes_user_created_idx
  ON public.moment_likes (user_id, created_at DESC);

-- Support the primary Moments read, publish and account-lifecycle paths (issue
-- #1827 schema contract review).
--
--   * The default "All" feed pins first, then newest first:
--       SELECT * FROM public.moments
--        ORDER BY is_pinned DESC, created_at DESC LIMIT 50;
--   * The "Classmates" feed applies the same ordering within one language:
--       SELECT * FROM public.moments WHERE target_language = $1
--        ORDER BY is_pinned DESC, created_at DESC LIMIT 50;
--   * Timeline fan-out loads the followers of each new Moment's author in
--     keyset-paginated batches (TimelineWorker.loadFollowerBatch):
--       SELECT follower_id FROM public.user_follows
--        WHERE following_id = $1 AND follower_id > $2
--        ORDER BY follower_id LIMIT $3;
--   * The GDPR archive, user statistics and account erasure read and delete a
--     user's comments and correction votes by owner:
--       SELECT * FROM public.moment_comments
--        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500;
--       SELECT count(*) FROM public.moment_comments WHERE user_id = $1;
--       DELETE FROM public.moment_comments WHERE user_id = $1;
--       DELETE FROM public.moment_comments WHERE reply_to_user_id = $1;
--       DELETE FROM public.moment_comment_votes WHERE user_id = $1;
--     The same lookups run for the ON DELETE CASCADE actions that
--     public.users(id) triggers on both tables.
--
-- None of these queries had an index that matched its filter and sort order, so
-- each request read and sorted the whole table (the user_follows primary key
-- leads with follower_id, so a lookup by following_id cannot use it, and the
-- unique constraint on moment_comment_votes leads with comment_id). All indexes
-- are additive and IF NOT EXISTS keeps the migration safe to retry. Older
-- application versions ignore them, so mixed-version deployments are safe.
-- moments_lang_idx and user_follows_follower_idx from 005_moments.sql stay in
-- place because migration history is append-only.
--
-- Rollback: DROP INDEX IF EXISTS public.moments_pinned_created_idx;
--           DROP INDEX IF EXISTS public.moments_lang_pinned_created_idx;
--           DROP INDEX IF EXISTS public.user_follows_following_idx;
--           DROP INDEX IF EXISTS public.moment_comments_user_created_idx;
--           DROP INDEX IF EXISTS public.moment_comments_reply_to_user_idx;
--           DROP INDEX IF EXISTS public.moment_comment_votes_user_idx;

CREATE INDEX IF NOT EXISTS moments_pinned_created_idx
  ON public.moments (is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS moments_lang_pinned_created_idx
  ON public.moments (target_language, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS user_follows_following_idx
  ON public.user_follows (following_id, follower_id);

CREATE INDEX IF NOT EXISTS moment_comments_user_created_idx
  ON public.moment_comments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS moment_comments_reply_to_user_idx
  ON public.moment_comments (reply_to_user_id)
  WHERE reply_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS moment_comment_votes_user_idx
  ON public.moment_comment_votes (user_id);

-- Migration: Optimise database indices for Matchmaking Algorithm query performance
-- Fixes #2292: Adds performance indices for interest-based matching and
-- language-exchange matchmaking queries used by the RecommendationsService
-- and the DiscoveryService batch recommendation pipeline.

-- ── 1. user_interests: composite index for interest-based matching ────────
-- The RecommendationsService.recommendationsByInterests() queries
-- user_interests with .in('tag', tags) and groups results by user_id.
-- A composite B-tree index on (tag, user_id) accelerates the IN + grouping.
-- The existing single-column idx_user_interests_tag is retained for
-- narrower queries.
CREATE INDEX IF NOT EXISTS idx_user_interests_tag_user_id
    ON public.user_interests (tag, user_id);

-- ── 2. users: partial index for matchmaking-ready profiles ───────────────
-- The RecommendationsService and DiscoveryService query users with these
-- simultaneous conditions in every matchmaking tier:
--   .eq('privacy_hide_from_search', false)
--   .eq('is_deleted', false)
--   .eq('is_deletion_pending', false)
--   .order('is_serious_learner', { ascending: false })
-- This partial index pre-sorts eligible profiles for fast retrieval.
CREATE INDEX IF NOT EXISTS users_matchmaking_serious_idx
    ON public.users (is_serious_learner DESC, study_streak_days DESC)
    WHERE privacy_hide_from_search = false
      AND is_deleted = false
      AND is_deletion_pending = false;

-- ── 3. users: matchmaking consent partial index ──────────────────────────
-- GDPR requires matchmaking_consent = true for all recommendations.
-- Combined with the discovery-ready filters, this narrows the working set
-- for every matchmaking query.
CREATE INDEX IF NOT EXISTS users_matchmaking_consent_idx
    ON public.users (id)
    WHERE matchmaking_consent = true;

COMMENT ON INDEX idx_user_interests_tag_user_id IS
    'Composite B-tree index accelerating interest-based partner matching (RecommendationsService.recommendationsByInterests). Supports .in(tag, userTags) queries with user_id grouping for shared interest counting.';
COMMENT ON INDEX users_matchmaking_serious_idx IS
    'Partial B-tree index for matchmaking queries filtering privacy-visible, non-deleted profiles ordered by serious-learner status and study streak. Supports RecommendationsService tiers 2-3 and DiscoveryService batch pipeline.';
COMMENT ON INDEX users_matchmaking_consent_idx IS
    'Partial index verifying GDPR Art. 7 matchmaking consent flag. Narrowed by matchmaking_consent = true to avoid full-table consent checks.';
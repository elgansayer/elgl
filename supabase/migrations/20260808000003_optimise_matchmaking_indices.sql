-- Migration: Optimise database indices for Matchmaking Algorithm
-- Fixes #2292: Adds missing columns, composite, filtered, and trigram
-- indices to accelerate the most common discovery / recommendation queries.
--
-- Query patterns analysed:
--   1. discovery.service.ts#searchPartners          -- multi-filter with ILIKE
--   2. discovery.service.ts#findByLanguagePair       -- language pair + sort
--   3. discovery.service.ts#getRecentNativeSpeakers  -- created_at range
--   4. discovery.service.ts#getSpotlightUsers        -- created_at order
--   5. discovery.service.ts#searchByCountryCity      -- ILIKE on country/city
--   6. recommendations.service.ts#calculateDailyRecommendations
--   7. recommendations.service.ts#recommendationsByInterests
--   8. recommendations.service.ts#recommendationsByLanguageExchange
--   9. recommendations.service.ts#recommendationsByActiveUsers
--  10. search_nearby_users RPC function

-- ── 0. Add missing columns used by matchmaking queries ─────────────────
-- country and city are used in discovery ILIKE filters but were never
-- added to the schema.  They are part of the user profile dimensions.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city TEXT;

-- interests, learning_goals, availability columns used by advanced filters
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS interests TEXT[];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS learning_goals TEXT[];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS availability_morning BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS availability_afternoon BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS availability_evening BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS available_time_start TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS available_time_end TEXT;

-- ── 1. GIN index for target_languages (array contains) ─────────────────
-- Used by every discovery query and language-exchange recommendation query.
-- Complements the existing GIN index on native_languages.
CREATE INDEX IF NOT EXISTS users_target_languages_idx ON public.users USING GIN (target_languages);

-- ── 2. Composite partial index for the universal "discoverable users" filter
-- ──    Used by EVERY single discovery/recommendation query.
-- ──    privacy_hide_from_search = false is the most common WHERE clause.
CREATE INDEX IF NOT EXISTS idx_users_discoverable ON public.users (study_streak_days DESC, correction_ratio DESC)
  WHERE privacy_hide_from_search = false;

-- ── 3. Individual B-tree indices on high-cardinality filter columns ────
-- proficiency_level filter (used in 4+ discovery query methods)
CREATE INDEX IF NOT EXISTS idx_users_proficiency_level ON public.users (proficiency_level);

-- gender filter (VIP-only, but still important for performance)
CREATE INDEX IF NOT EXISTS idx_users_gender ON public.users (gender);

-- Age range queries (gte/lte on age column)
CREATE INDEX IF NOT EXISTS idx_users_age ON public.users (age);

-- ── 4. Indices for sort strategies ──────────────────────────────────────
-- last_active_at (online_now sort, used by discovery and recently active queries)
CREATE INDEX IF NOT EXISTS idx_users_last_active_at_desc ON public.users (last_active_at DESC);

-- audio_intro_url IS NOT NULL (has_audio_intro filter)
-- Partial index only stores rows that match the filter
CREATE INDEX IF NOT EXISTS idx_users_has_audio_intro ON public.users (id)
  WHERE audio_intro_url IS NOT NULL AND audio_intro_url != '';

-- ── 5. Trigram indices for ILIKE filters (country, city) ────────────────
-- discovery.service.ts uses ilike('country', '%...%') and ilike('city', '%...%')
-- pg_trgm GIN indices make these searches use an index scan instead of a seq scan.
CREATE INDEX IF NOT EXISTS idx_users_country_trgm ON public.users USING GIN (country gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_city_trgm ON public.users USING GIN (city gin_trgm_ops);

-- ── 6. user_interests: composite index for interest-based matching ─────
-- recommendationsByInterests() queries user_interests by (tag IN [...]) AND (user_id != ?)
-- The existing indices idx_user_interests_user_id and idx_user_interests_tag
-- are sufficient; this composite index accelerates the common query pattern
-- of fetching all users who share a set of tags.
CREATE INDEX IF NOT EXISTS idx_user_interests_tag_user_id ON public.user_interests (tag, user_id);

-- ── 7. interest_vocabulary index optimisation ───────────────────────────
-- idx_interest_vocabulary_tag_lang already exists on (interest_tag, language).
-- No additional indices needed.

-- ── 8. Composite index for language-exchange matching ──────────────────
-- recommendationsByLanguageExchange() queries:
--   WHERE native_languages OVERLAPS (target_langs) AND target_languages OVERLAPS (native_langs)
-- The GIN indices on native_languages and target_languages handle this efficiently.
-- We keep idx_users_discoverable partial index which covers study_streak_days
-- and correction_ratio ordering used in best_match sorting.

-- ── 9. ANALYZE to refresh planner statistics ───────────────────────────
ANALYZE public.users;
ANALYZE public.user_interests;
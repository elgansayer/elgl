-- Migration: Optimise database indices for Discovery Map query performance
-- Fixes #2267: Adds missing indices, updates search_nearby_users RPC, and
-- ensures PostGIS/pg_trgm queries used by the discovery service are efficient.

-- ── 1. Users table indices for Discovery query filters ───────────────────

-- GIN index on target_languages (array) - used in every discovery query
-- via .contains('target_languages', [...]) and = ANY(u.target_languages)
CREATE INDEX IF NOT EXISTS users_target_languages_gin_idx
    ON public.users USING GIN (target_languages);

-- privacy_hide_from_search is used in every discovery WHERE clause
-- as .eq('privacy_hide_from_search', false); highly selective boolean
CREATE INDEX IF NOT EXISTS users_privacy_hide_from_search_idx
    ON public.users (privacy_hide_from_search)
    WHERE privacy_hide_from_search = false;

-- proficiency_level used for level-based filtering (.eq('proficiency_level', level))
CREATE INDEX IF NOT EXISTS users_proficiency_level_idx
    ON public.users (proficiency_level);

-- age used for range filtering (.gte('age', min) / .lte('age', max))
CREATE INDEX IF NOT EXISTS users_age_idx
    ON public.users (age);

-- gender used for equality filtering (.eq('gender', value))
CREATE INDEX IF NOT EXISTS users_gender_idx
    ON public.users (gender);

-- audio_intro_url used for IS NOT NULL / != '' filtering
CREATE INDEX IF NOT EXISTS users_audio_intro_url_idx
    ON public.users (audio_intro_url)
    WHERE audio_intro_url IS NOT NULL AND audio_intro_url != '';

-- last_active_at used for online_now sort ordering
CREATE INDEX IF NOT EXISTS users_last_active_at_idx
    ON public.users (last_active_at DESC);

-- Composite index for best_match ordering: study_streak_days DESC, correction_ratio DESC
CREATE INDEX IF NOT EXISTS users_study_streak_correction_idx
    ON public.users (study_streak_days DESC, correction_ratio DESC);

-- Trigram indices for country and city used with ilike '%value%' pattern matching
CREATE INDEX IF NOT EXISTS users_country_trgm_idx
    ON public.users USING GIN (country gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_city_trgm_idx
    ON public.users USING GIN (city gin_trgm_ops);

-- Partial index for discovery-ready users: combines the most common filters
-- used on every query (privacy visible, not deleted, has basic profile)
CREATE INDEX IF NOT EXISTS users_discovery_ready_idx
    ON public.users (created_at DESC, last_active_at DESC)
    WHERE privacy_hide_from_search = false
      AND scheduled_for_deletion_at IS NULL
      AND is_deletion_pending = false;

-- ── 2. Update search_nearby_users RPC function ───────────────────────────

-- Drop the old version (from 013_multiple_native_languages.sql)
DROP FUNCTION IF EXISTS public.search_nearby_users(
    double precision, double precision, double precision,
    uuid, character varying, character varying, boolean
);

-- Updated RPC with richer filter support matching the Discovery service query builder
CREATE OR REPLACE FUNCTION public.search_nearby_users(
    search_lat DOUBLE PRECISION,
    search_lon DOUBLE PRECISION,
    radius_m DOUBLE PRECISION,
    exclude_user_id UUID DEFAULT NULL,
    filter_native_arr VARCHAR(10)[] DEFAULT NULL,
    filter_target VARCHAR(10) DEFAULT NULL,
    serious_only BOOLEAN DEFAULT FALSE,
    filter_level VARCHAR(2) DEFAULT NULL,
    filter_gender VARCHAR(20) DEFAULT NULL,
    filter_age_min INTEGER DEFAULT NULL,
    filter_age_max INTEGER DEFAULT NULL,
    filter_audio_intro BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
    id UUID,
    display_name TEXT,
    native_languages VARCHAR(10)[],
    target_languages VARCHAR(10)[],
    bio_text TEXT,
    avatar_url TEXT,
    audio_intro_url TEXT,
    is_vip BOOLEAN,
    study_streak_days INTEGER,
    correction_ratio REAL,
    is_serious_learner BOOLEAN,
    proficiency_level VARCHAR(2),
    created_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    age INTEGER,
    gender VARCHAR(20),
    country TEXT,
    city TEXT,
    interests VARCHAR(50)[],
    distance DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.display_name,
        u.native_languages,
        u.target_languages,
        u.bio_text,
        u.avatar_url,
        u.audio_intro_url,
        u.is_vip,
        u.study_streak_days,
        u.correction_ratio,
        u.is_serious_learner,
        u.proficiency_level,
        u.created_at,
        u.last_active_at,
        u.age,
        u.gender,
        u.country,
        u.city,
        u.interests,
        ST_Distance(
            u.location,
            ST_SetSRID(ST_MakePoint(search_lon, search_lat), 4326)
        ) AS distance
    FROM public.users u
    WHERE
        -- Spatial: within radius using PostGIS (uses GIST index)
        ST_DWithin(
            u.location,
            ST_SetSRID(ST_MakePoint(search_lon, search_lat), 4326),
            radius_m
        )
        -- Exclude requester
        AND (exclude_user_id IS NULL OR u.id != exclude_user_id)
        -- Privacy
        AND u.privacy_hide_from_search = false
        -- Not scheduled for deletion
        AND u.scheduled_for_deletion_at IS NULL
        -- Native language filter using array overlap operator
        AND (filter_native_arr IS NULL OR u.native_languages && filter_native_arr)
        -- Target language filter
        AND (filter_target IS NULL OR filter_target = ANY(u.target_languages))
        -- Serious learner filter
        AND (NOT serious_only OR u.is_serious_learner = TRUE)
        -- Proficiency level filter
        AND (filter_level IS NULL OR u.proficiency_level = filter_level)
        -- Gender filter
        AND (filter_gender IS NULL OR u.gender = filter_gender)
        -- Age range filter
        AND (filter_age_min IS NULL OR u.age >= filter_age_min)
        AND (filter_age_max IS NULL OR u.age <= filter_age_max)
        -- Audio intro filter
        AND (NOT filter_audio_intro OR (
            u.audio_intro_url IS NOT NULL
            AND u.audio_intro_url != ''
        ))
    ORDER BY
        distance ASC
    LIMIT 100;
END;
$$;

COMMENT ON FUNCTION public.search_nearby_users IS
    'SECURITY DEFINER -- bypasses RLS to perform efficient PostGIS proximity discovery with comprehensive filter support. Uses GIST index on location, GIN index on native_languages/target_languages, and B-tree indices on proficiency_level/gender/age. The discovery service applies additional block-list filtering server-side.';
-- Migration: Finalise RLS policies for Discovery Map
-- Fixes #2274: Resolve Review Supabase Row Level Security (RLS) policies for Discovery Map
--
-- This migration resolves three remaining issues from the RLS review:
--   1. Consolidate the fragmented search_nearby_users function: four prior
--      migrations (013_multiple_native_languages, restrict_search_nearby_users_columns,
--      optimise_discovery_indices, gdpr_discovery_map) defined incompatible
--      signatures.  The backend passes 12 filter parameters, but the last
--      two migrations only accept 7, silently dropping filter_level,
--      filter_gender, filter_age_min, filter_age_max, and filter_audio_intro.
--      This migration creates a single definitive version with all 12 params.
--   2. Add missing RLS on matchmaking_crash_reports (created in migration
--      20260807180818 without policies).
--   3. Consolidate GDPR checks: both is_deletion_pending and
--      scheduled_for_deletion_at columns exist; the function now checks both.

-- ── 1. Consolidate search_nearby_users ───────────────────────────────────

-- Drop every known signature so only one function remains.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'search_nearby_users'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.search_nearby_users(' ||
                regexp_replace(r.sig::text, '^public\.search_nearby_users\(', '') ||
                ') CASCADE';
    END LOOP;
END $$;

-- Definitive version matching the backend's DiscoveryService.searchPartners()
-- RPC call (12 parameters) plus GDPR checks and restricted column projection.
CREATE OR REPLACE FUNCTION public.search_nearby_users(
    search_lat            DOUBLE PRECISION,
    search_lon            DOUBLE PRECISION,
    radius_m              DOUBLE PRECISION,
    exclude_user_id       UUID          DEFAULT NULL,
    filter_native_arr     VARCHAR(10)[] DEFAULT NULL,
    filter_target         VARCHAR(10)   DEFAULT NULL,
    serious_only          BOOLEAN       DEFAULT FALSE,
    filter_level          VARCHAR(2)    DEFAULT NULL,
    filter_gender         VARCHAR(20)   DEFAULT NULL,
    filter_age_min        INTEGER       DEFAULT NULL,
    filter_age_max        INTEGER       DEFAULT NULL,
    filter_audio_intro    BOOLEAN       DEFAULT FALSE
)
RETURNS TABLE(
    id                    UUID,
    display_name          TEXT,
    native_languages      VARCHAR(10)[],
    target_languages      VARCHAR(10)[],
    bio_text              TEXT,
    avatar_url            TEXT,
    audio_intro_url       TEXT,
    is_vip                BOOLEAN,
    study_streak_days     SMALLINT,
    correction_ratio      NUMERIC,
    is_serious_learner    BOOLEAN,
    proficiency_level     VARCHAR(2),
    created_at            TIMESTAMPTZ,
    last_active_at        TIMESTAMPTZ,
    distance_metres       DOUBLE PRECISION,
    age                   SMALLINT,
    gender                VARCHAR(20),
    country               TEXT,
    city                  TEXT,
    interests             VARCHAR(50)[],
    learning_goals        VARCHAR(50)[],
    mbti_personality_type TEXT,
    coins_balance         INTEGER,
    privacy_hide_from_search BOOLEAN,
    availability_morning  BOOLEAN,
    availability_afternoon BOOLEAN,
    availability_evening  BOOLEAN,
    available_time_start  TEXT,
    available_time_end    TEXT
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
        ST_Distance(
            u.location,
            ST_SetSRID(ST_MakePoint(search_lon, search_lat), 4326)
        ) AS distance_metres,
        u.age,
        u.gender,
        u.country,
        u.city,
        u.interests,
        u.learning_goals,
        u.mbti_personality_type,
        u.coins_balance,
        u.privacy_hide_from_search,
        u.availability_morning,
        u.availability_afternoon,
        u.availability_evening,
        u.available_time_start,
        u.available_time_end
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
        -- Privacy: honour user's discovery opt-out
        AND u.privacy_hide_from_search = FALSE
        -- GDPR: exclude users pending deletion (both columns supported)
        AND COALESCE(u.is_deletion_pending, FALSE) = FALSE
        AND u.scheduled_for_deletion_at IS NULL
        -- Native language filter using array overlap operator (uses GIN index)
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
        distance_metres ASC
    LIMIT 100;
END;
$$;

COMMENT ON FUNCTION public.search_nearby_users IS
    'SECURITY DEFINER -- Discovery Map primary spatial query.  Bypasses RLS for PostGIS performance; returns only discovery-necessary columns.  Applies privacy_hide_from_search, GDPR deletion checks, and all 12 filter parameters from DiscoveryService.searchPartners().  The backend adds block-list filtering, VIP spoofing, and advanced filters server-side.';

-- ── 2. Add RLS to matchmaking_crash_reports ──────────────────────────────

-- This table was created by migration 20260807180818 without RLS policies.
-- scoped to the affected user so only the reporting user (or service_role)
-- can read their own crash reports.

ALTER TABLE public.matchmaking_crash_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY matchmaking_crash_reports_select_own
    ON public.matchmaking_crash_reports
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY matchmaking_crash_reports_insert_own
    ON public.matchmaking_crash_reports
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ── 3. Confirm comments on previously reviewed policies ──────────────────

COMMENT ON POLICY users_select_authenticated ON public.users IS
    'Intentionally broad -- allows profile lookups for chat, rooms, and moments.  The Discovery Map backend (service_role) applies privacy_hide_from_search, block lists, and VIP spoofing in DiscoveryService.';

COMMENT ON POLICY blocks_select_own ON public.blocks IS
    'Supports Discovery Map block-list filtering via SafetyService.getBlockedAndBlockerIds.';

COMMENT ON POLICY user_blocks_select_own ON public.user_blocks IS
    'Supports Discovery Map block-list filtering via SafetyService.getBlockedAndBlockerIds.';
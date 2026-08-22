-- Canonicalise Serious Learner discovery on active study streaks.
--
-- users.is_serious_learner remains a preference that enables the filter for the
-- searching user. Candidate qualification is derived from study activity:
-- at least a 7-day streak and streak activity within the previous 24 hours.
-- This keeps the PostGIS path aligned with ordinary discovery and avoids stale
-- counters or correction behaviour determining eligibility.

CREATE INDEX IF NOT EXISTS idx_users_discovery_serious_active
  ON public.users (last_active_at DESC)
  WHERE privacy_hide_from_search = false
    AND is_deletion_pending = false
    AND scheduled_for_deletion_at IS NULL
    AND study_streak_days >= 7;

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
SET search_path = public
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
    FROM public.users AS u
    WHERE
        ST_DWithin(
            u.location,
            ST_SetSRID(ST_MakePoint(search_lon, search_lat), 4326),
            radius_m
        )
        AND (exclude_user_id IS NULL OR u.id <> exclude_user_id)
        AND u.privacy_hide_from_search = false
        AND u.is_deletion_pending = false
        AND u.scheduled_for_deletion_at IS NULL
        AND (filter_native_arr IS NULL OR u.native_languages && filter_native_arr)
        AND (filter_target IS NULL OR filter_target = ANY(u.target_languages))
        AND (
            NOT serious_only
            OR (
                u.study_streak_days >= 7
                AND u.last_active_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
            )
        )
        AND (filter_level IS NULL OR u.proficiency_level = filter_level)
        AND (filter_gender IS NULL OR u.gender = filter_gender)
        AND (filter_age_min IS NULL OR u.age >= filter_age_min)
        AND (filter_age_max IS NULL OR u.age <= filter_age_max)
        AND (
            NOT filter_audio_intro
            OR (u.audio_intro_url IS NOT NULL AND u.audio_intro_url <> '')
        )
    ORDER BY distance ASC
    LIMIT 100;
END;
$$;

COMMENT ON FUNCTION public.search_nearby_users(
  double precision,
  double precision,
  double precision,
  uuid,
  character varying[],
  character varying,
  boolean,
  character varying,
  character varying,
  integer,
  integer,
  boolean
) IS
  'Discovery spatial RPC. Serious-only means study_streak_days >= 7 with activity in the previous 24 hours; the stored serious-mode preference does not qualify candidates.';

-- Converge search_nearby_users on the active DiscoveryService RPC contract.
--
-- Historical migration ordering temporarily produced two incompatible overloads:
-- the discovery optimiser introduced the richer 12-argument RPC, while a later
-- column-restriction migration recreated the legacy 7-argument RPC. The backend
-- now calls only the richer named-argument contract, so remove the obsolete
-- overload and make the active projection explicit and restart-safe.

DROP FUNCTION IF EXISTS public.search_nearby_users(
  double precision,
  double precision,
  double precision,
  uuid,
  character varying,
  character varying,
  boolean
);

DROP FUNCTION IF EXISTS public.search_nearby_users(
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
);

CREATE FUNCTION public.search_nearby_users(
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
        AND u.scheduled_for_deletion_at IS NULL
        AND (filter_native_arr IS NULL OR u.native_languages && filter_native_arr)
        AND (filter_target IS NULL OR filter_target = ANY(u.target_languages))
        AND (NOT serious_only OR u.is_serious_learner = true)
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
  'Active DiscoveryService spatial RPC. Returns only discovery-safe profile fields, applies search privacy/deletion filters, and supports native language, target language, level, gender, age, serious-learner, and audio-intro filters.';

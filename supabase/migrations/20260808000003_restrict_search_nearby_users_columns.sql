-- Fix #2270: Restrict search_nearby_users to only return discovery-necessary columns.
-- The old function returned SETOF public.users (SELECT *), leaking sensitive fields
-- (email, password_hash, stripe_customer_id, etc.) and bloating payload sizes.
-- The new signature explicitly lists only the columns used by the discovery UI.

DROP FUNCTION IF EXISTS public.search_nearby_users(double precision, double precision, double precision, uuid, character varying, character varying, boolean);

CREATE OR REPLACE FUNCTION public.search_nearby_users(
    search_lat DOUBLE PRECISION,
    search_lon DOUBLE PRECISION,
    radius_m DOUBLE PRECISION,
    exclude_user_id UUID DEFAULT NULL,
    filter_native VARCHAR(10) DEFAULT NULL,
    filter_target VARCHAR(10) DEFAULT NULL,
    serious_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
    id uuid,
    display_name text,
    native_languages text[],
    target_languages text[],
    bio_text text,
    avatar_url text,
    audio_intro_url text,
    is_vip boolean,
    study_streak_days smallint,
    correction_ratio numeric,
    is_serious_learner boolean,
    proficiency_level text,
    created_at timestamptz,
    last_active_at timestamptz,
    distance_metres double precision,
    age smallint,
    gender text,
    country text,
    city text,
    interests text[],
    learning_goals text[],
    mbti_personality_type text,
    coins_balance integer,
    privacy_hide_from_search boolean,
    availability_morning boolean,
    availability_afternoon boolean,
    availability_evening boolean,
    available_time_start text,
    available_time_end text
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
        ST_DWithin(
            u.location,
            ST_SetSRID(ST_MakePoint(search_lon, search_lat), 4326),
            radius_m
        )
        AND (exclude_user_id IS NULL OR u.id != exclude_user_id)
        AND (filter_native IS NULL OR filter_native = ANY(u.native_languages))
        AND (filter_target IS NULL OR filter_target = ANY(u.target_languages))
        AND (NOT serious_only OR u.is_serious_learner = TRUE)
        AND u.privacy_hide_from_search = FALSE
    ORDER BY
        distance_metres ASC
    LIMIT 100;
END;
$$;

COMMENT ON FUNCTION public.search_nearby_users IS
    'SECURITY DEFINER -- bypasses RLS to perform efficient PostGIS proximity filtering. Only returns fields needed by the discovery UI. Discovery service applies additional access-control (blocks, privacy) server-side.';
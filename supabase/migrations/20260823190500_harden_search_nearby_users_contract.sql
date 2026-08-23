-- #1302: Harden the PostGIS discovery RPC used by DiscoveryController.
--
-- The application already routes coordinate-based partner searches through
-- public.search_nearby_users. This forward migration makes the database trust
-- boundary match the NestJS DTO contract so the SECURITY DEFINER function cannot
-- be used with unbounded or invalid coordinates/radii, and cannot be invoked
-- directly by browser roles.
--
-- Mixed-version safety: the function signature and result shape are unchanged.
-- Older/newer backend instances can call this version with the same named args.

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
DECLARE
    search_point public.geography;
BEGIN
    -- Keep the database boundary aligned with SearchQueryDto. Do not rely on
    -- HTTP validation alone because SECURITY DEFINER functions are privileged.
    IF search_lat IS NULL OR NOT (search_lat BETWEEN -90 AND 90) THEN
        RAISE EXCEPTION 'Invalid discovery latitude'
            USING ERRCODE = '22023';
    END IF;

    IF search_lon IS NULL OR NOT (search_lon BETWEEN -180 AND 180) THEN
        RAISE EXCEPTION 'Invalid discovery longitude'
            USING ERRCODE = '22023';
    END IF;

    IF radius_m IS NULL OR NOT (radius_m BETWEEN 1000 AND 20000000) THEN
        RAISE EXCEPTION 'Invalid discovery radius'
            USING ERRCODE = '22023';
    END IF;

    IF filter_age_min IS NOT NULL AND NOT (filter_age_min BETWEEN 1 AND 120) THEN
        RAISE EXCEPTION 'Invalid minimum age filter'
            USING ERRCODE = '22023';
    END IF;

    IF filter_age_max IS NOT NULL AND NOT (filter_age_max BETWEEN 1 AND 120) THEN
        RAISE EXCEPTION 'Invalid maximum age filter'
            USING ERRCODE = '22023';
    END IF;

    IF filter_age_min IS NOT NULL
       AND filter_age_max IS NOT NULL
       AND filter_age_min > filter_age_max THEN
        RAISE EXCEPTION 'Invalid discovery age range'
            USING ERRCODE = '22023';
    END IF;

    search_point := ST_SetSRID(ST_MakePoint(search_lon, search_lat), 4326)::public.geography;

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
        ST_Distance(u.location, search_point) AS distance
    FROM public.users AS u
    WHERE
        u.location IS NOT NULL
        AND ST_DWithin(u.location, search_point, radius_m)
        AND (exclude_user_id IS NULL OR u.id <> exclude_user_id)
        AND u.privacy_hide_from_search = false
        AND COALESCE(u.is_deletion_pending, false) = false
        AND u.scheduled_for_deletion_at IS NULL
        AND (filter_native_arr IS NULL OR u.native_languages && filter_native_arr)
        AND (filter_target IS NULL OR filter_target = ANY(u.target_languages))
        AND (NOT COALESCE(serious_only, false) OR u.is_serious_learner = true)
        AND (filter_level IS NULL OR u.proficiency_level = filter_level)
        AND (filter_gender IS NULL OR u.gender = filter_gender)
        AND (filter_age_min IS NULL OR u.age >= filter_age_min)
        AND (filter_age_max IS NULL OR u.age <= filter_age_max)
        AND (
            NOT COALESCE(filter_audio_intro, false)
            OR (u.audio_intro_url IS NOT NULL AND u.audio_intro_url <> '')
        )
    ORDER BY distance ASC, u.id ASC
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
  'Service-role-only PostGIS discovery RPC. Validates coordinates/radius, applies discovery privacy/deletion filters, returns bounded discovery-safe profile fields, and orders by nearest distance.';

-- SECURITY DEFINER discovery must stay behind the authenticated NestJS API.
-- Service-role callers bypass RLS intentionally; browser roles must not be able
-- to invoke the function directly and choose arbitrary excluded users/filters.
REVOKE ALL ON FUNCTION public.search_nearby_users(
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
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.search_nearby_users(
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
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.search_nearby_users(
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
) TO service_role;

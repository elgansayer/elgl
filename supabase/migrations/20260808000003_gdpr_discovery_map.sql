-- Migration: GDPR compliance fixes for Discovery Map
-- Fixes #2265: Audit GDPR compliance and data scrubbing for Discovery Map
--
-- 1. Update search_nearby_users to exclude deletion-pending users
-- 2. Add privacy_hide_from_search filter to search_nearby_users (was missing)

DROP FUNCTION IF EXISTS public.search_nearby_users(
    double precision, double precision, double precision, uuid,
    character varying, character varying, boolean
);

CREATE OR REPLACE FUNCTION public.search_nearby_users(
    search_lat DOUBLE PRECISION,
    search_lon DOUBLE PRECISION,
    radius_m DOUBLE PRECISION,
    exclude_user_id UUID DEFAULT NULL,
    filter_native VARCHAR(10) DEFAULT NULL,
    filter_target VARCHAR(10) DEFAULT NULL,
    serious_only BOOLEAN DEFAULT FALSE
)
RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.users u
    WHERE
        -- Within radius using PostGIS
        ST_DWithin(
            u.location,
            ST_SetSRID(ST_MakePoint(search_lon, search_lat), 4326),
            radius_m
        )
        -- Exclude requester
        AND (exclude_user_id IS NULL OR u.id != exclude_user_id)
        -- GDPR: Exclude users pending deletion
        AND (u.is_deletion_pending = FALSE OR u.is_deletion_pending IS NULL)
        -- GDPR: Exclude users who opted out of search
        AND (u.privacy_hide_from_search = FALSE)
        -- Filter native (any element in the array matches)
        AND (filter_native IS NULL OR filter_native = ANY(u.native_languages))
        -- Filter target (any element in the array matches)
        AND (filter_target IS NULL OR filter_target = ANY(u.target_languages))
        -- Serious learner
        AND (NOT serious_only OR u.is_serious_learner = TRUE)
    ORDER BY
        ST_Distance(
            u.location,
            ST_SetSRID(ST_MakePoint(search_lon, search_lat), 4326)
        ) ASC
    LIMIT 100;
END;
$$;

COMMENT ON FUNCTION public.search_nearby_users IS
    'SECURITY DEFINER -- bypasses RLS to perform efficient PostGIS proximity filtering. GDPR: excludes deletion-pending users and search-opted-out users. The discovery service applies additional access-control (blocks, privacy) server-side.';
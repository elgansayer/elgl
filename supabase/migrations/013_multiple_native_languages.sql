-- Change native_language from VARCHAR(10) to native_languages VARCHAR(10)[]
ALTER TABLE public.users 
RENAME COLUMN native_language TO native_language_old;

ALTER TABLE public.users 
ADD COLUMN native_languages VARCHAR(10)[] NOT NULL DEFAULT ARRAY['en']::VARCHAR(10)[];

-- Migrate existing data
UPDATE public.users 
SET native_languages = ARRAY[native_language_old]::VARCHAR(10)[]
WHERE native_language_old IS NOT NULL;

ALTER TABLE public.users 
DROP COLUMN native_language_old;

-- Re-create index for the array column using GIN instead of B-tree
DROP INDEX IF EXISTS users_native_language_idx;
CREATE INDEX IF NOT EXISTS users_native_languages_idx ON public.users USING GIN (native_languages);

-- Drop and recreate the search_nearby_users function to support array native languages
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

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    native_language VARCHAR(10) NOT NULL DEFAULT 'en',
    target_languages VARCHAR(10)[] DEFAULT ARRAY['es'],
    bio_text TEXT,
    avatar_url TEXT,
    audio_intro_url TEXT,
    primary_accent_color VARCHAR(7),
    location GEOGRAPHY(POINT, 4326),
    mock_location GEOGRAPHY(POINT, 4326),
    mock_country TEXT,
    mock_city TEXT,
    is_vip BOOLEAN NOT NULL DEFAULT false,
    vip_tier VARCHAR(50) NOT NULL DEFAULT 'free',
    coins_balance INTEGER NOT NULL DEFAULT 0,
    study_streak_days INTEGER NOT NULL DEFAULT 1,
    correction_ratio REAL NOT NULL DEFAULT 1.0,
    is_serious_learner BOOLEAN NOT NULL DEFAULT false,
    privacy_hide_age BOOLEAN NOT NULL DEFAULT false,
    privacy_hide_location BOOLEAN NOT NULL DEFAULT false,
    privacy_hide_from_search BOOLEAN NOT NULL DEFAULT false,
    proficiency_level VARCHAR(2) CHECK (proficiency_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance and spatial queries
CREATE INDEX IF NOT EXISTS users_location_idx ON public.users USING GIST (location);
CREATE INDEX IF NOT EXISTS users_mock_location_idx ON public.users USING GIST (mock_location);
CREATE INDEX IF NOT EXISTS users_display_name_trgm_idx ON public.users USING GIN (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_native_language_idx ON public.users (native_language);
CREATE INDEX IF NOT EXISTS users_is_vip_idx ON public.users (is_vip);
CREATE INDEX IF NOT EXISTS users_is_serious_learner_idx ON public.users (is_serious_learner);

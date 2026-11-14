-- Persistence for mounted API modules that read these tables but had no
-- replayed migration: interests, interest vocabulary, user interests,
-- resource library and status views.

CREATE TABLE IF NOT EXISTS public.interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(80) NOT NULL CHECK (char_length(btrim(name)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT interests_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.interest_vocabulary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interest_tag VARCHAR(64) NOT NULL CHECK (char_length(btrim(interest_tag)) > 0),
    language VARCHAR(16) NOT NULL CHECK (char_length(btrim(language)) > 0),
    vocab_word TEXT NOT NULL CHECK (char_length(btrim(vocab_word)) > 0),
    translation TEXT NULL,
    srs_level SMALLINT NOT NULL DEFAULT 0 CHECK (srs_level >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT interest_vocabulary_unique UNIQUE (interest_tag, language, vocab_word)
);

CREATE TABLE IF NOT EXISTS public.user_interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tag VARCHAR(64) NOT NULL CHECK (char_length(btrim(tag)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_interests_unique UNIQUE (user_id, tag)
);

CREATE TABLE IF NOT EXISTS public.resource_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL CHECK (char_length(btrim(title)) > 0),
    description TEXT NULL,
    url TEXT NOT NULL CHECK (char_length(btrim(url)) > 0),
    category VARCHAR(64) NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(32) NULL,
    content TEXT NULL,
    topic VARCHAR(64) NULL,
    difficulty VARCHAR(32) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.status_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status_owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT status_views_unique UNIQUE (status_id, viewer_id)
);

-- The clean-replay compatibility corpus materialises the two interest tables
-- before the historical RLS reviews, with only the columns those reviews need.
-- Converge those partial tables with the columns the interests API selects and
-- writes instead of dropping data that a deployed database may already hold.
ALTER TABLE public.user_interests
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();
ALTER TABLE public.user_interests
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.interest_vocabulary
    ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();
ALTER TABLE public.interest_vocabulary
    ADD COLUMN IF NOT EXISTS interest_tag VARCHAR(64);
ALTER TABLE public.interest_vocabulary
    ADD COLUMN IF NOT EXISTS language VARCHAR(16);
ALTER TABLE public.interest_vocabulary
    ADD COLUMN IF NOT EXISTS vocab_word TEXT;
ALTER TABLE public.interest_vocabulary
    ADD COLUMN IF NOT EXISTS translation TEXT;
ALTER TABLE public.interest_vocabulary
    ADD COLUMN IF NOT EXISTS srs_level SMALLINT DEFAULT 0;
ALTER TABLE public.interest_vocabulary
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'interest_vocabulary'
          AND column_name = 'canonical_tag'
    ) THEN
        EXECUTE 'UPDATE public.interest_vocabulary
                 SET interest_tag = canonical_tag
                 WHERE interest_tag IS NULL
                   AND canonical_tag IS NOT NULL';
        ALTER TABLE public.interest_vocabulary
            ALTER COLUMN canonical_tag DROP NOT NULL;
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS interest_vocabulary_tag_language_word_idx
    ON public.interest_vocabulary (interest_tag, language, vocab_word);

CREATE INDEX IF NOT EXISTS interest_vocabulary_language_tag_idx
    ON public.interest_vocabulary (language, interest_tag);
CREATE INDEX IF NOT EXISTS user_interests_user_idx
    ON public.user_interests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS resource_library_creator_created_idx
    ON public.resource_library (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS resource_library_topic_idx
    ON public.resource_library (topic, difficulty);
CREATE INDEX IF NOT EXISTS status_views_owner_status_created_idx
    ON public.status_views (status_owner_id, status_id, created_at DESC);
CREATE INDEX IF NOT EXISTS status_views_viewer_idx
    ON public.status_views (viewer_id, created_at DESC);

DROP TRIGGER IF EXISTS resource_library_set_updated_at ON public.resource_library;
CREATE TRIGGER resource_library_set_updated_at
    BEFORE UPDATE ON public.resource_library
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- These tables are owned by the API. Browser clients must not access them directly.
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.interests FROM anon, authenticated;
REVOKE ALL ON public.interest_vocabulary FROM anon, authenticated;
REVOKE ALL ON public.user_interests FROM anon, authenticated;
REVOKE ALL ON public.resource_library FROM anon, authenticated;
REVOKE ALL ON public.status_views FROM anon, authenticated;

GRANT ALL ON public.interests TO service_role;
GRANT ALL ON public.interest_vocabulary TO service_role;
GRANT ALL ON public.user_interests TO service_role;
GRANT ALL ON public.resource_library TO service_role;
GRANT ALL ON public.status_views TO service_role;

COMMENT ON TABLE public.interests IS 'Interest catalogue exposed by the interests API.';
COMMENT ON TABLE public.interest_vocabulary IS 'Per-language vocabulary for interest tags.';
COMMENT ON TABLE public.user_interests IS 'Interest tags chosen by each user.';
COMMENT ON TABLE public.resource_library IS 'User-created learning resources.';
COMMENT ON TABLE public.status_views IS 'Viewer log for status/moment views.';

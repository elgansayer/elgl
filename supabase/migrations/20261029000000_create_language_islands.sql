-- Deployable persistence for the routed language-islands community surface.
CREATE TABLE IF NOT EXISTS public.language_islands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL CHECK (char_length(btrim(name)) > 0),
    description TEXT NULL,
    language_pair VARCHAR(32) NOT NULL CHECK (language_pair ~ '^[a-z]{2,3}(-[A-Za-z]{2,8})+$'),
    host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    max_members INTEGER NULL CHECK (max_members IS NULL OR max_members > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.language_island_members (
    island_id UUID NOT NULL REFERENCES public.language_islands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (island_id, user_id)
);

CREATE INDEX IF NOT EXISTS language_islands_active_created_idx
    ON public.language_islands (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS language_islands_language_pair_idx
    ON public.language_islands (language_pair, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS language_islands_host_idx
    ON public.language_islands (host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS language_island_members_user_idx
    ON public.language_island_members (user_id, joined_at DESC);

DROP TRIGGER IF EXISTS language_islands_set_updated_at ON public.language_islands;
CREATE TRIGGER language_islands_set_updated_at
    BEFORE UPDATE ON public.language_islands
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- These tables are owned by the API. Browser clients must not access them directly.
ALTER TABLE public.language_islands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_island_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.language_islands FROM anon, authenticated;
REVOKE ALL ON public.language_island_members FROM anon, authenticated;
GRANT ALL ON public.language_islands TO service_role;
GRANT ALL ON public.language_island_members TO service_role;

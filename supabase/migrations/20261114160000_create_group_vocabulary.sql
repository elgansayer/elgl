-- Shared vocabulary banks for group chats. Any member can add a term; the
-- creator, group owner or a group admin can remove it.

CREATE TABLE IF NOT EXISTS public.group_vocabulary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    term VARCHAR(120) NOT NULL CHECK (char_length(btrim(term)) > 0),
    translation VARCHAR(240) NOT NULL CHECK (char_length(btrim(translation)) > 0),
    language VARCHAR(16) NOT NULL CHECK (char_length(btrim(language)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT group_vocabulary_unique UNIQUE (group_id, language, term)
);

DO $$
BEGIN
    IF to_regclass('public.groups') IS NOT NULL THEN
        ALTER TABLE public.group_vocabulary
            ADD CONSTRAINT group_vocabulary_group_id_fkey
            FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS group_vocabulary_group_created_idx
    ON public.group_vocabulary (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_vocabulary_group_language_idx
    ON public.group_vocabulary (group_id, language, term);

ALTER TABLE public.group_vocabulary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_vocabulary FROM anon, authenticated;
GRANT ALL ON public.group_vocabulary TO service_role;

COMMENT ON TABLE public.group_vocabulary IS
    'Member-maintained vocabulary bank shared inside a group chat.';

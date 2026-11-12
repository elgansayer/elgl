-- Issue #1886: production persistence for hobby tags and target vocabulary.
--
-- The legacy hobby-tag migration shares its numeric prefix with another file.
-- Re-declaring the schema under a timestamped identity makes the live NestJS
-- contract explicit for normal deploys and deterministic clean replays.

CREATE TABLE IF NOT EXISTS public.hobby_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  icon TEXT,
  target_vocabulary JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_hobby_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hobby_tag_id UUID NOT NULL REFERENCES public.hobby_tags(id) ON DELETE CASCADE,
  proficiency_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, hobby_tag_id)
);

CREATE INDEX IF NOT EXISTS hobby_tags_category_name_idx
  ON public.hobby_tags (category, name);
CREATE INDEX IF NOT EXISTS user_hobby_tags_user_id_idx
  ON public.user_hobby_tags (user_id);
CREATE INDEX IF NOT EXISTS user_hobby_tags_hobby_tag_id_idx
  ON public.user_hobby_tags (hobby_tag_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_hobby_tags'::regclass
      AND conname = 'user_hobby_tags_proficiency_level_check'
  ) THEN
    ALTER TABLE public.user_hobby_tags
      ADD CONSTRAINT user_hobby_tags_proficiency_level_check
      CHECK (proficiency_level BETWEEN 0 AND 3) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.hobby_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hobby_tags ENABLE ROW LEVEL SECURITY;

-- Create hobby_tags table
CREATE TABLE IF NOT EXISTS public.hobby_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    icon TEXT,
    target_vocabulary JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_hobby_tags table
CREATE TABLE IF NOT EXISTS public.user_hobby_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    hobby_tag_id UUID NOT NULL REFERENCES public.hobby_tags(id) ON DELETE CASCADE,
    proficiency_level INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, hobby_tag_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS hobby_tags_name_idx ON public.hobby_tags (name);
CREATE INDEX IF NOT EXISTS hobby_tags_category_idx ON public.hobby_tags (category);
CREATE INDEX IF NOT EXISTS user_hobby_tags_user_id_idx ON public.user_hobby_tags (user_id);
CREATE INDEX IF NOT EXISTS user_hobby_tags_hobby_tag_id_idx ON public.user_hobby_tags (hobby_tag_id);

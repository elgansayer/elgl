-- Create moments, moment_comments, moment_likes, and user_follows tables
CREATE TABLE IF NOT EXISTS public.moments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    text_content TEXT,
    media_urls TEXT[] DEFAULT '{}',
    media_type VARCHAR(50) DEFAULT 'none',
    target_language VARCHAR(50) NOT NULL DEFAULT 'en',
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    likes_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    moment_id UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_moment_like UNIQUE (moment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.moment_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    moment_id UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    text_content TEXT,
    correction_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_follows (
    follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS moments_user_created_idx ON public.moments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moments_lang_idx ON public.moments (target_language);
CREATE INDEX IF NOT EXISTS moment_comments_idx ON public.moment_comments (moment_id, created_at ASC);
CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON public.user_follows (follower_id);

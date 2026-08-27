-- Create user_profile_likes table
CREATE TABLE IF NOT EXISTS public.user_profile_likes (
    liker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    liked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (liker_id, liked_id)
);

CREATE INDEX IF NOT EXISTS user_profile_likes_liked_idx ON public.user_profile_likes (liked_id);
CREATE INDEX IF NOT EXISTS user_profile_likes_liker_idx ON public.user_profile_likes (liker_id);

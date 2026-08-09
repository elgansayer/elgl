-- Create moments, moment_comments, moment_likes, and user_follows tables
CREATE TABLE IF NOT EXISTS public.moments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    text_content TEXT,
    media_urls TEXT[] DEFAULT '{}',
    media_type VARCHAR(50) DEFAULT 'none',
    target_language VARCHAR(50) NOT NULL DEFAULT 'en',
    voice_note_url TEXT,
    post_type VARCHAR(50) DEFAULT 'moment',
    question_text TEXT,
    question_options TEXT[] DEFAULT '{}',
    correct_answer VARCHAR(255),
    correct_answers_count INTEGER NOT NULL DEFAULT 0,
    total_answers_count INTEGER NOT NULL DEFAULT 0,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    likes_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    is_ephemeral BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ,
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
    parent_comment_id UUID REFERENCES public.moment_comments(id) ON DELETE CASCADE,
    reply_to_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS moments_media_type_idx ON public.moments (media_type);
CREATE INDEX IF NOT EXISTS moments_post_type_idx ON public.moments (post_type);
CREATE INDEX IF NOT EXISTS moments_is_ephemeral_idx ON public.moments (is_ephemeral, expires_at);
CREATE INDEX IF NOT EXISTS moment_likes_moment_user_idx ON public.moment_likes (moment_id, user_id);
CREATE INDEX IF NOT EXISTS moment_comments_idx ON public.moment_comments (moment_id, created_at ASC);
CREATE INDEX IF NOT EXISTS moment_comments_parent_idx ON public.moment_comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON public.user_follows (follower_id);

-- Moment comment votes (upvote/downvote correction suggestions)
CREATE TABLE IF NOT EXISTS public.moment_comment_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.moment_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_moment_comment_vote UNIQUE (comment_id, user_id)
);

-- Moment question answers (for language question quiz posts)
CREATE TABLE IF NOT EXISTS public.moment_question_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    moment_id UUID NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    selected_answer VARCHAR(255) NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_moment_question_answer UNIQUE (moment_id, user_id)
);

CREATE INDEX IF NOT EXISTS moment_comment_votes_comment_idx ON public.moment_comment_votes (comment_id, vote_type);
CREATE INDEX IF NOT EXISTS moment_question_answers_moment_idx ON public.moment_question_answers (moment_id);
CREATE INDEX IF NOT EXISTS moment_question_answers_user_idx ON public.moment_question_answers (user_id);

-- Create flashcards table for LingQ-style SRS vocabulary tracking
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    word_token VARCHAR(255) NOT NULL,
    original_context TEXT,
    translation TEXT NOT NULL,
    definition TEXT,
    pronunciation_url TEXT,
    srs_level INTEGER NOT NULL DEFAULT 0,
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_word_token UNIQUE (user_id, word_token)
);

CREATE INDEX IF NOT EXISTS flashcards_user_word_idx ON public.flashcards (user_id, word_token);
CREATE INDEX IF NOT EXISTS flashcards_user_review_idx ON public.flashcards (user_id, next_review_at ASC);

-- Migration: 004_flashcards_srs.sql
-- Description: Create flashcards table for LingQ Interactive Reading & SRS Vocabulary Bank

CREATE TABLE public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    word_token TEXT NOT NULL,
    source_language TEXT NOT NULL,
    translation TEXT NOT NULL,
    context_sentence TEXT NOT NULL,
    audio_pronunciation_url TEXT,
    srs_level INTEGER NOT NULL DEFAULT 0 CHECK (srs_level >= 0 AND srs_level <= 4),
    next_review_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for fast querying by user and word token, and for SRS chronological review queue
CREATE INDEX idx_flashcards_user_word ON public.flashcards (user_id, word_token);
CREATE INDEX idx_flashcards_user_review_date ON public.flashcards (user_id, next_review_date);

-- Enable Row Level Security
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can select their own flashcards" 
    ON public.flashcards FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flashcards" 
    ON public.flashcards FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flashcards" 
    ON public.flashcards FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flashcards" 
    ON public.flashcards FOR DELETE 
    USING (auth.uid() = user_id);

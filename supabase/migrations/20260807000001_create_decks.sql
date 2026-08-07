-- Create decks table for flashcard organisation
CREATE TABLE IF NOT EXISTS public.decks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    colour TEXT NOT NULL DEFAULT '#6366f1',
    icon TEXT NOT NULL DEFAULT '📚',
    card_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decks_user_id_idx ON public.decks (user_id);

-- Create junction table for deck-flashcard relations
CREATE TABLE IF NOT EXISTS public.deck_flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (deck_id, flashcard_id)
);

CREATE INDEX IF NOT EXISTS deck_flashcards_deck_id_idx ON public.deck_flashcards (deck_id);
CREATE INDEX IF NOT EXISTS deck_flashcards_flashcard_id_idx ON public.deck_flashcards (flashcard_id);

-- Enable RLS
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_flashcards ENABLE ROW LEVEL SECURITY;

-- RLS policies for decks
CREATE POLICY "Users can view their own decks"
    ON public.decks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own decks"
    ON public.decks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decks"
    ON public.decks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decks"
    ON public.decks FOR DELETE
    USING (auth.uid() = user_id);

-- RLS policies for deck_flashcards (via deck ownership)
CREATE POLICY "Users can view flashcards in their own decks"
    ON public.deck_flashcards FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.decks
            WHERE decks.id = deck_flashcards.deck_id
            AND decks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert flashcards into their own decks"
    ON public.deck_flashcards FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.decks
            WHERE decks.id = deck_flashcards.deck_id
            AND decks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete flashcards from their own decks"
    ON public.deck_flashcards FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.decks
            WHERE decks.id = deck_flashcards.deck_id
            AND decks.user_id = auth.uid()
        )
    );
-- Consolidate the flashcard deck schema into the Supabase SQL migration corpus.
-- Historical deployments may already have these objects from the TypeScript
-- migration backend/src/database/migrations/20260801000000-create-flashcard-decks.ts.
CREATE TABLE IF NOT EXISTS public.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  colour TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT '📚',
  card_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decks_user_id ON public.decks(user_id);

CREATE TABLE IF NOT EXISTS public.deck_flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(deck_id, flashcard_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_flashcards_deck_id
  ON public.deck_flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_deck_flashcards_flashcard_id
  ON public.deck_flashcards(flashcard_id);

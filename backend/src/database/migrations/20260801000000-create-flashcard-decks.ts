import { SupabaseClient } from '@supabase/supabase-js';

export async function up(client: SupabaseClient): Promise<void> {
  // Create decks table
  await client.rpc('pgsodium_execute_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS decks (
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

      CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id);

      -- Junction table for many-to-many relationship
      CREATE TABLE IF NOT EXISTS deck_flashcards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
        added_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(deck_id, flashcard_id)
      );

      CREATE INDEX IF NOT EXISTS idx_deck_flashcards_deck_id ON deck_flashcards(deck_id);
      CREATE INDEX IF NOT EXISTS idx_deck_flashcards_flashcard_id ON deck_flashcards(flashcard_id);
    `,
  });
}

export async function down(client: SupabaseClient): Promise<void> {
  await client.rpc('pgsodium_execute_sql', {
    sql: `
      DROP TABLE IF EXISTS deck_flashcards;
      DROP TABLE IF EXISTS decks;
    `,
  });
}

export interface Deck {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  colour: string;
  icon: string;
  card_count: number;
  created_at: string;
  updated_at: string;
}

export interface DeckFlashcard {
  id: string;
  deck_id: string;
  flashcard_id: string;
  added_at: string;
}

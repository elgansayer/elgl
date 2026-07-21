export interface Flashcard {
  id: string;
  user_id: string;
  word_token: string;
  original_context?: string;
  translation: string;
  definition?: string;
  pronunciation_url?: string;
  srs_level: number;
  next_review_at: string;
  created_at: string;
}

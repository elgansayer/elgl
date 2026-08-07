export interface Flashcard {
  id: string;
  user_id: string;
  word_token: string;
  original_context?: string | null;
  translation: string;
  definition?: string | null;
  pronunciation_url?: string | null;
  srs_level: number | null;
  easiness_factor: number;
  repetition_count: number;
  next_review_at: string;
  created_at: string;
}

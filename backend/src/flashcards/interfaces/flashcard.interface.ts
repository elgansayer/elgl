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
  repetitions: number;
  interval_days: number;
  next_review_at: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

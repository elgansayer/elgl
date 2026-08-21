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
  /** Indicates the flashcard data was computed locally in degraded mode (DB unavailable). */
  degraded?: boolean;
}

export interface SrsHealthStatus {
  healthy: boolean;
  mode: 'full' | 'degraded';
  degradedServices: string[];
  lastSuccessfulSync: string | null;
  cacheStats: {
    cachedFlashcardCount: number;
    pendingSyncCount: number;
  };
}

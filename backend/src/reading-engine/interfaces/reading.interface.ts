/** A reading resource (article, story, text) for the LingQ-style reading engine. */
export interface ReadingResource {
  id: string;
  title: string;
  content: string;
  language: string;
  difficulty?: string;
  topic?: string;
  sourceUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Single word token produced by Intl.Segmenter. */
export interface ReadingToken {
  index: number;
  token: string;
  position: number;
  isWordLike: boolean;
}

/** Tokenised breakdown of a reading resource. */
export interface ReadingTokenBreakdown {
  resourceId: string;
  language: string;
  totalTokens: number;
  uniqueTokens: number;
  tokens: ReadingToken[];
}

/** Aggregated reading progress for a single user. */
export interface ReadingProgress {
  userId: string;
  wordsRead: number;
  articlesCompleted: number;
  totalReadingTimeSeconds: number;
  fluencyPercentage: number;
  lastReadAt?: string | null;
}

/** Minimal metadata for a reading session. */
export interface ReadingSession {
  id: string;
  userId: string;
  resourceId: string;
  startedAt: string;
  endedAt?: string;
  wordsRead: number;
  durationSeconds: number;
}

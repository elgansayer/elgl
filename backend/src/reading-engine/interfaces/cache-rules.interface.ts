/**
 * Redis cache invalidation rules for the LingQ Reading Engine.
 *
 * Every cache entry produced by this module uses one of the following key
 * namespaces.  Invalidation is triggered either by TTL expiry, explicit
 * deletion via the public API, or event-driven bulk invalidation when a
 * user's data changes.
 */

/** Prefixes used to namespace Redis keys -- prevents accidental collisions. */
export enum ReadingEngineCacheNamespace {
  /** Cached reading resources (articles, stories, texts). */
  RESOURCE = 'reading:resource',
  /** Cached word-token breakdown results. */
  TOKEN = 'reading:token',
  /** Cached flashcard / SRS suggestion lists per user. */
  SUGGESTION = 'reading:suggestion',
  /** Cached user reading progress (words read, fluency %, streaks). */
  PROGRESS = 'reading:progress',
  /** Cached inline translations (sentence-level). */
  TRANSLATION = 'reading:translation',
  /** Cached reading session metadata. */
  SESSION = 'reading:session',
}

export interface CacheInvalidationRule {
  /** Human-readable description for observability. */
  readonly description: string;
  /** Redis key pattern(s) to invalidate (glob-style, passed to SCAN+DEL). */
  readonly patterns: string[];
  /** Event types that trigger this invalidation. */
  readonly triggers: CacheInvalidationTrigger[];
}

export enum CacheInvalidationTrigger {
  /** Fires when a reading resource is created / updated / deleted. */
  RESOURCE_MUTATED = 'resource_mutated',
  /** Fires when a user saves a word or updates flashcard SRS level. */
  FLASHCARD_MUTATED = 'flashcard_mutated',
  /** Fires when a user completes a reading session (progress update). */
  READING_COMPLETED = 'reading_completed',
  /** Fires when a user requests a new translation. */
  TRANSLATION_REQUESTED = 'translation_requested',
  /** Bulk-invalidate all keys for a specific user. */
  USER_DATA_CLEARED = 'user_data_cleared',
}

export interface CacheKeyOptions {
  namespace: ReadingEngineCacheNamespace;
  /** Optional sub-resource identifier (e.g. resource uuid). */
  resourceId?: string;
  /** The owning user's id -- always required for user-scoped keys. */
  userId: string;
  /** Additional discriminators (e.g. language code). */
  extra?: string;
}

/**
 * Redis cache invalidation rules for the Discovery Map module.
 *
 * Every cache entry produced by this module uses one of the following key
 * namespaces.  Invalidation is triggered either by TTL expiry, explicit
 * deletion via the public API, or event-driven bulk invalidation when a
 * user's data or the global partner pool changes.
 */

/** Prefixes used to namespace Redis keys -- prevents accidental collisions. */
export enum DiscoveryCacheNamespace {
  /** Partner of the Week global pool (exact key -- no wildcard). */
  PARTNER_OF_WEEK = 'partner_of_week_ids',
  /** Daily partner recommendations per user. */
  DAILY_RECOMMENDATIONS = 'daily_recommendations',
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
  /** Fires when the Partner of the Week pool is recalculated by cron. */
  PARTNER_OF_WEEK_UPDATED = 'partner_of_week_updated',
  /** Fires when a single user's daily recommendations are recalculated. */
  RECOMMENDATIONS_UPDATED = 'recommendations_updated',
  /** Fires when a user's profile changes (their own rec cache is stale). */
  USER_PROFILE_UPDATED = 'user_profile_updated',
  /** Bulk-invalidate all discovery keys for a specific user. */
  USER_DATA_CLEARED = 'user_data_cleared',
}

export interface CacheKeyOptions {
  namespace: DiscoveryCacheNamespace;
  /** The owning user's id -- required for user-scoped keys. */
  userId?: string;
}
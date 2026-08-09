/**
 * Redis cache invalidation rules for the Discovery Map engine.
 *
 * Every cache entry produced by the discovery module uses one of the
 * following key namespaces.  Invalidation is triggered by data-mutation
 * events that affect the search results, rankings, or CDN-cached responses.
 */

/** Prefixes used to namespace Redis keys -- prevents accidental collisions. */
export enum DiscoveryCacheNamespace {
  /** Cached Partner of the Week ID list (global, refreshed weekly by cron). */
  PARTNER_OF_WEEK = 'partner_of_week_ids',
  /** Cached daily partner recommendations per user. */
  DAILY_RECOMMENDATIONS = 'daily_recommendations',
  /** Cached recommendation lists (alternative key used by recommendations module). */
  RECOMMENDATIONS_DAILY = 'recommendations:daily',
  /** Cached language-pair search results (user-scoped). */
  LANGUAGE_PAIR = 'discovery:language_pair',
  /** Cached search-by-location results (user-scoped). */
  LOCATION_SEARCH = 'discovery:location_search',
  /** Cached recent native speakers list (shared, short-lived). */
  RECENT_NATIVE = 'discovery:recent_native',
  /** Cached spotlight users list (shared, short-lived). */
  SPOTLIGHT = 'discovery:spotlight',
  /** Cached audio intro results (user-scoped). */
  AUDIO_INTROS = 'discovery:audio_intros',
  /** Cached partner search results (user-scoped). */
  PARTNER_SEARCH = 'discovery:partner_search',
}

export interface CacheInvalidationRule {
  /** Human-readable description for observability. */
  readonly description: string;
  /** Redis key pattern(s) to invalidate (glob-style, passed to SCAN+DEL). */
  readonly patterns: string[];
  /** Event types that trigger this invalidation. */
  readonly triggers: DiscoveryCacheInvalidationTrigger[];
}

export enum DiscoveryCacheInvalidationTrigger {
  /** Fires when the weekly Partner of the Week cron job completes. */
  PARTNER_OF_WEEK_UPDATED = 'partner_of_week_updated',
  /** Fires when the daily recommendations cron job completes. */
  DAILY_RECOMMENDATIONS_UPDATED = 'daily_recommendations_updated',
  /** Fires when a user updates their profile (languages, bio, location, etc.). */
  USER_PROFILE_UPDATED = 'user_profile_updated',
  /** Fires when a user's VIP status changes. */
  USER_VIP_UPDATED = 'user_vip_updated',
  /** Fires when a user's location (geography) changes. */
  USER_LOCATION_UPDATED = 'user_location_updated',
  /** Fires when a user's study streak or correction ratio changes significantly. */
  USER_METRICS_UPDATED = 'user_metrics_updated',
  /** Fires when a new user completes their profile and enters the discovery pool. */
  NEW_USER_ONBOARDED = 'new_user_onboarded',
  /** Bulk-invalidate all discovery keys scoped to a specific user. */
  USER_DISCOVERY_CLEARED = 'user_discovery_cleared',
}

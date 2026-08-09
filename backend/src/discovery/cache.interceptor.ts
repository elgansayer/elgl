import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { Response } from 'express';

/**
 * Cache-Control directives optimised for Cloudflare edge caching of the
 * Discovery / Matchmaking Algorithm endpoints.
 *
 * ## Strategy overview
 *
 * | Tier              | Cache-Control (browsers)  | CDN-Cache-Control (Cloudflare)            | Cache-Tag             |
 * |-------------------|---------------------------|-------------------------------------------|-----------------------|
 * | Public long       | public, max-age=3600      | public, max-age=86400, SWR 1 week          | discovery:potw        |
 * | Public short      | public, max-age=60        | public, max-age=600, SWR 5 min             | discovery:public      |
 * | Edge medium       | private, max-age=0        | public, max-age=120, SWR 5 min             | per-endpoint granular |
 * | Edge short        | private, max-age=0        | public, max-age=30, SWR 30s                | per-endpoint granular |
 * | No-store          | private, no-store         | private, no-store                          | (none)                |
 *
 * ## Key design decisions
 *
 *  - Partner of the Week: public long-lived CDN cache (refreshed weekly by
 *    cron).  Cache-Tag `discovery:potw` enables programmatic invalidation
 *    when the cron job recalculates the list, without touching other discovery
 *    caches.
 *
 *  - Recent native speakers / Spotlight: public short-lived cache.  These
 *    lists are fast-moving but benefit from a brief shared CDN TTL to absorb
 *    concurrent traffic from all users.  Tagged `discovery:public` so safety
 *    events (block/unblock/report) can purge shared discovery lists.
 *
 *  - Personalised search (partners, audio-intros, language-pair, location):
 *    browsers are told `private, max-age=0, must-revalidate` (never store),
 *    but Cloudflare may serve a short-lived stale copy from edge to reduce DB
 *    pressure.  Two edge tiers are provided:
 *      * Edge medium (120s TTL, 300s SWR): for normal-frequency queries
 *        (partners, audio-intros, language-pair, location).
 *      * Edge short (30s TTL, 30s SWR): for rapidly-changing data.
 *    `Vary: Authorization` partitions the Cloudflare cache by JWT token to
 *    prevent cross-user cache leakage.
 *
 *  - Each endpoint receives its own granular Cache-Tag (e.g.,
 *    `discovery:partners`, `discovery:audio-intros`) via the controller,
 *    enabling targeted invalidation without clearing unrelated caches.
 *
 *  - Mutation-style or error responses: `private, no-store` on both browser
 *    and CDN -- enforced by the interceptor on error.
 *
 * ## Cloudflare invalidation
 *
 * Cache-Tag headers are set on every response.  The DiscoveryService cron
 * job for Partner of the Week calls `CloudflareCacheService.purgeByCacheTags`
 * with `['discovery:potw']` to invalidate the old list across all Cloudflare
 * edge PoPs immediately after it is recomputed.
 *
 * Safety-cache-invalidation already targets Redis keys -- it does NOT need
 * to purge Cloudflare CDN tags because the edge cache TTLs are short and the
 * worst-case stale window is bounded by the SWR durations above.
 */

/** Used to partition Cloudflare's edge cache by auth token. */
const VARY_HEADER = { Vary: 'Authorization' } as const;

// ---------------------------------------------------------------------------
// Public directives (static / semi-static data shared across all users)
// ---------------------------------------------------------------------------

/** Partner of the Week -- refreshed weekly by cron. */
export const DISCOVERY_CACHE_PUBLIC_LONG = {
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=86400',
  'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
} as const;

/** Recent native speakers / Spotlight -- shared lists, short CDN TTL. */
export const DISCOVERY_CACHE_PUBLIC_SHORT = {
  'Cache-Control':
    'public, max-age=60, s-maxage=600, stale-while-revalidate=300, stale-if-error=3600',
  'CDN-Cache-Control': 'public, max-age=600, stale-while-revalidate=300',
} as const;

// ---------------------------------------------------------------------------
// Edge-only directives (user-specific data)
// ---------------------------------------------------------------------------

/**
 * Medium-lived edge cache for user-specific discovery reads.
 *
 * Used by: GET /discovery/partners, GET /discovery/audio-intros,
 *          GET /discovery/language-pair, GET /discovery/search-by-location
 *
 * Browsers: never cache (`private, max-age=0, must-revalidate`).
 * Cloudflare: 120s TTL + 300s SWR to absorb spikes from repeated page
 * navigations and filter changes, partitioned by JWT via `Vary: Authorization`.
 */
export const DISCOVERY_CACHE_EDGE_MEDIUM = {
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
  ...VARY_HEADER,
} as const;

/**
 * Short-lived edge cache for rapidly-changing user-specific data.
 *
 * Browsers: never cache. Cloudflare: 30s TTL + 30s SWR.
 * Used for highly dynamic user-specific discovery queries.
 */
export const DISCOVERY_CACHE_EDGE_SHORT = {
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
  ...VARY_HEADER,
} as const;

/**
 * No-store for mutations and dynamic data that must never be cached.
 */
export const DISCOVERY_CACHE_NO_STORE = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
} as const;

// ---------------------------------------------------------------------------
// Legacy alias (kept for backwards compatibility with existing usages)
// ---------------------------------------------------------------------------

/** @deprecated Use DISCOVERY_CACHE_EDGE_MEDIUM instead */
export const DISCOVERY_CACHE_PRIVATE_SHORT = DISCOVERY_CACHE_EDGE_MEDIUM;

// ---------------------------------------------------------------------------
// Cache-Tag constants for targeted Cloudflare edge invalidation
// ---------------------------------------------------------------------------

export const CACHE_TAG_DISCOVERY_PARTNERS = 'discovery:partners';
export const CACHE_TAG_DISCOVERY_POTW = 'discovery:potw';
export const CACHE_TAG_DISCOVERY_AUDIO_INTROS = 'discovery:audio-intros';
export const CACHE_TAG_DISCOVERY_RECENT_NATIVE =
  'discovery:recent-native-speakers';
export const CACHE_TAG_DISCOVERY_SPOTLIGHT = 'discovery:spotlight';
export const CACHE_TAG_DISCOVERY_LANGUAGE_PAIR = 'discovery:language-pair';
export const CACHE_TAG_DISCOVERY_LOCATION = 'discovery:location';
export const CACHE_TAG_DISCOVERY_PUBLIC = 'discovery:public';
export const CACHE_TAG_DISCOVERY_PRIVATE = 'discovery:private';

/** @deprecated Use CACHE_TAG_DISCOVERY_POTW instead */
export const DISCOVERY_CACHE_TAG_POTW = CACHE_TAG_DISCOVERY_POTW;
/** @deprecated Use CACHE_TAG_DISCOVERY_PUBLIC instead */
export const DISCOVERY_CACHE_TAG_PUBLIC = CACHE_TAG_DISCOVERY_PUBLIC;
/** @deprecated Use CACHE_TAG_DISCOVERY_PRIVATE instead */
export const DISCOVERY_CACHE_TAG_PRIVATE = CACHE_TAG_DISCOVERY_PRIVATE;

@Injectable()
export class DiscoveryCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly directive: Record<string, string>,
    private readonly cacheTags?: string[],
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    for (const [header, value] of Object.entries(this.directive)) {
      response.setHeader(header, value);
    }

    // Set Cache-Tag header for targeted Cloudflare purging.
    // Cloudflare aggregates multiple Cache-Tag values via comma-separated list.
    if (this.cacheTags && this.cacheTags.length > 0) {
      response.setHeader('Cache-Tag', this.cacheTags.join(','));
    }

    return next.handle().pipe(
      tap({
        error: () => {
          response.setHeader('Cache-Control', 'private, no-store');
          response.setHeader('CDN-Cache-Control', 'private, no-store');
          response.removeHeader('Cache-Tag');
        },
      }),
    );
  }
}

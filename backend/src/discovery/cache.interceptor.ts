import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs';
import { Response } from 'express';

/**
 * Cache-Control directives optimised for Cloudflare edge caching of the
 * Discovery / Matchmaking Algorithm endpoints.
 *
 * ## Strategy overview
 *
 * | Tier              | Cache-Control (browsers)  | CDN-Cache-Control (Cloudflare)             | Cache-Tag          |
 * |-------------------|---------------------------|--------------------------------------------|--------------------|
 * | Public long       | public, max-age=3600      | public, max-age=86400, SWR 1 week           | discovery:potw     |
 * | Public short      | public, max-age=60        | public, max-age=600, SWR 5 min              | discovery:public   |
 * | Edge-only short   | private, max-age=0        | public, max-age=120, SWR 2 min              | discovery:private  |
 * | No-store          | private, no-store         | private, no-store                           | (none)             |
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
 *    pressure.  `Vary: Authorization` partitions the Cloudflare cache by JWT
 *    token to prevent cross-user cache leakage.  Tagged `discovery:private`
 *    for targeted per-user invalidation.
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

/** Partner of the Week -- refreshed weekly, tagged for cron-driven purge. */
export const DISCOVERY_CACHE_PUBLIC_LONG = {
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=86400',
  'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  'Cache-Tag': 'discovery:potw',
} as const;

/** Recent native speakers / Spotlight -- shared lists, short CDN TTL. */
export const DISCOVERY_CACHE_PUBLIC_SHORT = {
  'Cache-Control':
    'public, max-age=60, s-maxage=600, stale-while-revalidate=300, stale-if-error=3600',
  'CDN-Cache-Control': 'public, max-age=600, stale-while-revalidate=300',
  'Cache-Tag': 'discovery:public',
} as const;

// ---------------------------------------------------------------------------
// Edge-only directives (user-specific data)
// ---------------------------------------------------------------------------

/**
 * Personalised discovery endpoints: partners, audio-intros, language-pair,
 * location-based search.
 *
 * Browsers: never cache (`private, max-age=0, must-revalidate`).
 * Cloudflare: short edge cache (120 s + 120 s SWR) partitioned by JWT via
 * `Vary: Authorization` to prevent cross-user leakage.
 */
export const DISCOVERY_CACHE_EDGE_SHORT = {
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'public, max-age=120, stale-while-revalidate=120',
  'Cache-Tag': 'discovery:private',
  ...VARY_HEADER,
} as const;

/**
 * No-store for error responses -- never persisted by browser or CDN.
 */
export const DISCOVERY_CACHE_NO_STORE = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
} as const;

// ---------------------------------------------------------------------------
// Legacy alias (kept for backwards compatibility with existing usages)
// ---------------------------------------------------------------------------

/** @deprecated Use DISCOVERY_CACHE_EDGE_SHORT instead */
export const DISCOVERY_CACHE_PRIVATE_SHORT = DISCOVERY_CACHE_EDGE_SHORT;

/**
 * Cache-Tag constants for programmatic Cloudflare edge invalidation.
 * These mirror the tags set by the cache directive constants above.
 */
export const DISCOVERY_CACHE_TAG_POTW = 'discovery:potw';
export const DISCOVERY_CACHE_TAG_PUBLIC = 'discovery:public';
export const DISCOVERY_CACHE_TAG_PRIVATE = 'discovery:private';

@Injectable()
export class DiscoveryCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DiscoveryCacheInterceptor.name);

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
      catchError((err) => {
        // Guard against ERR_HTTP_HEADERS_SENT: only mutate cache headers
        // if the response hasn't already started streaming to the client.
        if (!response.headersSent) {
          response.setHeader('Cache-Control', 'private, no-store');
          response.setHeader('CDN-Cache-Control', 'private, no-store');
          response.removeHeader('Cache-Tag');
        } else {
          this.logger.warn(
            'Cannot set error cache headers - response headers already sent; client may cache a partial error body.',
          );
        }
        throw err;
      }),
    );
  }
}

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
 * | Edge medium       | private, no-store         | private, no-store                          | (none)                |
 * | Edge short        | private, no-store         | private, no-store                          | (none)                |
 * | No-store          | private, no-store         | private, no-store                          | (none)                |
 *
 * ## Key design decisions
 *
 *  - Partner of the Week: weekly Redis ranking with no HTTP caching. The ID
 *    list is revalidated against current privacy/deletion state on each read,
 *    so an intermediary must not retain a user after that state changes.
 *
 *  - Recent native speakers / Spotlight: these endpoints exclude the
 *    requester and blocked profiles. They are not HTTP cached because a
 *    privacy, block, or deletion transition must take effect immediately.
 *
 *  - Personalised search (partners, audio-intros, language-pair, location):
 *    browsers and intermediaries are both told `private, no-store`. Cache
 *    partitioning alone is insufficient because privacy/deletion transitions
 *    do not synchronously purge every edge response.
 *
 *  - Mutation-style or error responses: `private, no-store` on both browser
 *    and CDN -- enforced by the interceptor on error.
 *
 * ## Cloudflare invalidation
 *
 * Cache-Tag headers are retained only for legacy callers that explicitly pass
 * tags to this interceptor. Current authenticated user-returning discovery
 * responses use `private, no-store`, pass no tags, and do not rely on edge
 * invalidation for privacy correctness. Error responses also remove any tag.
 */

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
 * Legacy user-specific discovery directive.
 *
 * Used by: GET /discovery/partners, GET /discovery/audio-intros,
 *          GET /discovery/recent-native-speakers, GET /discovery/spotlight,
 *          GET /discovery/language-pair, GET /discovery/search-by-location
 *
 * Kept for compatibility, but intentionally no-store at both browser and CDN
 * layers so hidden or deletion-scheduled profiles cannot remain visible.
 */
export const DISCOVERY_CACHE_EDGE_MEDIUM = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
} as const;

/**
 * Legacy short-lived directive, also fail-closed to no-store.
 */
export const DISCOVERY_CACHE_EDGE_SHORT = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
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

/** @deprecated Use DISCOVERY_CACHE_NO_STORE instead */
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

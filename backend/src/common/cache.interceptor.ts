import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs';
import { Request, Response } from 'express';

/**
 * Cache-Control directives optimised for Cloudflare edge caching.
 *
 * ## Strategy overview
 *
 * | Tier        | Cache-Control (browsers)  | CDN-Cache-Control (Cloudflare edge)         |
 * |-------------|---------------------------|---------------------------------------------|
 * | Public long | public, max-age=3600      | public, max-age=86400, SWR 1 week           |
 * | Public short| public, max-age=300       | public, max-age=1800, SWR 10 min            |
 * | Edge-only   | private, max-age=0        | public, max-age=300, SWR 2 min (medium)     |
 * | Edge-only   | private, max-age=0        | public, max-age=60, SWR 1 min (short)       |
 * | No-store    | private, no-store         | private, no-store                           |
 *
 * ## Key design decisions for SRS endpoints
 *
 * SRS flashcard and deck GET endpoints are user-specific.  Browsers should
 * revalidate on every navigation (`private, max-age=0, must-revalidate`)
 * but Cloudflare may serve a short-lived stale copy from edge to reduce
 * database pressure on the origin.
 *
 * `Vary: Authorization` is set on every response to prevent Cloudflare
 * from serving one user's cached response to another user.  As a second,
 * fail-closed boundary, public directives are automatically downgraded to
 * `private, no-store` whenever the incoming request carries an Authorization
 * header. This prevents accidental edge caching if a user-specific endpoint
 * is ever wired to a public cache constant (for example the sticker store,
 * which includes ownership and coin-balance state).
 */

/** Used to partition Cloudflare's edge cache by auth token. */
const VARY_HEADER = { Vary: 'Authorization' } as const;

// ---------------------------------------------------------------------------
// Public directives (static / semi-static data shared across all users)
// ---------------------------------------------------------------------------

/** Gift catalog, coin packages -- rarely changes. */
export const CACHE_PUBLIC_LONG = {
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=86400',
  'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  ...VARY_HEADER,
} as const;

/** Sticker pack storefront -- changes occasionally, short TTL. */
export const CACHE_PUBLIC_SHORT = {
  'Cache-Control':
    'public, max-age=300, s-maxage=1800, stale-while-revalidate=600, stale-if-error=3600',
  'CDN-Cache-Control': 'public, max-age=1800, stale-while-revalidate=600',
  ...VARY_HEADER,
} as const;

// ---------------------------------------------------------------------------
// Edge-only directives (user-specific data)
// ---------------------------------------------------------------------------

/**
 * Medium-lived edge cache for user-specific reads.
 *
 * Browsers are told to never cache (`private, max-age=0, must-revalidate`).
 * Cloudflare edge may serve a stale copy for up to 5 minutes (SWR 2 min)
 * to absorb spikes from repeated page navigations.
 *
 * Used by: GET /flashcards, GET /decks, GET /decks/:id, GET /decks/:id/flashcards
 */
export const CACHE_EDGE_MEDIUM = {
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'public, max-age=300, stale-while-revalidate=120',
  ...VARY_HEADER,
} as const;

/**
 * Short-lived edge cache for user-specific reads that change more frequently.
 *
 * Used by: GET /flashcards/due, GET /flashcards/suggest
 */
export const CACHE_EDGE_SHORT = {
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'public, max-age=60, stale-while-revalidate=60',
  ...VARY_HEADER,
} as const;

/**
 * Very short-lived edge cache for rapidly-changing user data.
 *
 * Browsers: never cache. Cloudflare edge: 30s max with 15s SWR.
 * Used for GET /flashcards/due to reduce DB pressure during active
 * review sessions while maintaining acceptable freshness.
 */
export const CACHE_EDGE_VERY_SHORT = {
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'public, max-age=30, stale-while-revalidate=15',
  ...VARY_HEADER,
} as const;

/**
 * No-store for mutations and dynamic data that must never be cached.
 *
 * Used by: all mutation endpoints (POST, PATCH, DELETE)
 */
export const CACHE_NO_STORE = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
} as const;

// ---------------------------------------------------------------------------
// Public very-short-lived (highly dynamic data shared across all users)
// ---------------------------------------------------------------------------

/**
 * Live room listings, active stage info -- changes every few seconds.
 *
 * Browsers: 30s cache. CDN: 60s cache with 60s SWR.
 * Used by: GET /audio-rooms/list, GET /audio-rooms/by-language,
 *          GET /audio-rooms/:id, GET /audio-rooms/:id/stage
 */
export const CACHE_PUBLIC_VERY_SHORT = {
  'Cache-Control':
    'public, max-age=30, s-maxage=60, stale-while-revalidate=60, stale-if-error=300',
  'CDN-Cache-Control': 'public, max-age=60, stale-while-revalidate=60',
} as const;

// ---------------------------------------------------------------------------
// Cache-Tag constants for targeted Cloudflare edge invalidation
// ---------------------------------------------------------------------------

export const CACHE_TAG_FLASHCARDS = 'flashcards';
export const CACHE_TAG_DUE_REVIEWS = 'flashcards:due';
export const CACHE_TAG_DECKS = 'decks';
export const CACHE_TAG_SUGGESTIONS = 'flashcards:suggest';
export const CACHE_TAG_AUDIO_ROOMS = 'audio-rooms';
export const CACHE_TAG_AUDIO_ROOM_STAGE = 'audio-rooms:stage';
export const CACHE_TAG_AUDIO_ROOM_POLLS = 'audio-rooms:polls';
export const CACHE_TAG_AUDIO_ROOM_TRANSCRIPT = 'audio-rooms:transcript';
export const CACHE_TAG_AUDIO_ROOM_NOTES = 'audio-rooms:notes';
export const CACHE_TAG_CALLS = 'calls';
export const CACHE_TAG_ESCROW = 'escrow';

// ---------------------------------------------------------------------------
// Legacy aliases (kept for backwards compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use CACHE_EDGE_SHORT instead */
export const CACHE_PRIVATE_SHORT = CACHE_EDGE_SHORT;
/** @deprecated Use CACHE_EDGE_MEDIUM instead */
export const CACHE_PRIVATE_MEDIUM = CACHE_EDGE_MEDIUM;
/** @deprecated Use CACHE_NO_STORE instead */
export const CACHE_PRIVATE_NO_STORE = CACHE_NO_STORE;

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(
    private readonly directive: Record<string, string>,
    private readonly cacheTags?: string[],
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const hasAuthorization =
      typeof request?.headers?.authorization === 'string' &&
      request.headers.authorization.trim().length > 0;
    const isPublicDirective =
      this.directive['Cache-Control']?.includes('public') === true ||
      this.directive['CDN-Cache-Control']?.includes('public') === true;
    const effectiveDirective =
      hasAuthorization && isPublicDirective ? CACHE_NO_STORE : this.directive;

    for (const [header, value] of Object.entries(effectiveDirective)) {
      response.setHeader(header, value);
    }

    // Cache tags are useful only for cacheable responses. Never attach them
    // after an authenticated public directive has been downgraded to no-store.
    if (
      effectiveDirective !== CACHE_NO_STORE &&
      this.cacheTags &&
      this.cacheTags.length > 0
    ) {
      response.setHeader('Cache-Tag', this.cacheTags.join(','));
    }

    return next.handle().pipe(
      tap({
        error: () => {
          // On error, override caching headers to prevent storing broken responses
          response.setHeader('Cache-Control', 'private, no-store');
          response.setHeader('CDN-Cache-Control', 'private, no-store');
          // Remove Cache-Tag on error so broken response is not tagged
          response.removeHeader('Cache-Tag');
        },
      }),
    );
  }
}
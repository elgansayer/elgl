<<<<<<< HEAD
<<<<<<<< HEAD:backend/src/common/cache.interceptor.ts
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
 * Cache-Control constants optimised for Cloudflare edge caching.
 *
 * Strategy:
 *  - Gift catalog & coin packages:         long-lived public CDN cache
 *  - User-specific read endpoints:         private, short browser cache, no CDN
 *  - Balance / mutations / escrow actions: private, no-store
 */
=======
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
 * from serving one user's cached response to another user.  Cloudflare
 * respects Vary headers and will partition the cache by the Authorization
 * header value (JWT token).
 */

/** Used to partition Cloudflare's edge cache by auth token. */
const VARY_HEADER = { Vary: 'Authorization' } as const;

// ---------------------------------------------------------------------------
// Public directives (static / semi-static data shared across all users)
// ---------------------------------------------------------------------------

/** Gift catalog, coin packages -- rarely changes. */
>>>>>>> origin/main
export const CACHE_PUBLIC_LONG = {
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=86400',
  'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
<<<<<<< HEAD
} as const;

=======
  ...VARY_HEADER,
} as const;

/** Sticker pack storefront -- changes occasionally, short TTL. */
>>>>>>> origin/main
export const CACHE_PUBLIC_SHORT = {
  'Cache-Control':
    'public, max-age=300, s-maxage=1800, stale-while-revalidate=600, stale-if-error=3600',
  'CDN-Cache-Control': 'public, max-age=1800, stale-while-revalidate=600',
<<<<<<< HEAD
} as const;

/**
 * Private short-lived cache for user-specific read endpoints (e.g. escrow GET).
 * Browsers may cache for 60 seconds but CDN edge nodes MUST NOT store the
 * response because it contains private financial data.
 */
export const CACHE_PRIVATE_SHORT = {
  'Cache-Control':
    'private, max-age=60, s-maxage=0, stale-while-revalidate=0, stale-if-error=0',
  'CDN-Cache-Control': 'private, no-store',
} as const;

export const CACHE_PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'CDN-Cache-Control': 'private, no-store',
} as const;
=======
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
 * No-store for mutations and dynamic data that must never be cached.
 *
 * Used by: all mutation endpoints (POST, PATCH, DELETE)
 */
export const CACHE_NO_STORE = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
} as const;

// ---------------------------------------------------------------------------
// Legacy aliases (kept for backwards compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use CACHE_EDGE_SHORT instead */
export const CACHE_PRIVATE_SHORT = CACHE_EDGE_SHORT;
/** @deprecated Use CACHE_EDGE_MEDIUM instead */
export const CACHE_PRIVATE_MEDIUM = CACHE_EDGE_MEDIUM;
/** @deprecated Use CACHE_NO_STORE instead */
export const CACHE_PRIVATE_NO_STORE = CACHE_NO_STORE;
>>>>>>> origin/main

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly directive: Record<string, string>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    for (const [header, value] of Object.entries(this.directive)) {
      response.setHeader(header, value);
    }

    return next.handle().pipe(
      tap({
        error: () => {
          // On error, override caching headers to prevent storing broken responses
          response.setHeader('Cache-Control', 'private, no-store');
          response.setHeader('CDN-Cache-Control', 'private, no-store');
        },
      }),
    );
  }
}
<<<<<<< HEAD
========
// Re-exported from common for backwards compatibility
export {
  CACHE_PUBLIC_LONG,
  CACHE_PUBLIC_SHORT,
  CACHE_NO_STORE,
  CACHE_PRIVATE_NO_STORE,
  CACHE_PRIVATE_MEDIUM,
  CACHE_PRIVATE_SHORT,
  CACHE_EDGE_MEDIUM,
  CACHE_EDGE_SHORT,
  CacheControlInterceptor,
} from '../common/cache.interceptor';
>>>>>>>> origin/main:backend/src/economy/cache.interceptor.ts
=======
>>>>>>> origin/main

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
 * Cache-Control constants optimised for Cloudflare edge caching of the
 * Discovery / Matchmaking Algorithm endpoints.
 *
 * Strategy:
 *  - Partner of the Week:        public long-lived CDN cache (refreshed weekly by cron).
 *  - Recent native speakers /    public short-lived cache -- these lists are fast-moving
 *    Spotlight:                  but benefit from a brief shared CDN TTL to absorb
 *                                concurrent traffic from all users.
 *  - Personalised search         private short cache to relieve DB pressure while keeping
 *    (partners, audio-intros,    results fresh enough for user-specific filters.  These
 *    language-pair, location):   endpoints return different results per authenticated user
 *                                so they must never be stored in a shared CDN cache.
 *  - Mutation-style or           never cached (not applicable to discovery GET routes but
 *    error responses:            enforced by the interceptor on error).
 */
export const DISCOVERY_CACHE_PUBLIC_LONG = {
  'Cache-Control':
    'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=86400',
  'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
} as const;

export const DISCOVERY_CACHE_PUBLIC_SHORT = {
  'Cache-Control':
    'public, max-age=60, s-maxage=600, stale-while-revalidate=300, stale-if-error=3600',
  'CDN-Cache-Control': 'public, max-age=600, stale-while-revalidate=300',
} as const;

export const DISCOVERY_CACHE_PRIVATE_SHORT = {
  'Cache-Control':
    'private, max-age=30, s-maxage=120, stale-while-revalidate=300, stale-if-error=600',
  'CDN-Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
} as const;

export const DISCOVERY_CACHE_PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'CDN-Cache-Control': 'private, no-store',
} as const;

@Injectable()
export class DiscoveryCacheInterceptor implements NestInterceptor {
  constructor(private readonly directive: Record<string, string>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    for (const [header, value] of Object.entries(this.directive)) {
      response.setHeader(header, value);
    }

    return next.handle().pipe(
      tap({
        error: () => {
          response.setHeader('Cache-Control', 'private, no-store');
          response.setHeader('CDN-Cache-Control', 'private, no-store');
        },
      }),
    );
  }
}
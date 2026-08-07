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
 * Virtual Coin Economy's static and semi-static data.
 *
 * Strategy:
 *  - Gift catalog & coin packages:         long-lived public CDN cache
 *  - User-specific sticker pack ownership: private, no-store
 *  - Balance / mutations:                  no-store (dynamic)
 */
export const CACHE_PUBLIC_LONG = {
  'Cache-Control':
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=86400',
  'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
} as const;

export const CACHE_PUBLIC_SHORT = {
  'Cache-Control':
    'public, max-age=300, s-maxage=1800, stale-while-revalidate=600, stale-if-error=3600',
  'CDN-Cache-Control': 'public, max-age=1800, stale-while-revalidate=600',
} as const;

export const CACHE_PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'CDN-Cache-Control': 'private, no-store',
} as const;

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

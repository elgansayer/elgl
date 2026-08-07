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
 * Cloudflare edge-caching constants optimised for Stripe Escrow Payments.
 *
 * Strategy:
 *  - Escrow agreement details (read-only, long-lived):  public CDN cache with
 *    stale-while-revalidate so Cloudflare serves stale content while
 *    revalidating asynchronously.
 *  - Escrow status / balance (semi-static, user-specific): private short
 *    cache to reduce DB pressure while keeping freshness for funds state.
 *  - Mutations (create, capture, release, dispute): never cached.
 *  - Webhook endpoints from Stripe: never cached.
 */
export const ESCROW_CACHE_PUBLIC_LONG = {
  'Cache-Control':
    'public, max-age=600, s-maxage=7200, stale-while-revalidate=86400, stale-if-error=86400',
  'CDN-Cache-Control': 'public, max-age=7200, stale-while-revalidate=86400',
} as const;

export const ESCROW_CACHE_PRIVATE_SHORT = {
  'Cache-Control':
    'private, max-age=60, s-maxage=120, stale-while-revalidate=300, stale-if-error=600',
  'CDN-Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
} as const;

export const ESCROW_CACHE_PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  'CDN-Cache-Control': 'private, no-store',
} as const;

@Injectable()
export class EscrowCacheInterceptor implements NestInterceptor {
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
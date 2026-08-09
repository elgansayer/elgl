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
 * Cloudflare edge-caching constants optimised for Escrow Payments.
 *
 * Strategy:
 *  - Read endpoints (list, get): private short-lived CDN cache with
 *    Vary: Authorization to prevent cross-user cache leakage.
 *  - Mutation endpoints (create, release, refund): no-store.
 */
export const ESCROW_CACHE_PUBLIC_LONG = {
  'Cache-Control':
    'public, max-age=600, s-maxage=7200, stale-while-revalidate=86400, stale-if-error=86400',
  'CDN-Cache-Control': 'public, max-age=7200, stale-while-revalidate=86400',
  'Cache-Tag': 'escrow-agreements-v1',
} as const;

export const ESCROW_CACHE_PRIVATE_SHORT = {
  'Cache-Control':
    'private, max-age=60, s-maxage=120, stale-while-revalidate=300, stale-if-error=600',
  'CDN-Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
  Vary: 'Authorization, Accept-Encoding',
  'Cache-Tag': 'escrow-transactions-v1',
} as const;

export const ESCROW_CACHE_PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
  Vary: 'Authorization',
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
          response.setHeader('Vary', 'Authorization');
          if (typeof response.removeHeader === 'function') {
            response.removeHeader('Cache-Tag');
          }
        },
      }),
    );
  }
}

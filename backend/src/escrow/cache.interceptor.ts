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
 * Cloudflare edge-caching directives optimised for Escrow Payments.
 *
 * Strategy:
 *  - Escrow reads (list, get by ID): user-specific data, never cached at the
 *    CDN edge. Browsers must revalidate on every request via max-age=0,
 *    must-revalidate. Cloudflare CDN is instructed not to store via
 *    CDN-Cache-Control: private, no-store.
 *  - Escrow mutations (create, release, refund): never cached anywhere.
 *
 * Every response includes Vary: Authorization so that intermediaries
 * (Cloudflare, proxy layers) never serve a cached response across
 * different authenticated users.
 */
export const ESCROW_CACHE_PRIVATE_SHORT = {
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'private, no-store',
  'Vary': 'Authorization',
=======
 * Cloudflare edge-caching constants optimised for Escrow Payments.
 *
 * Strategy:
 *  - Read endpoints (list, get): private short-lived CDN cache with
 *    Vary: Authorization to prevent cross-user cache leakage.
 *    stale-while-revalidate=300 allows Cloudflare to serve stale
 *    while asynchronously refreshing, reducing DB load during bursts.
 *  - Mutation endpoints (create, release, refund): no-store.
 *  - Cloudflare-CDN-Cache-Control is used to set distinct CDN
 *    behaviour (different from browser Cache-Control).
 *  - Cache-Tag: escrow-v1 allows programmatic invalidation via
 *    Cloudflare API should batch invalidations be needed.
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
  'Vary': 'Authorization, Accept-Encoding',
  'Cache-Tag': 'escrow-transactions-v1',
>>>>>>> origin/main
} as const;

export const ESCROW_CACHE_PRIVATE_NO_STORE = {
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'private, no-store',
  'Vary': 'Authorization',
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
<<<<<<< HEAD
          response.setHeader('Vary', 'Authorization');
=======
          response.removeHeader('Cache-Tag');
>>>>>>> origin/main
        },
      }),
    );
  }
}
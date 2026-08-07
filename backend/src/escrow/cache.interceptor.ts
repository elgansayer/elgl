import { Injectable } from '@nestjs/common';
import {
  CacheControlInterceptor,
  CACHE_EDGE_MEDIUM,
  CACHE_NO_STORE,
  CACHE_TAG_ESCROW,
} from '../common/cache.interceptor';

/**
<<<<<<< HEAD
 * Re-export common cache directives for Escrow Payments.
=======
 * Cloudflare edge-caching directives optimised for Escrow Payments.
>>>>>>> origin/main
 *
 * Escrow endpoints now use the standard CacheControlInterceptor from
 * ../common/cache.interceptor.ts to avoid duplication. These legacy
 * exports remain for backwards compatibility with any code that
 * imported them directly.
 *
 * @deprecated Use CacheControlInterceptor and exported cache constants
 *   from ../common/cache.interceptor.ts instead.
 */
<<<<<<< HEAD
export const ESCROW_CACHE_READ = CACHE_EDGE_MEDIUM;
export const ESCROW_CACHE_MUTATION = CACHE_NO_STORE;
export { CACHE_TAG_ESCROW };

/**
 * @deprecated Use CacheControlInterceptor from ../common/cache.interceptor.ts
 */
@Injectable()
export class EscrowCacheInterceptor extends CacheControlInterceptor {
  constructor(
    directive: Record<string, string>,
    cacheTags?: string[],
  ) {
    super(directive, cacheTags);
=======
export const ESCROW_CACHE_PRIVATE_SHORT = {
  'Cache-Control': 'private, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'private, no-store',
  'Vary': 'Authorization',
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
          response.setHeader('Vary', 'Authorization');
        },
      }),
    );
>>>>>>> origin/main
  }
}
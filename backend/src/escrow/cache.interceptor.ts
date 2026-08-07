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
  }
}
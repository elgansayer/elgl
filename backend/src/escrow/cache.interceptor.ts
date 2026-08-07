import { Injectable } from '@nestjs/common';
import {
  CacheControlInterceptor,
  CACHE_EDGE_MEDIUM,
  CACHE_NO_STORE,
  CACHE_TAG_ESCROW,
} from '../common/cache.interceptor';

/**
 * Re-export common cache directives for Escrow Payments.
 *
 * Escrow endpoints now use the standard CacheControlInterceptor from
 * ../common/cache.interceptor.ts to avoid duplication. These legacy
 * exports remain for backwards compatibility with any code that
 * imported them directly.
 *
 * @deprecated Use CacheControlInterceptor and exported cache constants
 *   from ../common/cache.interceptor.ts instead.
 */
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
  }
}
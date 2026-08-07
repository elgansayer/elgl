import { lastValueFrom, of, throwError } from 'rxjs';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_LONG,
  CACHE_PUBLIC_SHORT,
  CACHE_PRIVATE_SHORT,
  CACHE_PRIVATE_MEDIUM,
  CACHE_PRIVATE_NO_STORE,
} from './cache.interceptor';

describe('CacheControlInterceptor', () => {
  describe('cache directive constants', () => {
    it('CACHE_PUBLIC_LONG should have public CDN cache with long max-age', () => {
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain('max-age=3600');
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain('s-maxage=86400');
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain(
        'stale-while-revalidate=604800',
      );
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain(
        'stale-if-error=86400',
      );
      expect(CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain('max-age=86400');
      expect(CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=604800',
      );
    });

    it('CACHE_PUBLIC_SHORT should have public CDN cache with shorter max-age', () => {
      expect(CACHE_PUBLIC_SHORT['Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_SHORT['Cache-Control']).toContain('max-age=300');
      expect(CACHE_PUBLIC_SHORT['Cache-Control']).toContain('s-maxage=1800');
      expect(CACHE_PUBLIC_SHORT['CDN-Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_SHORT['CDN-Cache-Control']).toContain('max-age=1800');
      expect(CACHE_PUBLIC_SHORT['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=600',
      );
    });

    it('CACHE_PRIVATE_SHORT should have private CDN cache with short max-age', () => {
      expect(CACHE_PRIVATE_SHORT['Cache-Control']).toContain('private');
      expect(CACHE_PRIVATE_SHORT['Cache-Control']).toContain('max-age=300');
      expect(CACHE_PRIVATE_SHORT['Cache-Control']).toContain('s-maxage=1800');
      expect(CACHE_PRIVATE_SHORT['CDN-Cache-Control']).toContain('private');
      expect(CACHE_PRIVATE_SHORT['CDN-Cache-Control']).toContain('max-age=1800');
      expect(CACHE_PRIVATE_SHORT['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=600',
      );
    });

    it('CACHE_PRIVATE_MEDIUM should have private CDN cache with medium max-age', () => {
      expect(CACHE_PRIVATE_MEDIUM['Cache-Control']).toContain('private');
      expect(CACHE_PRIVATE_MEDIUM['Cache-Control']).toContain('max-age=60');
      expect(CACHE_PRIVATE_MEDIUM['Cache-Control']).toContain('s-maxage=300');
      expect(CACHE_PRIVATE_MEDIUM['CDN-Cache-Control']).toContain('private');
      expect(CACHE_PRIVATE_MEDIUM['CDN-Cache-Control']).toContain('max-age=300');
      expect(CACHE_PRIVATE_MEDIUM['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=120',
      );
    });

    it('CACHE_PRIVATE_NO_STORE should prohibit all caching', () => {
      expect(CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('private');
      expect(CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('no-store');
      expect(CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('no-cache');
      expect(CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain(
        'must-revalidate',
      );
      expect(CACHE_PRIVATE_NO_STORE['CDN-Cache-Control']).toBe(
        'private, no-store',
      );
    });
  });

  describe('intercept', () => {
    function createCallContext(
      setHeader = jest.fn(),
    ): Parameters<typeof CacheControlInterceptor.prototype.intercept>[0] {
      const mockResponse = { setHeader };
      return {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<
        typeof CacheControlInterceptor.prototype.intercept
      >[0];
    }

    it('should set all directive headers on success', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new CacheControlInterceptor(CACHE_PUBLIC_LONG);
      const next = { handle: () => of('body') } as Parameters<
        typeof interceptor.intercept
      >[1];

      const result = await lastValueFrom(interceptor.intercept(context, next));
      expect(result).toBe('body');
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        CACHE_PUBLIC_LONG['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        CACHE_PUBLIC_LONG['CDN-Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledTimes(2);
    });

    it('should override to no-store on error', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new CacheControlInterceptor(CACHE_PUBLIC_LONG);
      const next = {
        handle: () => throwError(() => new Error('db error')),
      } as Parameters<typeof interceptor.intercept>[1];

      const result$ = interceptor.intercept(context, next);
      await expect(lastValueFrom(result$)).rejects.toThrow('db error');

      // On error, both calls to setHeader should be no-store
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-store',
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        'private, no-store',
      );
    });

    it('should handle CACHE_PRIVATE_NO_STORE directive', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE);
      const next = { handle: () => of('mutation-result') } as Parameters<
        typeof interceptor.intercept
      >[1];

      await lastValueFrom(interceptor.intercept(context, next));
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        CACHE_PRIVATE_NO_STORE['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        CACHE_PRIVATE_NO_STORE['CDN-Cache-Control'],
      );
    });

    it('should handle CACHE_PRIVATE_MEDIUM directive for reading engine user lists', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new CacheControlInterceptor(CACHE_PRIVATE_MEDIUM);
      const next = { handle: () => of([]) } as Parameters<
        typeof interceptor.intercept
      >[1];

      await lastValueFrom(interceptor.intercept(context, next));
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        CACHE_PRIVATE_MEDIUM['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        CACHE_PRIVATE_MEDIUM['CDN-Cache-Control'],
      );
    });
  });
});
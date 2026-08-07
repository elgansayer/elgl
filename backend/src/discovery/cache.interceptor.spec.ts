import { lastValueFrom, of, throwError } from 'rxjs';
import {
  DiscoveryCacheInterceptor,
  DISCOVERY_CACHE_PUBLIC_LONG,
  DISCOVERY_CACHE_PUBLIC_SHORT,
  DISCOVERY_CACHE_PRIVATE_SHORT,
  DISCOVERY_CACHE_PRIVATE_NO_STORE,
} from './cache.interceptor';

describe('DiscoveryCacheInterceptor', () => {
  describe('constructor and constants', () => {
    it('should export DISCOVERY_CACHE_PUBLIC_LONG with correct headers', () => {
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain('public');
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain('max-age=600');
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain('s-maxage=86400');
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain('stale-while-revalidate=604800');
      expect(DISCOVERY_CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain('public');
      expect(DISCOVERY_CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain('max-age=86400');
    });

    it('should export DISCOVERY_CACHE_PUBLIC_SHORT with correct headers', () => {
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Control']).toContain('public');
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Control']).toContain('max-age=60');
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['CDN-Cache-Control']).toContain('max-age=600');
    });

    it('should export DISCOVERY_CACHE_PRIVATE_SHORT with correct headers', () => {
      expect(DISCOVERY_CACHE_PRIVATE_SHORT['Cache-Control']).toContain('private');
      expect(DISCOVERY_CACHE_PRIVATE_SHORT['Cache-Control']).toContain('max-age=30');
      expect(DISCOVERY_CACHE_PRIVATE_SHORT['CDN-Cache-Control']).toContain('private');
    });

    it('should export DISCOVERY_CACHE_PRIVATE_NO_STORE with correct headers', () => {
      expect(DISCOVERY_CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('private');
      expect(DISCOVERY_CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('no-store');
      expect(DISCOVERY_CACHE_PRIVATE_NO_STORE['CDN-Cache-Control']).toContain(
        'private, no-store',
      );
    });
  });

  describe('intercept', () => {
    it('should set cache headers from the directive on a successful response', async () => {
      const interceptor = new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_LONG);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('partner-of-week-data'),
      } as Parameters<typeof interceptor.intercept>[1];

      const result$ = interceptor.intercept(context, next);
      const result = await lastValueFrom(result$);

      expect(result).toBe('partner-of-week-data');
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        DISCOVERY_CACHE_PUBLIC_LONG['CDN-Cache-Control'],
      );
    });

    it('should set DISCOVERY_CACHE_PUBLIC_SHORT headers for shared endpoints', async () => {
      const interceptor = new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_SHORT);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('spotlight-data'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        DISCOVERY_CACHE_PUBLIC_SHORT['CDN-Cache-Control'],
      );
    });

    it('should set DISCOVERY_CACHE_PRIVATE_SHORT headers for user-specific routes', async () => {
      const interceptor = new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('partner-search-results'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        DISCOVERY_CACHE_PRIVATE_SHORT['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        DISCOVERY_CACHE_PRIVATE_SHORT['CDN-Cache-Control'],
      );
    });

    it('should override cache headers to private/no-store on error', async () => {
      const interceptor = new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_LONG);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => throwError(() => new Error('db unavailable')),
      } as Parameters<typeof interceptor.intercept>[1];

      const result$ = interceptor.intercept(context, next);

      await expect(lastValueFrom(result$)).rejects.toThrow('db unavailable');

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-store',
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        'private, no-store',
      );
    });

    it('should handle a custom directive with arbitrary headers', async () => {
      const customDirective = {
        'X-Discovery-Trace': 'trace-001',
        'X-Cache-Strategy': 'discovery-experimental',
      };

      const interceptor = new DiscoveryCacheInterceptor(customDirective);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('ok'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith('X-Discovery-Trace', 'trace-001');
      expect(setHeader).toHaveBeenCalledWith(
        'X-Cache-Strategy',
        'discovery-experimental',
      );
    });
  });
});
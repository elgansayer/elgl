import { lastValueFrom, of, throwError } from 'rxjs';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_LONG,
  CACHE_PUBLIC_SHORT,
  CACHE_EDGE_MEDIUM,
  CACHE_EDGE_SHORT,
  CACHE_NO_STORE,
  CACHE_PRIVATE_NO_STORE,
  CACHE_PRIVATE_MEDIUM,
  CACHE_PRIVATE_SHORT,
} from '../common/cache.interceptor';

describe('CacheControlInterceptor', () => {
  describe('constants', () => {
    it('should export CACHE_PUBLIC_LONG with correct headers', () => {
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain('max-age=3600');
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain('s-maxage=86400');
      expect(CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_LONG['Vary']).toBe('Authorization');
    });

    it('should export CACHE_PUBLIC_SHORT with correct headers', () => {
      expect(CACHE_PUBLIC_SHORT['Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_SHORT['Cache-Control']).toContain('max-age=300');
      expect(CACHE_PUBLIC_SHORT['CDN-Cache-Control']).toContain('max-age=1800');
      expect(CACHE_PUBLIC_SHORT['Vary']).toBe('Authorization');
    });

    it('should export CACHE_NO_STORE with correct headers', () => {
      expect(CACHE_NO_STORE['Cache-Control']).toBe('private, no-store');
      expect(CACHE_NO_STORE['CDN-Cache-Control']).toBe('private, no-store');
    });

    it('should export CACHE_EDGE_MEDIUM with browser no-cache and edge public', () => {
      expect(CACHE_EDGE_MEDIUM['Cache-Control']).toContain('private');
      expect(CACHE_EDGE_MEDIUM['Cache-Control']).toContain('max-age=0');
      expect(CACHE_EDGE_MEDIUM['Cache-Control']).toContain('must-revalidate');
      expect(CACHE_EDGE_MEDIUM['CDN-Cache-Control']).toContain('public');
      expect(CACHE_EDGE_MEDIUM['CDN-Cache-Control']).toContain('max-age=300');
      expect(CACHE_EDGE_MEDIUM['Vary']).toBe('Authorization');
    });

    it('should export CACHE_EDGE_SHORT with browser no-cache and edge public', () => {
      expect(CACHE_EDGE_SHORT['Cache-Control']).toContain('private');
      expect(CACHE_EDGE_SHORT['Cache-Control']).toContain('max-age=0');
      expect(CACHE_EDGE_SHORT['CDN-Cache-Control']).toContain('public');
      expect(CACHE_EDGE_SHORT['CDN-Cache-Control']).toContain('max-age=60');
      expect(CACHE_EDGE_SHORT['Vary']).toBe('Authorization');
    });

    it('should alias legacy CACHE_PRIVATE_NO_STORE to CACHE_NO_STORE', () => {
      expect(CACHE_PRIVATE_NO_STORE).toBe(CACHE_NO_STORE);
    });

    it('should alias legacy CACHE_PRIVATE_MEDIUM to CACHE_EDGE_MEDIUM', () => {
      expect(CACHE_PRIVATE_MEDIUM).toBe(CACHE_EDGE_MEDIUM);
    });

    it('should alias legacy CACHE_PRIVATE_SHORT to CACHE_EDGE_SHORT', () => {
      expect(CACHE_PRIVATE_SHORT).toBe(CACHE_EDGE_SHORT);
    });
  });

  describe('intercept', () => {
    it('should set cache headers from the directive on a successful response', async () => {
      const interceptor = new CacheControlInterceptor(CACHE_PUBLIC_LONG);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('response-body'),
      } as Parameters<typeof interceptor.intercept>[1];

      const result$ = interceptor.intercept(context, next);
      const result = await lastValueFrom(result$);

      expect(result).toBe('response-body');
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        CACHE_PUBLIC_LONG['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        CACHE_PUBLIC_LONG['CDN-Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith('Vary', 'Authorization');
    });

    it('should set CACHE_NO_STORE headers for mutation endpoints', async () => {
      const interceptor = new CacheControlInterceptor(CACHE_NO_STORE);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('private-data'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-store',
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        'private, no-store',
      );
    });

    it('should set CACHE_EDGE_MEDIUM headers for SRS deck reads', async () => {
      const interceptor = new CacheControlInterceptor(CACHE_EDGE_MEDIUM);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('deck-data'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, max-age=0, must-revalidate',
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        'public, max-age=300, stale-while-revalidate=120',
      );
      expect(setHeader).toHaveBeenCalledWith('Vary', 'Authorization');
    });

    it('should override cache headers to private/no-store on error', async () => {
      const interceptor = new CacheControlInterceptor(CACHE_PUBLIC_LONG);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => throwError(() => new Error('test error')),
      } as Parameters<typeof interceptor.intercept>[1];

      const result$ = interceptor.intercept(context, next);

      await expect(lastValueFrom(result$)).rejects.toThrow('test error');

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
        'X-Custom-Header': 'custom-value',
        'X-Another-Header': 'another-value',
      };

      const interceptor = new CacheControlInterceptor(customDirective);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('ok'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith('X-Custom-Header', 'custom-value');
      expect(setHeader).toHaveBeenCalledWith(
        'X-Another-Header',
        'another-value',
      );
    });
  });
});

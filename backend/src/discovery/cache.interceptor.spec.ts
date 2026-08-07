import { lastValueFrom, of, throwError } from 'rxjs';
import {
  DiscoveryCacheInterceptor,
  DISCOVERY_CACHE_PUBLIC_LONG,
  DISCOVERY_CACHE_PUBLIC_SHORT,
  DISCOVERY_CACHE_PRIVATE_SHORT,
  DISCOVERY_CACHE_EDGE_SHORT,
  DISCOVERY_CACHE_NO_STORE,
  DISCOVERY_CACHE_TAG_POTW,
  DISCOVERY_CACHE_TAG_PUBLIC,
  DISCOVERY_CACHE_TAG_PRIVATE,
} from './cache.interceptor';

describe('DiscoveryCacheInterceptor', () => {
  describe('cache directive constants', () => {
    it('DISCOVERY_CACHE_PUBLIC_LONG should have public CDN cache with potw tag', () => {
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain('public');
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain('max-age=3600');
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain('s-maxage=86400');
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain(
        'stale-while-revalidate=604800',
      );
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain(
        'stale-if-error=86400',
      );
      expect(DISCOVERY_CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain('public');
      expect(DISCOVERY_CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain(
        'max-age=86400',
      );
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Tag']).toBe('discovery:potw');
    });

    it('DISCOVERY_CACHE_PUBLIC_SHORT should have public CDN cache with public tag', () => {
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Control']).toContain('public');
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Control']).toContain('max-age=60');
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Control']).toContain('s-maxage=600');
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['CDN-Cache-Control']).toContain('public');
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['CDN-Cache-Control']).toContain(
        'max-age=600',
      );
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Tag']).toBe('discovery:public');
    });

    it('DISCOVERY_CACHE_EDGE_SHORT should partition by auth and tag private', () => {
      expect(DISCOVERY_CACHE_EDGE_SHORT['Cache-Control']).toContain('private');
      expect(DISCOVERY_CACHE_EDGE_SHORT['Cache-Control']).toContain('max-age=0');
      expect(DISCOVERY_CACHE_EDGE_SHORT['Cache-Control']).toContain(
        'must-revalidate',
      );
      // CDN side: public cache partitioned by Authorization header
      expect(DISCOVERY_CACHE_EDGE_SHORT['CDN-Cache-Control']).toContain('public');
      expect(DISCOVERY_CACHE_EDGE_SHORT['CDN-Cache-Control']).toContain(
        'max-age=120',
      );
      expect(DISCOVERY_CACHE_EDGE_SHORT['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=120',
      );
      expect(DISCOVERY_CACHE_EDGE_SHORT['Vary']).toBe('Authorization');
      expect(DISCOVERY_CACHE_EDGE_SHORT['Cache-Tag']).toBe('discovery:private');
    });

    it('DISCOVERY_CACHE_PRIVATE_SHORT should be an alias for EDGE_SHORT', () => {
      expect(DISCOVERY_CACHE_PRIVATE_SHORT).toBe(DISCOVERY_CACHE_EDGE_SHORT);
    });

    it('DISCOVERY_CACHE_NO_STORE should never cache', () => {
      expect(DISCOVERY_CACHE_NO_STORE['Cache-Control']).toBe('private, no-store');
      expect(DISCOVERY_CACHE_NO_STORE['CDN-Cache-Control']).toBe(
        'private, no-store',
      );
    });

    it('should export named Cache-Tag constants for programmatic invalidation', () => {
      expect(DISCOVERY_CACHE_TAG_POTW).toBe('discovery:potw');
      expect(DISCOVERY_CACHE_TAG_PUBLIC).toBe('discovery:public');
      expect(DISCOVERY_CACHE_TAG_PRIVATE).toBe('discovery:private');
    });
  });

  describe('intercept', () => {
    function createCallContext(
      setHeader = jest.fn(),
      removeHeader = jest.fn(),
    ): Parameters<typeof DiscoveryCacheInterceptor.prototype.intercept>[0] {
      const mockResponse = { setHeader, removeHeader };
      return {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<
        typeof DiscoveryCacheInterceptor.prototype.intercept
      >[0];
    }

    it('should set all directive headers on success', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_LONG);
      const next = {
        handle: () => of('potw-data'),
      } as Parameters<typeof interceptor.intercept>[1];

      const result = await lastValueFrom(interceptor.intercept(context, next));
      expect(result).toBe('potw-data');
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        DISCOVERY_CACHE_PUBLIC_LONG['CDN-Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Tag',
        'discovery:potw',
      );
    });

    it('should set EDGE_SHORT headers with Vary for user-specific routes', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new DiscoveryCacheInterceptor(DISCOVERY_CACHE_EDGE_SHORT);
      const next = {
        handle: () => of('partner-search-results'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        DISCOVERY_CACHE_EDGE_SHORT['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        DISCOVERY_CACHE_EDGE_SHORT['CDN-Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith('Vary', 'Authorization');
      expect(setHeader).toHaveBeenCalledWith('Cache-Tag', 'discovery:private');
    });

    it('should override to no-store on error and remove Cache-Tag', async () => {
      const setHeader = jest.fn();
      const removeHeader = jest.fn();
      const context = createCallContext(setHeader, removeHeader);
      const interceptor = new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_LONG);
      const next = {
        handle: () => throwError(() => new Error('db unavailable')),
      } as Parameters<typeof interceptor.intercept>[1];

      const result$ = interceptor.intercept(context, next);
      await expect(lastValueFrom(result$)).rejects.toThrow('db unavailable');

      // Error path: override caching headers and strip Cache-Tag
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-store',
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        'private, no-store',
      );
      expect(removeHeader).toHaveBeenCalledWith('Cache-Tag');
    });

    it('should handle additional cache tags from constructor', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new DiscoveryCacheInterceptor(
        DISCOVERY_CACHE_PUBLIC_SHORT,
        ['discovery:public', 'discovery:extra'],
      );
      const next = {
        handle: () => of('spotlight-data'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Tag',
        'discovery:public,discovery:extra',
      );
    });

    it('should set Cache-Tag from directive when no additional tags provided', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      // Use DISCOVERY_CACHE_PUBLIC_SHORT which has 'Cache-Tag' in the directive
      const interceptor = new DiscoveryCacheInterceptor(
        DISCOVERY_CACHE_PUBLIC_SHORT,
      );
      const next = {
        handle: () => of('spotlight-data'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      // The directive itself contains Cache-Tag, so it is set via the iteration
      expect(setHeader).toHaveBeenCalledWith('Cache-Tag', 'discovery:public');
    });

    it('should set Cache-Tag from directive when directive has none and no extra tags', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      // Use a directive that has NO built-in Cache-Tag
      const directiveWithoutTag = {
        'Cache-Control': 'public, max-age=60',
      };
      const interceptor = new DiscoveryCacheInterceptor(directiveWithoutTag);
      const next = {
        handle: () => of('data'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      const cacheTagCalls = (setHeader as jest.Mock).mock.calls.filter(
        (call: [string, string]) => call[0] === 'Cache-Tag',
      );
      expect(cacheTagCalls).toHaveLength(0);
    });

    it('should handle custom directive with arbitrary headers', async () => {
      const customDirective = {
        'X-Discovery-Trace': 'trace-001',
        'X-Cache-Strategy': 'discovery-experimental',
      };

      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new DiscoveryCacheInterceptor(customDirective);
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
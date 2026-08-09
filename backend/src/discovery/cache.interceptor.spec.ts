import { lastValueFrom, of, throwError } from 'rxjs';
import {
  DiscoveryCacheInterceptor,
  DISCOVERY_CACHE_PUBLIC_LONG,
  DISCOVERY_CACHE_PUBLIC_SHORT,
  DISCOVERY_CACHE_EDGE_MEDIUM,
  DISCOVERY_CACHE_EDGE_SHORT,
  DISCOVERY_CACHE_NO_STORE,
  DISCOVERY_CACHE_PRIVATE_SHORT,
  CACHE_TAG_DISCOVERY_PARTNERS,
  CACHE_TAG_DISCOVERY_POTW,
  CACHE_TAG_DISCOVERY_AUDIO_INTROS,
  DISCOVERY_CACHE_TAG_POTW,
  DISCOVERY_CACHE_TAG_PUBLIC,
  DISCOVERY_CACHE_TAG_PRIVATE,
} from './cache.interceptor';

describe('DiscoveryCacheInterceptor', () => {
  describe('cache directive constants', () => {
    it('DISCOVERY_CACHE_PUBLIC_LONG should have public CDN cache (no hardcoded tag)', () => {
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain('public');
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain(
        'max-age=3600',
      );
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain(
        's-maxage=86400',
      );
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain(
        'stale-while-revalidate=604800',
      );
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Control']).toContain(
        'stale-if-error=86400',
      );
      expect(DISCOVERY_CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain(
        'public',
      );
      expect(DISCOVERY_CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain(
        'max-age=86400',
      );
      // Cache-Tag is NOT hardcoded in directives; it is set via cacheTags param
      expect(DISCOVERY_CACHE_PUBLIC_LONG['Cache-Tag']).toBeUndefined();
    });

    it('DISCOVERY_CACHE_PUBLIC_SHORT should have public CDN cache (no hardcoded tag)', () => {
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Control']).toContain('public');
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Control']).toContain(
        'max-age=60',
      );
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Control']).toContain(
        's-maxage=600',
      );
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['CDN-Cache-Control']).toContain(
        'public',
      );
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['CDN-Cache-Control']).toContain(
        'max-age=600',
      );
      expect(DISCOVERY_CACHE_PUBLIC_SHORT['Cache-Tag']).toBeUndefined();
    });

    it('DISCOVERY_CACHE_EDGE_MEDIUM should have browser-private/CDN-public with Vary', () => {
      expect(DISCOVERY_CACHE_EDGE_MEDIUM['Cache-Control']).toContain('private');
      expect(DISCOVERY_CACHE_EDGE_MEDIUM['Cache-Control']).toContain(
        'max-age=0',
      );
      expect(DISCOVERY_CACHE_EDGE_MEDIUM['Cache-Control']).toContain(
        'must-revalidate',
      );
      expect(DISCOVERY_CACHE_EDGE_MEDIUM['CDN-Cache-Control']).toContain(
        'public',
      );
      expect(DISCOVERY_CACHE_EDGE_MEDIUM['CDN-Cache-Control']).toContain(
        'max-age=120',
      );
      expect(DISCOVERY_CACHE_EDGE_MEDIUM['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=300',
      );
      expect(DISCOVERY_CACHE_EDGE_MEDIUM['Vary']).toBe('Authorization');
      expect(DISCOVERY_CACHE_EDGE_MEDIUM['Cache-Tag']).toBeUndefined();
    });

    it('DISCOVERY_CACHE_EDGE_SHORT should have browser-private/CDN-short with Vary', () => {
      expect(DISCOVERY_CACHE_EDGE_SHORT['Cache-Control']).toContain('private');
      expect(DISCOVERY_CACHE_EDGE_SHORT['Cache-Control']).toContain(
        'max-age=0',
      );
      expect(DISCOVERY_CACHE_EDGE_SHORT['Cache-Control']).toContain(
        'must-revalidate',
      );
      expect(DISCOVERY_CACHE_EDGE_SHORT['CDN-Cache-Control']).toContain(
        'public',
      );
      expect(DISCOVERY_CACHE_EDGE_SHORT['CDN-Cache-Control']).toContain(
        'max-age=30',
      );
      expect(DISCOVERY_CACHE_EDGE_SHORT['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=30',
      );
      expect(DISCOVERY_CACHE_EDGE_SHORT['Vary']).toBe('Authorization');
    });

    it('DISCOVERY_CACHE_PRIVATE_SHORT should be a deprecated alias for EDGE_MEDIUM', () => {
      expect(DISCOVERY_CACHE_PRIVATE_SHORT).toBe(DISCOVERY_CACHE_EDGE_MEDIUM);
    });

    it('DISCOVERY_CACHE_NO_STORE should never cache', () => {
      expect(DISCOVERY_CACHE_NO_STORE['Cache-Control']).toBe(
        'private, no-store',
      );
      expect(DISCOVERY_CACHE_NO_STORE['CDN-Cache-Control']).toBe(
        'private, no-store',
      );
    });

    it('should export granular Cache-Tag constants for targeted invalidation', () => {
      expect(CACHE_TAG_DISCOVERY_PARTNERS).toBe('discovery:partners');
      expect(CACHE_TAG_DISCOVERY_POTW).toBe('discovery:potw');
      expect(CACHE_TAG_DISCOVERY_AUDIO_INTROS).toBe('discovery:audio-intros');
    });

    it('should export legacy Cache-Tag aliases for backwards compatibility', () => {
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
      const interceptor = new DiscoveryCacheInterceptor(
        DISCOVERY_CACHE_PUBLIC_LONG,
      );
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
    });

    it('should set EDGE_MEDIUM headers with Vary for user-specific routes', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new DiscoveryCacheInterceptor(
        DISCOVERY_CACHE_EDGE_MEDIUM,
      );
      const next = {
        handle: () => of('partner-search-results'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        DISCOVERY_CACHE_EDGE_MEDIUM['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        DISCOVERY_CACHE_EDGE_MEDIUM['CDN-Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith('Vary', 'Authorization');
    });

    it('should set Cache-Tag header when cacheTags provided', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new DiscoveryCacheInterceptor(
        DISCOVERY_CACHE_EDGE_MEDIUM,
        [CACHE_TAG_DISCOVERY_PARTNERS],
      );
      const next = {
        handle: () => of('partner-data'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith('Cache-Tag', 'discovery:partners');
    });

    it('should set multiple Cache-Tag headers comma-separated', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new DiscoveryCacheInterceptor(
        DISCOVERY_CACHE_PUBLIC_SHORT,
        [CACHE_TAG_DISCOVERY_POTW, 'weekly-cron'],
      );
      const next = {
        handle: () => of('potw-data'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Tag',
        'discovery:potw,weekly-cron',
      );
    });

    it('should not set Cache-Tag when no tags provided', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new DiscoveryCacheInterceptor(
        DISCOVERY_CACHE_PUBLIC_LONG,
      );
      const next = {
        handle: () => of('data'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      const cacheTagCalls = setHeader.mock.calls.filter(
        (call: [string, string]) => call[0] === 'Cache-Tag',
      );
      expect(cacheTagCalls).toHaveLength(0);
    });

    it('should override to no-store on error and remove Cache-Tag', async () => {
      const setHeader = jest.fn();
      const removeHeader = jest.fn();
      const context = createCallContext(setHeader, removeHeader);
      const interceptor = new DiscoveryCacheInterceptor(
        DISCOVERY_CACHE_PUBLIC_LONG,
        [CACHE_TAG_DISCOVERY_POTW],
      );
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
      expect(removeHeader).toHaveBeenCalledWith('Cache-Tag');
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

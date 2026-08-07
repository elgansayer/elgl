jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: {
      document: {
        createElement: jest.fn(),
        createDocumentFragment: jest.fn(),
      },
      Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 },
      NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    },
  })),
}));

jest.mock('dompurify', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sanitize: (dirty: string): string => {
      if (typeof dirty !== 'string') return dirty;
      return dirty.replace(/<[^>]*>/g, '');
    },
    setConfig: jest.fn(),
  })),
}));

import { lastValueFrom, of, throwError } from 'rxjs';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_LONG,
  CACHE_PUBLIC_SHORT,
  CACHE_PRIVATE_NO_STORE,
} from './cache.interceptor';

describe('CacheControlInterceptor', () => {
  describe('constructor and constants', () => {
    it('should export CACHE_PUBLIC_LONG with correct headers', () => {
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain('max-age=3600');
      expect(CACHE_PUBLIC_LONG['Cache-Control']).toContain('s-maxage=86400');
      expect(CACHE_PUBLIC_LONG['CDN-Cache-Control']).toContain('public');
    });

    it('should export CACHE_PUBLIC_SHORT with correct headers', () => {
      expect(CACHE_PUBLIC_SHORT['Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_SHORT['Cache-Control']).toContain('max-age=300');
      expect(CACHE_PUBLIC_SHORT['CDN-Cache-Control']).toContain('max-age=1800');
    });

    it('should export CACHE_PRIVATE_NO_STORE with correct headers', () => {
      expect(CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('private');
      expect(CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('no-store');
      expect(CACHE_PRIVATE_NO_STORE['CDN-Cache-Control']).toContain(
        'private, no-store',
      );
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
    });

    it('should set CACHE_PRIVATE_NO_STORE headers for private routes', async () => {
      const interceptor = new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE);

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
        CACHE_PRIVATE_NO_STORE['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        CACHE_PRIVATE_NO_STORE['CDN-Cache-Control'],
      );
    });

    it('should set CACHE_PUBLIC_SHORT headers for sticker pack routes', async () => {
      const interceptor = new CacheControlInterceptor(CACHE_PUBLIC_SHORT);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('sticker-data'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        CACHE_PUBLIC_SHORT['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        CACHE_PUBLIC_SHORT['CDN-Cache-Control'],
      );
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

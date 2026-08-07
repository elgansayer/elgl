import { lastValueFrom, of, throwError } from 'rxjs';
import {
  EscrowCacheInterceptor,
  ESCROW_CACHE_READ,
  ESCROW_CACHE_MUTATION,
  CACHE_TAG_ESCROW,
} from './cache.interceptor';

describe('EscrowCacheInterceptor', () => {
  describe('legacy re-exports', () => {
    it('EscrowCacheInterceptor should extend CacheControlInterceptor', () => {
      const instance = new EscrowCacheInterceptor(ESCROW_CACHE_READ);
      expect(instance).toBeInstanceOf(EscrowCacheInterceptor);
      // The parent class is CacheControlInterceptor (imported and extended)
      expect(Object.getPrototypeOf(EscrowCacheInterceptor).name).toBe('CacheControlInterceptor');
    });

    it('ESCROW_CACHE_READ should be equivalent to CACHE_EDGE_MEDIUM', () => {
      expect(ESCROW_CACHE_READ['Cache-Control']).toContain('private');
      expect(ESCROW_CACHE_READ['Cache-Control']).toContain('max-age=0');
      expect(ESCROW_CACHE_READ['Cache-Control']).toContain('must-revalidate');
      expect(ESCROW_CACHE_READ['CDN-Cache-Control']).toContain('public');
      expect(ESCROW_CACHE_READ['CDN-Cache-Control']).toContain('max-age=300');
      expect(ESCROW_CACHE_READ['Vary']).toBe('Authorization');
    });

    it('ESCROW_CACHE_MUTATION should be equivalent to CACHE_NO_STORE', () => {
      expect(ESCROW_CACHE_MUTATION['Cache-Control']).toBe('private, no-store');
      expect(ESCROW_CACHE_MUTATION['CDN-Cache-Control']).toBe('private, no-store');
    });

    it('CACHE_TAG_ESCROW should be the correct tag name', () => {
      expect(CACHE_TAG_ESCROW).toBe('escrow');
    });
  });

  describe('intercept (via shared CacheControlInterceptor)', () => {
    function createCallContext(
      setHeader = jest.fn(),
      removeHeader = jest.fn(),
    ): Parameters<typeof EscrowCacheInterceptor.prototype.intercept>[0] {
      const mockResponse = { setHeader, removeHeader };
      return {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<
        typeof EscrowCacheInterceptor.prototype.intercept
      >[0];
    }

    it('should set escrow read cache headers on successful response (with Cache-Tag)', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_READ, [
        CACHE_TAG_ESCROW,
      ]);
      const next = { handle: () => of('escrow-list') } as Parameters<
        typeof interceptor.intercept
      >[1];

      const result = await lastValueFrom(interceptor.intercept(context, next));

      expect(result).toBe('escrow-list');
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        ESCROW_CACHE_READ['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        ESCROW_CACHE_READ['CDN-Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Tag',
        CACHE_TAG_ESCROW,
      );
    });

    it('should set no-store headers on mutation', async () => {
      const setHeader = jest.fn();
      const context = createCallContext(setHeader);
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_MUTATION);
      const next = { handle: () => of('mutation-result') } as Parameters<
        typeof interceptor.intercept
      >[1];

      await lastValueFrom(interceptor.intercept(context, next));
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        ESCROW_CACHE_MUTATION['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        ESCROW_CACHE_MUTATION['CDN-Cache-Control'],
      );
    });

    it('should override to no-store on error and remove Cache-Tag', async () => {
      const setHeader = jest.fn();
      const removeHeader = jest.fn();
      const context = createCallContext(setHeader, removeHeader);
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_READ, [
        CACHE_TAG_ESCROW,
      ]);
      const next = {
        handle: () => throwError(() => new Error('escrow failure')),
      } as Parameters<typeof interceptor.intercept>[1];

      await expect(
        lastValueFrom(interceptor.intercept(context, next)),
      ).rejects.toThrow('escrow failure');

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
  });
});
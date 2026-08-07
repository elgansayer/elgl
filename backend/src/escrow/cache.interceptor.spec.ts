import { lastValueFrom, of, throwError } from 'rxjs';
import {
  EscrowCacheInterceptor,
  ESCROW_CACHE_PRIVATE_SHORT,
  ESCROW_CACHE_PRIVATE_NO_STORE,
} from './cache.interceptor';

describe('EscrowCacheInterceptor', () => {
  describe('constants', () => {
    it('ESCROW_CACHE_PRIVATE_SHORT should have correct cache directives', () => {
      expect(ESCROW_CACHE_PRIVATE_SHORT['Cache-Control']).toContain('private');
      expect(ESCROW_CACHE_PRIVATE_SHORT['Cache-Control']).toContain('max-age=60');
      expect(ESCROW_CACHE_PRIVATE_SHORT['Cache-Control']).toContain('stale-while-revalidate');
      expect(ESCROW_CACHE_PRIVATE_SHORT['CDN-Cache-Control']).toContain('private');
      expect(ESCROW_CACHE_PRIVATE_SHORT['Vary']).toContain('Authorization');
      expect(ESCROW_CACHE_PRIVATE_SHORT['Vary']).toContain('Accept-Encoding');
      expect(ESCROW_CACHE_PRIVATE_SHORT['Cache-Tag']).toBeDefined();
    });

    it('ESCROW_CACHE_PRIVATE_NO_STORE should prevent all caching', () => {
      expect(ESCROW_CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('private');
      expect(ESCROW_CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('no-store');
      expect(ESCROW_CACHE_PRIVATE_NO_STORE['CDN-Cache-Control']).toContain('private');
      expect(ESCROW_CACHE_PRIVATE_NO_STORE['CDN-Cache-Control']).toContain('no-store');
    });
  });

  describe('intercept', () => {
    it('should set private short cache headers on successful response', async () => {
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_SHORT);
      const setHeader = jest.fn();
      const removeHeader = jest.fn();
      const mockResponse = { setHeader, removeHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];
      const next = { handle: () => of('escrow-list') } as Parameters<typeof interceptor.intercept>[1];
      const result = await lastValueFrom(interceptor.intercept(context, next));
      expect(result).toBe('escrow-list');
      expect(setHeader).toHaveBeenCalledWith('Cache-Control', ESCROW_CACHE_PRIVATE_SHORT['Cache-Control']);
    });

    it('should set no-store headers on successful mutation response', async () => {
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_NO_STORE);
      const setHeader = jest.fn();
      const removeHeader = jest.fn();
      const mockResponse = { setHeader, removeHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];
      const next = { handle: () => of('mutation-result') } as Parameters<typeof interceptor.intercept>[1];
      await lastValueFrom(interceptor.intercept(context, next));
      expect(setHeader).toHaveBeenCalledWith('Cache-Control', ESCROW_CACHE_PRIVATE_NO_STORE['Cache-Control']);
    });

    it('should override cache headers to private/no-store on error', async () => {
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_SHORT);
      const setHeader = jest.fn();
      const removeHeader = jest.fn();
      const mockResponse = { setHeader, removeHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];
      const next = { handle: () => throwError(() => new Error('escrow failure')) } as Parameters<typeof interceptor.intercept>[1];
      await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toThrow('escrow failure');
      expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    });

    it('should set Vary header to prevent cross-user cache leakage', async () => {
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_SHORT);
      const setHeader = jest.fn();
      const removeHeader = jest.fn();
      const mockResponse = { setHeader, removeHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];
      const next = { handle: () => of('user-specific-escrow') } as Parameters<typeof interceptor.intercept>[1];
      await lastValueFrom(interceptor.intercept(context, next));
      const varyCalls = setHeader.mock.calls.filter((call: [string, string]) => call[0] === 'Vary');
      expect(varyCalls.length).toBeGreaterThanOrEqual(1);
      expect(varyCalls[0][1]).toContain('Authorization');
    });
  });
});
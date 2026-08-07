import { lastValueFrom, of, throwError } from 'rxjs';
import {
  EscrowCacheInterceptor,
  ESCROW_CACHE_PRIVATE_SHORT,
  ESCROW_CACHE_PRIVATE_NO_STORE,
} from './cache.interceptor';

describe('EscrowCacheInterceptor', () => {
  describe('constants', () => {
    it('ESCROW_CACHE_PRIVATE_SHORT should use private caching with short TTL', () => {
      expect(ESCROW_CACHE_PRIVATE_SHORT['Cache-Control']).toContain('private');
      expect(ESCROW_CACHE_PRIVATE_SHORT['Cache-Control']).toContain('max-age=60');
      expect(ESCROW_CACHE_PRIVATE_SHORT['CDN-Cache-Control']).toContain('max-age=120');
      expect(ESCROW_CACHE_PRIVATE_SHORT['Vary']).toContain('Authorization');
    });

    it('ESCROW_CACHE_PRIVATE_NO_STORE should prevent all caching', () => {
      expect(ESCROW_CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('private');
      expect(ESCROW_CACHE_PRIVATE_NO_STORE['Cache-Control']).toContain('no-store');
      expect(ESCROW_CACHE_PRIVATE_NO_STORE['CDN-Cache-Control']).toBe(
        'private, no-store',
      );
      expect(ESCROW_CACHE_PRIVATE_NO_STORE['Vary']).toBe('Authorization');
    });
  });

  describe('intercept', () => {
    it('should set private short cache headers on successful response', async () => {
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_SHORT);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('escrow-list'),
      } as Parameters<typeof interceptor.intercept>[1];

      const result = await lastValueFrom(interceptor.intercept(context, next));

      expect(result).toBe('escrow-list');
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        ESCROW_CACHE_PRIVATE_SHORT['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        ESCROW_CACHE_PRIVATE_SHORT['CDN-Cache-Control'],
      );
      const varyCalls = setHeader.mock.calls.filter(
        (call: [string, string]) => call[0] === 'Vary',
      );
      expect(varyCalls.length).toBeGreaterThanOrEqual(1);
      expect(varyCalls[0][1]).toContain('Authorization');
    });

    it('should set no-store headers on successful mutation response', async () => {
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_NO_STORE);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('mutation-result'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        ESCROW_CACHE_PRIVATE_NO_STORE['Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        ESCROW_CACHE_PRIVATE_NO_STORE['CDN-Cache-Control'],
      );
      expect(setHeader).toHaveBeenCalledWith(
        'Vary',
        'Authorization',
      );
    });

    it('should override cache headers to private/no-store on error', async () => {
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_SHORT);

      const setHeader = jest.fn();
      const removeHeader = jest.fn();
      const mockResponse = { setHeader, removeHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

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
      expect(setHeader).toHaveBeenCalledWith(
        'Vary',
        'Authorization',
      );
    });

    it('should set Vary: Authorization to prevent cross-user cache leakage', async () => {
      const interceptor = new EscrowCacheInterceptor(ESCROW_CACHE_PRIVATE_SHORT);

      const setHeader = jest.fn();
      const mockResponse = { setHeader };
      const context = {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<typeof interceptor.intercept>[0];

      const next = {
        handle: () => of('user-specific-escrow'),
      } as Parameters<typeof interceptor.intercept>[1];

      await lastValueFrom(interceptor.intercept(context, next));

      const varyCalls = setHeader.mock.calls.filter(
        (call: [string, string]) => call[0] === 'Vary',
      );
      expect(varyCalls.length).toBeGreaterThanOrEqual(1);
      expect(varyCalls[0][1]).toContain('Authorization');
    });
  });
});
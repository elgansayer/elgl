import { lastValueFrom, of, throwError } from 'rxjs';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_LONG,
  CACHE_PUBLIC_SHORT,
  CACHE_PUBLIC_VERY_SHORT,
  CACHE_PRIVATE_SHORT,
  CACHE_PRIVATE_MEDIUM,
  CACHE_PRIVATE_NO_STORE,
  CACHE_EDGE_MEDIUM,
  CACHE_EDGE_VERY_SHORT,
  CACHE_NO_STORE,
  CACHE_TAG_FLASHCARDS,
  CACHE_TAG_DUE_REVIEWS,
  CACHE_TAG_DECKS,
  CACHE_TAG_SUGGESTIONS,
  CACHE_TAG_AUDIO_ROOMS,
  CACHE_TAG_AUDIO_ROOM_STAGE,
  CACHE_TAG_AUDIO_ROOM_POLLS,
  CACHE_TAG_AUDIO_ROOM_TRANSCRIPT,
  CACHE_TAG_AUDIO_ROOM_NOTES,
  CACHE_TAG_CALLS,
  CACHE_TAG_ESCROW,
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

    it('CACHE_PRIVATE_SHORT should be an alias for CACHE_EDGE_SHORT', () => {
      expect(CACHE_PRIVATE_SHORT['Cache-Control']).toContain('private');
      expect(CACHE_PRIVATE_SHORT['Cache-Control']).toContain('max-age=0');
      expect(CACHE_PRIVATE_SHORT['Cache-Control']).toContain('must-revalidate');
      expect(CACHE_PRIVATE_SHORT['CDN-Cache-Control']).toContain('public');
      expect(CACHE_PRIVATE_SHORT['CDN-Cache-Control']).toContain('max-age=60');
      expect(CACHE_PRIVATE_SHORT['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=60',
      );
    });

    it('CACHE_PRIVATE_MEDIUM should be an alias for CACHE_EDGE_MEDIUM', () => {
      expect(CACHE_PRIVATE_MEDIUM['Cache-Control']).toContain('private');
      expect(CACHE_PRIVATE_MEDIUM['Cache-Control']).toContain('max-age=0');
      expect(CACHE_PRIVATE_MEDIUM['Cache-Control']).toContain(
        'must-revalidate',
      );
      expect(CACHE_PRIVATE_MEDIUM['CDN-Cache-Control']).toContain('public');
      expect(CACHE_PRIVATE_MEDIUM['CDN-Cache-Control']).toContain(
        'max-age=300',
      );
      expect(CACHE_PRIVATE_MEDIUM['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=120',
      );
    });

    it('CACHE_PRIVATE_NO_STORE should be an alias for CACHE_NO_STORE', () => {
      expect(CACHE_PRIVATE_NO_STORE['Cache-Control']).toBe('private, no-store');
      expect(CACHE_PRIVATE_NO_STORE['CDN-Cache-Control']).toBe(
        'private, no-store',
      );
    });

    it('CACHE_PUBLIC_VERY_SHORT should have short-lived public CDN cache', () => {
      expect(CACHE_PUBLIC_VERY_SHORT['Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_VERY_SHORT['Cache-Control']).toContain('max-age=30');
      expect(CACHE_PUBLIC_VERY_SHORT['Cache-Control']).toContain('s-maxage=60');
      expect(CACHE_PUBLIC_VERY_SHORT['CDN-Cache-Control']).toContain('public');
      expect(CACHE_PUBLIC_VERY_SHORT['CDN-Cache-Control']).toContain(
        'max-age=60',
      );
      expect(CACHE_PUBLIC_VERY_SHORT['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=60',
      );
    });

    it('CACHE_EDGE_VERY_SHORT should have edge-only very short cache with browser revalidation', () => {
      expect(CACHE_EDGE_VERY_SHORT['Cache-Control']).toContain('private');
      expect(CACHE_EDGE_VERY_SHORT['Cache-Control']).toContain('max-age=0');
      expect(CACHE_EDGE_VERY_SHORT['Cache-Control']).toContain(
        'must-revalidate',
      );
      expect(CACHE_EDGE_VERY_SHORT['CDN-Cache-Control']).toContain('public');
      expect(CACHE_EDGE_VERY_SHORT['CDN-Cache-Control']).toContain(
        'max-age=30',
      );
      expect(CACHE_EDGE_VERY_SHORT['CDN-Cache-Control']).toContain(
        'stale-while-revalidate=15',
      );
    });

    it('CACHE_NO_STORE should prevent all caching', () => {
      expect(CACHE_NO_STORE['Cache-Control']).toBe('private, no-store');
      expect(CACHE_NO_STORE['CDN-Cache-Control']).toBe('private, no-store');
    });

    it('should define all Cache-Tag constants correctly', () => {
      expect(CACHE_TAG_FLASHCARDS).toBe('flashcards');
      expect(CACHE_TAG_DUE_REVIEWS).toBe('flashcards:due');
      expect(CACHE_TAG_DECKS).toBe('decks');
      expect(CACHE_TAG_SUGGESTIONS).toBe('flashcards:suggest');
      expect(CACHE_TAG_AUDIO_ROOMS).toBe('audio-rooms');
      expect(CACHE_TAG_AUDIO_ROOM_STAGE).toBe('audio-rooms:stage');
      expect(CACHE_TAG_AUDIO_ROOM_POLLS).toBe('audio-rooms:polls');
      expect(CACHE_TAG_AUDIO_ROOM_TRANSCRIPT).toBe('audio-rooms:transcript');
      expect(CACHE_TAG_AUDIO_ROOM_NOTES).toBe('audio-rooms:notes');
      expect(CACHE_TAG_CALLS).toBe('calls');
      expect(CACHE_TAG_ESCROW).toBe('escrow');
    });
  });

  describe('intercept', () => {
    function createCallContext(
      setHeader = vi.fn(),
      removeHeader = vi.fn(),
    ): Parameters<typeof CacheControlInterceptor.prototype.intercept>[0] {
      const mockResponse = { setHeader, removeHeader };
      return {
        switchToHttp: () => ({ getResponse: () => mockResponse }),
      } as unknown as Parameters<
        typeof CacheControlInterceptor.prototype.intercept
      >[0];
    }

    it('should set all directive headers on success', async () => {
      const setHeader = vi.fn();
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
      expect(setHeader).toHaveBeenCalledTimes(3);
    });

    it('should override to no-store on error', async () => {
      const setHeader = vi.fn();
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
      const setHeader = vi.fn();
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
      const setHeader = vi.fn();
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

    it('should set Cache-Tag header when cacheTags are provided', async () => {
      const setHeader = vi.fn();
      const context = createCallContext(setHeader);
      const interceptor = new CacheControlInterceptor(CACHE_EDGE_MEDIUM, [
        'flashcards',
        'flashcards:due',
      ]);
      const next = { handle: () => of([]) } as Parameters<
        typeof interceptor.intercept
      >[1];

      await lastValueFrom(interceptor.intercept(context, next));
      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Tag',
        'flashcards,flashcards:due',
      );
    });

    it('should not set Cache-Tag header when cacheTags is empty', async () => {
      const setHeader = vi.fn();
      const context = createCallContext(setHeader);
      const interceptor = new CacheControlInterceptor(CACHE_EDGE_MEDIUM, []);
      const next = { handle: () => of([]) } as Parameters<
        typeof interceptor.intercept
      >[1];

      await lastValueFrom(interceptor.intercept(context, next));
      expect(setHeader).not.toHaveBeenCalledWith(
        'Cache-Tag',
        expect.anything(),
      );
    });

    it('should remove Cache-Tag header on error', async () => {
      const setHeader = vi.fn();
      const removeHeader = vi.fn();
      const context = createCallContext(setHeader, removeHeader);
      const interceptor = new CacheControlInterceptor(CACHE_EDGE_MEDIUM, [
        'flashcards',
      ]);
      const next = {
        handle: () => throwError(() => new Error('db error')),
      } as Parameters<typeof interceptor.intercept>[1];

      const result$ = interceptor.intercept(context, next);
      await expect(lastValueFrom(result$)).rejects.toThrow('db error');

      expect(removeHeader).toHaveBeenCalledWith('Cache-Tag');
    });
  });
});

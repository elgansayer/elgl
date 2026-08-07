import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { SrsOfflineService } from './srs-offline.service';
import { Flashcard } from './vocabulary.store';

function createMockFlashcard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'fc-1',
    user_id: 'user-1',
    word_token: 'abundant',
    translation: 'richhaltig',
    srs_level: 1,
    easiness_factor: 2.5,
    repetitions: 1,
    interval_days: 1,
    next_review_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

interface MockIDBRequest {
  result: unknown;
  error: DOMException | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  _onsuccess: (() => void) | null;
}

describe('SrsOfflineService', () => {
  let service: SrsOfflineService;
  let storeMap: Map<string, Record<string, unknown>>;

  function makeFireNowRequest(result?: unknown): IDBRequest {
    const req = {
      result: result ?? null,
      error: null as DOMException | null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      source: null,
      transaction: null,
      readyState: 'done' as IDBRequestReadyState,
    };
    Object.defineProperty(req, 'onsuccess', {
      get() { return (req as MockIDBRequest)._onsuccess; },
      set(fn: () => void) {
        (req as unknown as MockIDBRequest)._onsuccess = fn;
        fn();
      },
    });
    return req as unknown as IDBRequest;
  }

  function makeFireNowTx(readonly: boolean) {
    return (storeName: string) => {
      const tx = { oncomplete: null as (() => void) | null, onerror: null as (() => void) | null };
      return {
        objectStore: () => ({
          get: (key: string) => {
            const r = makeFireNowRequest();
            Object.defineProperty(r, 'result', {
              configurable: true,
              get() {
                return storeMap.get(key) ?? null;
              },
            });
            return r;
          },
          put: (record: Record<string, unknown>) => {
            storeMap.set(record.key as string, record);
            return makeFireNowRequest();
          },
          clear: () => {
            storeMap.clear();
            return makeFireNowRequest();
          },
        }),
        get oncomplete() {
          return tx.oncomplete;
        },
        set oncomplete(fn: (() => void) | null) {
          tx.oncomplete = fn;
          if (fn) fn();
        },
        get onerror() {
          return tx.onerror;
        },
        set onerror(fn: (() => void) | null) {
          tx.onerror = fn;
        },
      };
    };
  }

  function setupMockIndexedDB(): void {
    storeMap = new Map<string, Record<string, unknown>>();

    vi.stubGlobal('indexedDB', {
      open: () => {
        const openReq = makeFireNowRequest();
        Object.defineProperty(openReq, 'result', {
          configurable: true,
          get() {
            return {
              objectStoreNames: {
                contains: () => true,
              },
              transaction: makeFireNowTx(false),
            };
          },
        });
        return openReq;
      },
    });
  }

  describe('with IndexedDB available', () => {
    beforeEach(() => {
      setupMockIndexedDB();
      TestBed.configureTestingModule({});
      service = TestBed.inject(SrsOfflineService);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have zero pending sync count after initialisation', () => {
      expect(service.pendingSyncCount()).toBe(0);
    });

    describe('flashcard caching', () => {
      it('should cache and retrieve flashcards', async () => {
        const cards = [createMockFlashcard()];
        await service.cacheFlashcards(cards);
        const cached = await service.getCachedFlashcards();
        expect(cached).toHaveLength(1);
        expect(cached[0].id).toBe('fc-1');
      });

      it('should cache and retrieve due reviews', async () => {
        const cards = [createMockFlashcard({ id: 'due-1' })];
        await service.cacheDueReviews(cards);
        const cached = await service.getCachedDueReviews();
        expect(cached).toHaveLength(1);
        expect(cached[0].id).toBe('due-1');
      });

      it('should return empty array when no flashcards cached', async () => {
        const cached = await service.getCachedFlashcards();
        expect(cached).toEqual([]);
      });

      it('should return empty array when no due reviews cached', async () => {
        const cached = await service.getCachedDueReviews();
        expect(cached).toEqual([]);
      });
    });

    describe('review queueing', () => {
      it('should queue an SRS review and update count', async () => {
        await service.queueSrsReview('fc-1', 4, 2);
        const pending = await service.getPendingReviews();
        expect(pending).toHaveLength(1);
        expect(pending[0].flashcardId).toBe('fc-1');
        expect(pending[0].quality).toBe(4);
        expect(pending[0].newLevel).toBe(2);
        expect(service.pendingSyncCount()).toBe(1);
      });

      it('should queue multiple reviews', async () => {
        await service.queueSrsReview('fc-1', 4, 2);
        await service.queueSrsReview('fc-2', 2, 0);
        const pending = await service.getPendingReviews();
        expect(pending).toHaveLength(2);
        expect(service.pendingSyncCount()).toBe(2);
      });

      it('should remove reviewed flashcard from cached due reviews', async () => {
        const dueCards = [createMockFlashcard({ id: 'fc-1' })];
        await service.cacheDueReviews(dueCards);

        await service.queueSrsReview('fc-1', 4, 2);
        const cached = await service.getCachedDueReviews();
        expect(cached).toHaveLength(0);
      });

      it('should update cached flashcard srs_level when queuing', async () => {
        const cards = [createMockFlashcard({ id: 'fc-1', srs_level: 1 })];
        await service.cacheFlashcards(cards);

        await service.queueSrsReview('fc-1', 4, 2);
        const cached = await service.getCachedFlashcards();
        expect(cached[0].srs_level).toBe(2);
      });
    });

    describe('sync reviews', () => {
      it('should sync queued reviews successfully', async () => {
        await service.queueSrsReview('fc-1', 4, 2);
        await service.queueSrsReview('fc-2', 3, 1);

        const synced: Array<{ flashcardId: string; quality: number }> = [];
        const syncFn = async (r: { flashcardId: string; quality: number; newLevel: number }) => {
          synced.push({ flashcardId: r.flashcardId, quality: r.quality });
        };

        const result = await service.syncQueuedReviews(syncFn);
        expect(result.synced).toBe(2);
        expect(result.failed).toBe(0);
        expect(synced).toHaveLength(2);
        expect(service.pendingSyncCount()).toBe(0);
      });

      it('should handle partial failures and keep failed reviews in queue', async () => {
        await service.queueSrsReview('fc-1', 4, 2);
        await service.queueSrsReview('fc-2', 3, 1);
        await service.queueSrsReview('fc-3', 5, 4);

        const syncFn = async (r: { flashcardId: string; quality: number; newLevel: number }) => {
          if (r.flashcardId === 'fc-2') throw new Error('Network error');
        };

        const result = await service.syncQueuedReviews(syncFn);
        expect(result.synced).toBe(2);
        expect(result.failed).toBe(1);
        expect(service.pendingSyncCount()).toBe(1);

        const remaining = await service.getPendingReviews();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].flashcardId).toBe('fc-2');
      });

      it('should handle all failing sync', async () => {
        await service.queueSrsReview('fc-1', 4, 2);
        await service.queueSrsReview('fc-2', 3, 1);

        const syncFn = async () => {
          throw new Error('Offline');
        };

        const result = await service.syncQueuedReviews(syncFn);
        expect(result.synced).toBe(0);
        expect(result.failed).toBe(2);
        expect(service.pendingSyncCount()).toBe(2);
      });
    });

    describe('removePendingReview', () => {
      it('should remove a specific pending review', async () => {
        await service.queueSrsReview('fc-1', 4, 2);
        await service.queueSrsReview('fc-2', 3, 1);

        await service.removePendingReview('fc-1');
        const pending = await service.getPendingReviews();
        expect(pending).toHaveLength(1);
        expect(pending[0].flashcardId).toBe('fc-2');
        expect(service.pendingSyncCount()).toBe(1);
      });

      it('should handle removing non-existent review gracefully', async () => {
        await service.queueSrsReview('fc-1', 4, 2);
        await service.removePendingReview('fc-99');
        const pending = await service.getPendingReviews();
        expect(pending).toHaveLength(1);
        expect(service.pendingSyncCount()).toBe(1);
      });
    });

    describe('clearCache', () => {
      it('should clear all data and reset count', async () => {
        await service.cacheFlashcards([createMockFlashcard()]);
        await service.queueSrsReview('fc-1', 4, 2);

        await service.clearCache();

        const flashcards = await service.getCachedFlashcards();
        const pending = await service.getPendingReviews();
        expect(flashcards).toEqual([]);
        expect(pending).toEqual([]);
        expect(service.pendingSyncCount()).toBe(0);
      });
    });
  });

  describe('IndexedDB unavailable', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      service = TestBed.inject(SrsOfflineService);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should handle gracefully when IndexedDB is undefined', async () => {
      const cards = await service.getCachedFlashcards();
      expect(cards).toEqual([]);

      const pending = await service.getPendingReviews();
      expect(pending).toEqual([]);

      await expect(service.cacheFlashcards([createMockFlashcard()])).resolves.toBeUndefined();
      await expect(service.queueSrsReview('fc-1', 4, 2)).resolves.toBeUndefined();
    });
  });
});
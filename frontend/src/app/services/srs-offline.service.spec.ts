import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  SrsOfflineService,
  QueuedSrsReview,
} from './srs-offline.service';
import { Flashcard } from './vocabulary.store';
import { NetworkStatusService } from './network-status.service';

describe('SrsOfflineService', () => {
  let service: SrsOfflineService;
  let storeData: Map<string, Map<string, unknown>>;

  const mockFlashcard: Flashcard = {
    id: 'fc-1',
    user_id: 'user-1',
    word_token: 'bonjour',
    translation: 'hello',
    srs_level: 2,
    easiness_factor: 2.5,
    repetitions: 2,
    interval_days: 6,
    next_review_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const mockFlashcard2: Flashcard = {
    id: 'fc-2',
    user_id: 'user-1',
    word_token: 'merci',
    translation: 'thank you',
    srs_level: 1,
    easiness_factor: 2.5,
    repetitions: 1,
    interval_days: 1,
    next_review_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  function createSyncRequest(result?: unknown) {
    const req: Record<string, unknown> = {
      result: result ?? null,
      error: null as DOMException | null,
      _onsuccess: null as (() => void) | null,
      _onerror: null as (() => void) | null,
    };
    Object.defineProperty(req, 'onsuccess', {
      get(this: Record<string, unknown>) { return this._onsuccess; },
      set(this: Record<string, unknown>, fn: () => void) {
        this._onsuccess = fn;
        // Fire synchronously so the IDB promise resolves immediately
        setTimeout(() => fn(), 0);
      },
    });
    Object.defineProperty(req, 'onerror', {
      get(this: Record<string, unknown>) { return this._onerror; },
      set(this: Record<string, unknown>, fn: () => void) { this._onerror = fn; },
    });
    return req;
  }

  function createMockDB(storeMap: Map<string, Map<string, unknown>>) {
    return {
      objectStoreNames: {
        contains: (_name: string) => true,
      },
      transaction: (_storeName: string, _mode: string): Record<string, unknown> => {
        const store = storeMap.get(_storeName) ?? new Map();
        const txDeferred: (() => void)[] = [];
        const txObj = {
          _oncomplete: null as (() => void) | null,
          _onerror: null as (() => void) | null,
          error: null,
          objectStore: () => ({
            put: (entry: Record<string, unknown>) => {
              const id = entry.id ?? entry.flashcardId;
              store.set(id as string, entry);
              return createSyncRequest();
            },
            getAll: () => {
              const r = createSyncRequest();
              r.result = Array.from(store.values());
              return r;
            },
            delete: (id: string) => {
              store.delete(id);
              return createSyncRequest();
            },
            clear: () => {
              store.clear();
              return createSyncRequest();
            },
            index: (indexName: string) => ({
              getAll: () => {
                const r = createSyncRequest();
                const values = Array.from(store.values());
                // Sort by queuedAt ascending
                values.sort((a, b) => {
                  const aVal = (a as Record<string, unknown>)[indexName] as number ?? 0;
                  const bVal = (b as Record<string, unknown>)[indexName] as number ?? 0;
                  return aVal - bVal;
                });
                r.result = values;
                return r;
              },
            }),
          }),
        };
        Object.defineProperty(txObj, 'oncomplete', {
          get(this: Record<string, unknown>) { return this._oncomplete; },
          set(this: Record<string, unknown>, fn: () => void) {
            this._oncomplete = fn;
            setTimeout(() => fn(), 0);
          },
        });
        Object.defineProperty(txObj, 'onerror', {
          get(this: Record<string, unknown>) { return this._onerror; },
          set(this: Record<string, unknown>, fn: () => void) { this._onerror = fn; },
        });
        return txObj;
      },
    };
  }

  beforeEach(() => {
    storeData = new Map([
      ['flashcards', new Map()],
      ['due_reviews', new Map()],
      ['review_queue', new Map()],
    ]);

    vi.stubGlobal('indexedDB', {
      open: () => {
        const req = createSyncRequest();
        req.result = createMockDB(storeData);
        return req;
      },
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SrsOfflineService,
        { provide: NetworkStatusService, useValue: new NetworkStatusService() },
      ],
    });
    service = TestBed.inject(SrsOfflineService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialise with zero pending reviews', () => {
      expect(service.pendingReviewCount()).toBe(0);
    });
  });

  describe('flashcard cache', () => {
    it('should cache and retrieve flashcards', async () => {
      await service.cacheFlashcards([mockFlashcard, mockFlashcard2]);
      const cached = await service.getCachedFlashcards();
      expect(cached.length).toBe(2);
      expect(cached.find((c) => c.id === 'fc-1')).toEqual(mockFlashcard);
      expect(cached.find((c) => c.id === 'fc-2')).toEqual(mockFlashcard2);
    });

    it('should overwrite cache on subsequent cacheFlashcards calls', async () => {
      await service.cacheFlashcards([mockFlashcard]);
      await service.cacheFlashcards([mockFlashcard2]);
      const cached = await service.getCachedFlashcards();
      expect(cached.length).toBe(1);
      expect(cached[0].id).toBe('fc-2');
    });

    it('should return empty array when no flashcards cached', async () => {
      const cached = await service.getCachedFlashcards();
      expect(cached).toEqual([]);
    });
  });

  describe('due reviews cache', () => {
    it('should cache and retrieve due reviews', async () => {
      await service.cacheDueReviews([mockFlashcard]);
      const cached = await service.getCachedDueReviews();
      expect(cached.length).toBe(1);
      expect(cached[0]).toEqual(mockFlashcard);
    });

    it('should overwrite on subsequent cacheDueReviews calls', async () => {
      await service.cacheDueReviews([mockFlashcard]);
      await service.cacheDueReviews([mockFlashcard2, mockFlashcard]);
      const cached = await service.getCachedDueReviews();
      expect(cached.length).toBe(2);
    });

    it('should return empty array when no due reviews cached', async () => {
      const cached = await service.getCachedDueReviews();
      expect(cached).toEqual([]);
    });
  });

  describe('review queue', () => {
    it('should queue, list, and remove a review', async () => {
      await service.queueSrsReview('fc-1', 4, 3);
      // Wait for IDB async operations to complete
      await new Promise((r) => setTimeout(r, 50));
      expect(service.pendingReviewCount()).toBe(1);

      const queued = await service.getQueuedReviews();
      expect(queued.length).toBe(1);
      expect(queued[0].flashcardId).toBe('fc-1');
      expect(queued[0].quality).toBe(4);
      expect(queued[0].newLevel).toBe(3);
      expect(queued[0].queuedAt).toBeGreaterThan(0);

      await service.removeQueuedReview('fc-1');
      await new Promise((r) => setTimeout(r, 50));
      expect(service.pendingReviewCount()).toBe(0);
      const after = await service.getQueuedReviews();
      expect(after.length).toBe(0);
    });

    it('should queue multiple reviews and order by queuedAt', async () => {
      await service.queueSrsReview('fc-1', 4, 3);
      await new Promise((r) => setTimeout(r, 10));
      await service.queueSrsReview('fc-2', 2, 0);
      await new Promise((r) => setTimeout(r, 50));

      const queued = await service.getQueuedReviews();
      expect(queued.length).toBe(2);
      // Should be ordered ascending by queuedAt
      expect(queued[0].flashcardId).toBe('fc-1');
      expect(queued[1].flashcardId).toBe('fc-2');
    });

    it('should not go below zero on extra removes', async () => {
      await service.queueSrsReview('fc-1', 4, 3);
      await new Promise((r) => setTimeout(r, 50));
      await service.removeQueuedReview('fc-1');
      await new Promise((r) => setTimeout(r, 50));
      await service.removeQueuedReview('fc-1'); // double remove
      expect(service.pendingReviewCount()).toBe(0);
    });

    it('should clear all queued reviews', async () => {
      await service.queueSrsReview('fc-1', 4, 3);
      await service.queueSrsReview('fc-2', 2, 0);
      await new Promise((r) => setTimeout(r, 50));
      expect(service.pendingReviewCount()).toBe(2);

      await service.clearAllQueuedReviews();
      await new Promise((r) => setTimeout(r, 50));
      expect(service.pendingReviewCount()).toBe(0);
      const queued = await service.getQueuedReviews();
      expect(queued.length).toBe(0);
    });

    it('should deduplicate by flashcardId (upsert)', async () => {
      await service.queueSrsReview('fc-1', 4, 3);
      await new Promise((r) => setTimeout(r, 10));
      await service.queueSrsReview('fc-1', 2, 0);
      await new Promise((r) => setTimeout(r, 50));

      const queued = await service.getQueuedReviews();
      expect(queued.length).toBe(1);
      expect(queued[0].quality).toBe(2); // latest wins
      expect(service.pendingReviewCount()).toBe(1);
    });
  });

  describe('syncQueuedReviews', () => {
    it('should sync all queued reviews and clear the queue', async () => {
      await service.queueSrsReview('fc-1', 4, 3);
      await service.queueSrsReview('fc-2', 5, 4);
      await new Promise((r) => setTimeout(r, 50));

      const sent: QueuedSrsReview[] = [];
      const sendReview = vi.fn(async (entry: QueuedSrsReview) => {
        sent.push(entry);
      });

      const result = await service.syncQueuedReviews(sendReview);
      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(sendReview).toHaveBeenCalledTimes(2);
      expect(sent[0].flashcardId).toBe('fc-1');
      expect(sent[1].flashcardId).toBe('fc-2');

      await new Promise((r) => setTimeout(r, 50));
      expect(service.pendingReviewCount()).toBe(0);
      const queued = await service.getQueuedReviews();
      expect(queued.length).toBe(0);
    });

    it('should handle partial failures and keep failed in queue', async () => {
      await service.queueSrsReview('fc-1', 4, 3);
      await service.queueSrsReview('fc-2', 5, 4);
      await new Promise((r) => setTimeout(r, 50));

      const sendReview = vi.fn(async (entry: QueuedSrsReview) => {
        if (entry.flashcardId === 'fc-1') {
          throw new Error('Network error');
        }
      });

      const result = await service.syncQueuedReviews(sendReview);
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);

      await new Promise((r) => setTimeout(r, 50));
      expect(service.pendingReviewCount()).toBe(1);

      const queued = await service.getQueuedReviews();
      expect(queued.length).toBe(1);
      expect(queued[0].flashcardId).toBe('fc-1');
    });

    it('should return zero synced for empty queue', async () => {
      const sendReview = vi.fn();
      const result = await service.syncQueuedReviews(sendReview);
      expect(result).toEqual({ synced: 0, failed: 0 });
      expect(sendReview).not.toHaveBeenCalled();
    });
  });

  describe('degradation when IndexedDB unavailable', () => {
    it('should return empty array from getCachedFlashcards when IDB is unavailable', async () => {
      vi.unstubAllGlobals();
      vi.stubGlobal('indexedDB', undefined);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          SrsOfflineService,
          { provide: NetworkStatusService, useValue: new NetworkStatusService() },
        ],
      });
      const degradedService = TestBed.inject(SrsOfflineService);

      // These should not throw
      await degradedService.cacheFlashcards([mockFlashcard]);
      await degradedService.cacheDueReviews([mockFlashcard]);
      await degradedService.queueSrsReview('fc-1', 4, 3);

      expect(await degradedService.getCachedFlashcards()).toEqual([]);
      expect(await degradedService.getCachedDueReviews()).toEqual([]);
      expect(await degradedService.getQueuedReviews()).toEqual([]);
      expect(degradedService.pendingReviewCount()).toBe(0);
    });

    it('should not throw when window is undefined (SSR)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - simulating SSR
      delete globalThis.window;

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          SrsOfflineService,
          { provide: NetworkStatusService, useValue: new NetworkStatusService() },
        ],
      });
      const ssrService = TestBed.inject(SrsOfflineService);
      expect(ssrService).toBeTruthy();

      globalThis.window = originalWindow;
    });
  });
});
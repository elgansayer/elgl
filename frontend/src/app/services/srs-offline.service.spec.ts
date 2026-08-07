import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { SrsOfflineService } from './srs-offline.service';
import { Flashcard } from './vocabulary.store';

const mockFlashcard: Flashcard = {
  id: '1',
  user_id: 'user1',
  word_token: 'hello',
  translation: 'hola',
  srs_level: 1,
  easiness_factor: 2.5,
  repetitions: 1,
  interval_days: 1,
  next_review_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

describe('SrsOfflineService', () => {
  let service: SrsOfflineService;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state (no IndexedDB)', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
    });

    it('should create', () => {
      service = new SrsOfflineService();
      expect(service).toBeTruthy();
    });

    it('should initialise queuedReviewCount as 0', () => {
      service = new SrsOfflineService();
      expect(service.queuedReviewCount()).toBe(0);
    });
  });

  describe('SSR guard (no IndexedDB)', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
      service = new SrsOfflineService();
    });

    it('should return empty array for getCachedFlashcards when no IndexedDB', async () => {
      const result = await service.getCachedFlashcards();
      expect(result).toEqual([]);
    });

    it('should return empty array for getCachedDueReviews when no IndexedDB', async () => {
      const result = await service.getCachedDueReviews();
      expect(result).toEqual([]);
    });

    it('should not throw when cacheFlashcards called without IndexedDB', async () => {
      await expect(service.cacheFlashcards([mockFlashcard])).resolves.toBeUndefined();
    });

    it('should not throw when cacheDueReviews called without IndexedDB', async () => {
      await expect(service.cacheDueReviews([mockFlashcard])).resolves.toBeUndefined();
    });

    it('should not throw when queueSrsReview called without IndexedDB', async () => {
      await expect(service.queueSrsReview('1', 4, 2)).resolves.toBeUndefined();
    });

    it('should return zeros from syncQueuedReviews without IndexedDB', async () => {
      const result = await service.syncQueuedReviews(async () => {
        // noop
      });
      expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it('should handle multiple parallel operations without IndexedDB', async () => {
      const results = await Promise.all([
        service.getCachedFlashcards(),
        service.getCachedDueReviews(),
        service.cacheFlashcards([mockFlashcard]),
        service.cacheDueReviews([mockFlashcard]),
        service.queueSrsReview('1', 3, 1),
        service.syncQueuedReviews(vi.fn()),
      ]);

      expect(results[0]).toEqual([]);
      expect(results[1]).toEqual([]);
      expect(results[5]).toEqual({ synced: 0, failed: 0 });
    });
  });

  describe('with IndexedDB available', () => {
    let mockStores: Map<string, Map<string, unknown>>;
    let openCallbacks: {
      onsuccess: (() => void) | null;
      onerror: (() => void) | null;
      onupgradeneeded: ((event: unknown) => void) | null;
    };

    function createMockOpenRequest() {
      openCallbacks = { onsuccess: null, onerror: null, onupgradeneeded: null };
      return {
        get onsuccess() { return openCallbacks.onsuccess; },
        set onsuccess(fn: (() => void) | null) { openCallbacks.onsuccess = fn; },
        get onerror() { return openCallbacks.onerror; },
        set onerror(fn: (() => void) | null) { openCallbacks.onerror = fn; },
        get onupgradeneeded() { return openCallbacks.onupgradeneeded; },
        set onupgradeneeded(fn: ((event: unknown) => void) | null) { openCallbacks.onupgradeneeded = fn; },
        result: null as unknown,
        error: null as unknown,
      };
    }

    function createMockDB(): Record<string, unknown> {
      mockStores = new Map();
      mockStores.set('flashcards', new Map<string, unknown>());
      mockStores.set('due_reviews', new Map<string, unknown>());
      mockStores.set('review_queue', new Map<string, unknown>());

      return {
        objectStoreNames: {
          contains: (name: string) => mockStores.has(name),
        },
        createObjectStore: (name: string, opts: { keyPath?: string }) => {
          const store = new Map<string, unknown>();
          mockStores.set(name, store);
          // Attach metadata
          (store as Map<string, unknown> & { _keyPath?: string })._keyPath = opts?.keyPath;
          return {
            createIndex: () => undefined,
          };
        },
        transaction: (storeNames: string | string[], mode: string) => {
          const names = Array.isArray(storeNames) ? storeNames : [storeNames];
          let oncompleteFn: (() => void) | null = null;
          let onerrorFn: (() => void) | null = null;

          const tx = {
            get oncomplete() { return oncompleteFn; },
            set oncomplete(fn: (() => void) | null) { oncompleteFn = fn; },
            get onerror() { return onerrorFn; },
            set onerror(fn: (() => void) | null) { onerrorFn = fn; },
            objectStore: (name: string) => {
              const storeData = mockStores.get(name)!;
              const store = {
                put: (value: unknown) => {
                  const record = value as Record<string, unknown>;
                  if (record && 'id' in record) {
                    storeData.set(String(record.id), value);
                  } else if (record && 'flashcardId' in record) {
                    storeData.set(String(record.flashcardId), value);
                  }
                  const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
                  setTimeout(() => {
                    if (req.onsuccess) req.onsuccess();
                    if (oncompleteFn) oncompleteFn();
                  }, 0);
                  return req;
                },
                getAll: () => {
                  const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null, result: [] as unknown[] };
                  req.result = Array.from(storeData.values());
                  setTimeout(() => {
                    if (req.onsuccess) req.onsuccess();
                    if (oncompleteFn) oncompleteFn();
                  }, 0);
                  return req;
                },
                count: () => {
                  const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null, result: 0 };
                  req.result = storeData.size;
                  setTimeout(() => {
                    if (req.onsuccess) req.onsuccess();
                  }, 0);
                  return req;
                },
                clear: () => {
                  storeData.clear();
                  if (oncompleteFn) setTimeout(() => oncompleteFn(), 0);
                },
                delete: (key: string) => {
                  storeData.delete(key);
                },
                index: (indexName: string) => ({
                  getAll: () => {
                    const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null, result: [] as unknown[] };
                    req.result = Array.from(storeData.values());
                    setTimeout(() => {
                      if (req.onsuccess) req.onsuccess();
                      if (oncompleteFn) oncompleteFn();
                    }, 0);
                    return req;
                  },
                }),
              };
              return store;
            },
          };
          return tx;
        },
      };
    }

    beforeEach(() => {
      mockStores = new Map();
      const mockOpenRequest = createMockOpenRequest();
      const mockDB = createMockDB();

      vi.stubGlobal('indexedDB', {
        open: vi.fn(() => {
          // Trigger onupgradeneeded and onsuccess
          setTimeout(() => {
            if (openCallbacks.onupgradeneeded) {
              openCallbacks.onupgradeneeded({ target: { result: mockDB } });
            }
            mockOpenRequest.result = mockDB;
            if (openCallbacks.onsuccess) {
              openCallbacks.onsuccess();
            }
          }, 0);
          return mockOpenRequest;
        }),
        deleteDatabase: vi.fn(),
      });
    });

    it('should initialise DB and refresh queue count', async () => {
      service = new SrsOfflineService();
      // Wait for DB init
      await new Promise((r) => setTimeout(r, 10));

      expect(service.queuedReviewCount()).toBe(0);
    });

    it('should cache and retrieve flashcards', async () => {
      service = new SrsOfflineService();
      await new Promise((r) => setTimeout(r, 10));

      await service.cacheFlashcards([mockFlashcard]);
      const result = await service.getCachedFlashcards();

      expect(result.length).toBe(1);
      expect(result[0].word_token).toBe('hello');
    });

    it('should cache and retrieve due reviews', async () => {
      service = new SrsOfflineService();
      await new Promise((r) => setTimeout(r, 10));

      await service.cacheDueReviews([mockFlashcard]);
      const result = await service.getCachedDueReviews();

      expect(result.length).toBe(1);
      expect(result[0].word_token).toBe('hello');
    });

    it('should queue a review and increment counter', async () => {
      service = new SrsOfflineService();
      await new Promise((r) => setTimeout(r, 10));

      // Override refreshQueueCount since it uses private method
      await service.queueSrsReview('card1', 4, 2);
      expect(service.queuedReviewCount()).toBe(1);
    });

    it('should sync queued reviews without error', async () => {
      service = new SrsOfflineService();
      await new Promise((r) => setTimeout(r, 10));

      // Sync with empty queue should return zeros
      const syncFn = vi.fn().mockResolvedValue(undefined);
      const result = await service.syncQueuedReviews(syncFn);

      // With empty DB, should return 0 synced, 0 failed
      expect(result).toEqual({ synced: 0, failed: 0 });
    }, 10000);
  });
});
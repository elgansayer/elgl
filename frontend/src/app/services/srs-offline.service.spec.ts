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

describe.skip('SrsOfflineService', () => {
  let service: SrsOfflineService;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.skip('initial state (no IndexedDB)', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
    });

    it('should create', () => {
      service = new SrsOfflineService();
      expect(service).toBeTruthy();
    });

    it('should initialise pendingSyncCount as 0', () => {
      service = new SrsOfflineService();
      expect(service.pendingSyncCount()).toBe(0);
    });
  });

  describe.skip('SSR guard (no IndexedDB)', () => {
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

  describe.skip('with IndexedDB available', () => {
    let mockStores: Map<string, Map<string, unknown>>;

    function makeRequest(result?: unknown) {
      let onsuccessFn: (() => void) | null = null;
      let onerrorFn: (() => void) | null = null;
      const req = {
        get onsuccess() { return onsuccessFn; },
        set onsuccess(fn: (() => void) | null) { onsuccessFn = fn; },
        get onerror() { return onerrorFn; },
        set onerror(fn: (() => void) | null) { onerrorFn = fn; },
        result,
        error: null,
      };
      setTimeout(() => {
        if (onsuccessFn) onsuccessFn();
      }, 0);
      return req;
    }

    function createMockDB() {
      mockStores = new Map();
      ['flashcards', 'due_reviews', 'sync_queue'].forEach((name) => {
        mockStores.set(name, new Map<string, unknown>());
      });

      return {
        objectStoreNames: {
          contains: (name: string) => mockStores.has(name),
        },
        createObjectStore: (name: string) => {
          if (!mockStores.has(name)) {
            mockStores.set(name, new Map<string, unknown>());
          }
          return { createIndex: () => undefined };
        },
        transaction: (_storeNames: string | string[]) => {
          let oncompleteFn: (() => void) | null = null;

          const tx = {
            get oncomplete() { return oncompleteFn; },
            set oncomplete(fn: (() => void) | null) { oncompleteFn = fn; },
            get onerror() { return null; },
            set onerror(_fn: (() => void) | null) {},
            objectStore: (name: string) => {
              const storeData = mockStores.get(name) || new Map<string, unknown>();
              return {
                put: (value: unknown) => {
                  const record = value as Record<string, unknown>;
                  const key = record['id'];
                  if (key) storeData.set(String(key), value);
                  const req = makeRequest(value);
                  if (oncompleteFn) {
                    const origOnsuccess = req.onsuccess;
                    req.onsuccess = () => {
                      if (origOnsuccess) origOnsuccess();
                      oncompleteFn!();
                    };
                  }
                  return req;
                },
                getAll: () => makeRequest(Array.from(storeData.values())),
                clear: () => {
                  storeData.clear();
                  const req = makeRequest();
                  if (oncompleteFn) {
                    const origOnsuccess = req.onsuccess;
                    req.onsuccess = () => {
                      if (origOnsuccess) origOnsuccess();
                      oncompleteFn!();
                    };
                  }
                  return req;
                },
                delete: (key: string) => {
                  storeData.delete(key);
                  return makeRequest();
                },
              };
            },
          };
          return tx;
        },
      };
    }

    beforeEach(() => {
      mockStores = new Map();
      const mockDB = createMockDB();

      vi.stubGlobal('indexedDB', {
        open: vi.fn(() => {
          const req: any = {
            result: null as unknown,
            error: null,
          };
          let _onsuccess: (() => void) | null = null;
          let _onerror: (() => void) | null = null;
          let _onupgradeneeded: ((event: unknown) => void) | null = null;
          Object.defineProperty(req, 'onsuccess', {
            get: () => _onsuccess,
            set: (fn) => { _onsuccess = fn; },
          });
          Object.defineProperty(req, 'onerror', {
            get: () => _onerror,
            set: (fn) => { _onerror = fn; },
          });
          Object.defineProperty(req, 'onupgradeneeded', {
            get: () => _onupgradeneeded,
            set: (fn) => { _onupgradeneeded = fn; },
          });
          setTimeout(() => {
            if (_onupgradeneeded) {
              _onupgradeneeded({ target: { result: mockDB } });
            }
            req.result = mockDB;
            if (_onsuccess) {
              _onsuccess();
            }
          }, 0);
          return req;
        }),
        deleteDatabase: vi.fn(),
      });
    });

    it('should initialise DB and have pendingSyncCount 0', async () => {
      service = new SrsOfflineService();
      await new Promise((r) => setTimeout(r, 20));
      expect(service.pendingSyncCount()).toBe(0);
    });

    it('should cache and retrieve flashcards', async () => {
      service = new SrsOfflineService();
      await new Promise((r) => setTimeout(r, 20));

      await service.cacheFlashcards([mockFlashcard]);
      const result = await service.getCachedFlashcards();

      expect(result.length).toBe(1);
      const first = result[0] as unknown as Record<string, unknown>;
      expect(first['word_token']).toBe('hello');
    });

    it('should cache and retrieve due reviews', async () => {
      service = new SrsOfflineService();
      await new Promise((r) => setTimeout(r, 20));

      await service.cacheDueReviews([mockFlashcard]);
      const result = await service.getCachedDueReviews();

      expect(result.length).toBe(1);
      const first = result[0] as unknown as Record<string, unknown>;
      expect(first['word_token']).toBe('hello');
    });

    it('should queue a review and increment pendingSyncCount', async () => {
      service = new SrsOfflineService();
      await new Promise((r) => setTimeout(r, 20));

      await service.queueSrsReview('card1', 4, 2);
      expect(service.pendingSyncCount()).toBe(1);
    });

    it('should sync queued reviews without error', async () => {
      service = new SrsOfflineService();
      await new Promise((r) => setTimeout(r, 20));

      const syncFn = vi.fn().mockResolvedValue(undefined);
      const result = await service.syncQueuedReviews(syncFn);
      expect(result).toEqual({ synced: 0, failed: 0 });
    }, 10000);
  });
});

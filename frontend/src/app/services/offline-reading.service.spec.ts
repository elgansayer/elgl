import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OfflineReadingService } from './offline-reading.service';

describe.skip('OfflineReadingService', () => {
  let service: OfflineReadingService;
  let mockStores: Map<string, Map<string, unknown>>;
  let openCallbacks: {
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
    onupgradeneeded: ((event: unknown) => void) | null;
  };
  let autoIncrementCounter = 0;

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

  function createMockDB() {
    mockStores = new Map();
    mockStores.set('articles', new Map<string, unknown>());
    mockStores.set('reading_history', new Map<string, unknown>());
    autoIncrementCounter = 0;

    return {
      objectStoreNames: {
        contains: (name: string) => mockStores.has(name),
      },
      createObjectStore: (name: string, opts?: { keyPath?: string; autoIncrement?: boolean }) => {
        if (!mockStores.has(name)) {
          mockStores.set(name, new Map<string, unknown>());
          if (opts?.autoIncrement) {
            (mockStores.get(name) as any)._autoIncrement = true;
          }
        }
        return { createIndex: () => undefined };
      },
      transaction: (_storeNames: string | string[]) => {
        let oncompleteFn: (() => void) | null = null;

        return {
          get oncomplete() { return oncompleteFn; },
          set oncomplete(fn: (() => void) | null) { oncompleteFn = fn; },
          get onerror() { return null; },
          set onerror(_fn: (() => void) | null) {},
          objectStore: (name: string) => {
            const storeData = mockStores.get(name) || new Map<string, unknown>();
            return {
              put: (value: unknown) => {
                const record = value as Record<string, unknown>;
                let key = record['id'];
                if (!key) {
                  autoIncrementCounter++;
                  key = autoIncrementCounter;
                  record['id'] = key;
                }
                if (key) storeData.set(String(key), value);
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
                  if (oncompleteFn) { const fn = oncompleteFn; fn(); }
                }, 0);
                return req;
              },
              clear: () => {
                storeData.clear();
                if (oncompleteFn) { const fn = oncompleteFn; setTimeout(() => fn(), 0); }
                const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
                setTimeout(() => {
                  if (req.onsuccess) req.onsuccess();
                }, 0);
                return req;
              },
              delete: (key: string) => {
                storeData.delete(key);
                const req = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
                setTimeout(() => {
                  if (req.onsuccess) req.onsuccess();
                }, 0);
                return req;
              },
            };
          },
        };
      },
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe.skip('no IndexedDB', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
    });

    it('should create via TestBed', () => {
      const testBed = TestBed.configureTestingModule({
        providers: [OfflineReadingService],
      });
      service = testBed.inject(OfflineReadingService);
      expect(service).toBeTruthy();
    });

    it('should return empty articles', async () => {
      const testBed = TestBed.configureTestingModule({
        providers: [OfflineReadingService],
      });
      service = testBed.inject(OfflineReadingService);
      const result = await service.getCachedArticles();
      expect(result).toEqual([]);
    });

    it('should return empty history', async () => {
      const testBed = TestBed.configureTestingModule({
        providers: [OfflineReadingService],
      });
      service = testBed.inject(OfflineReadingService);
      const result = await service.getReadingHistory();
      expect(result).toEqual([]);
    });

    it('should not throw on cacheArticles', async () => {
      const testBed = TestBed.configureTestingModule({
        providers: [OfflineReadingService],
      });
      service = testBed.inject(OfflineReadingService);
      await expect(service.cacheArticles([
        { id: '1', title: 'Test', content: 'test', language: 'en', difficulty: 'beginner', topic: 'test', wordCount: 1, cachedAt: 0 },
      ])).resolves.toBeUndefined();
    });
  });

  describe.skip('with IndexedDB', () => {
    beforeEach(() => {
      autoIncrementCounter = 0;
      mockStores = new Map();
      const mockOpenRequest = createMockOpenRequest();
      const mockDB = createMockDB();

      vi.stubGlobal('indexedDB', {
        open: vi.fn(() => {
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

      const testBed = TestBed.configureTestingModule({
        providers: [OfflineReadingService],
      });
      service = testBed.inject(OfflineReadingService);
    });

    it('should create', () => {
      expect(service).toBeTruthy();
    });

    it('should cache and retrieve articles', async () => {
      await new Promise((r) => setTimeout(r, 20));

      await service.cacheArticles([
        { id: '1', title: 'Test Article', content: 'content', language: 'en', difficulty: 'beginner', topic: 'test', wordCount: 100, cachedAt: 0 },
      ]);

      const articles = await service.getCachedArticles();
      expect(articles.length).toBe(1);
      expect(articles[0].title).toBe('Test Article');
    });

    it.skip('should record and retrieve reading history', async () => {
      await new Promise((r) => setTimeout(r, 20));

      await service.recordReadingHistory('art1', 'Some Article', 'intermediate', 'science');
      await service.recordReadingHistory('art2', 'Another Article', 'advanced', 'culture');

      const history = await service.getReadingHistory();
      expect(history.length).toBe(2);
      expect(history[0].title).toBe('Another Article');
    });

    it('should clear all data', async () => {
      await new Promise((r) => setTimeout(r, 20));

      await service.cacheArticles([
        { id: '1', title: 'Test', content: 'test', language: 'en', difficulty: 'beginner', topic: 'test', wordCount: 1, cachedAt: 0 },
      ]);
      await service.recordReadingHistory('art1', 'Test', 'beginner', 'test');

      await service.clearAll();

      const articles = await service.getCachedArticles();
      const history = await service.getReadingHistory();
      expect(articles).toEqual([]);
      expect(history).toEqual([]);
    });
  });
});

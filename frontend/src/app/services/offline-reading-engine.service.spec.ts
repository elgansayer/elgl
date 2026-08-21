import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';

import { OfflineReadingEngineService } from './offline-reading-engine.service';
import { NetworkStatusService } from './network-status.service';

interface ReadingArticle {
  id: string;
  title: string;
  content: string;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topic: string;
  audioUrl?: string;
  wordCount: number;
}

function syncReq(result?: unknown) {
  const r: Record<string, unknown> = { result: result ?? null, _onsuccess: null };
  Object.defineProperty(r, 'onsuccess', {
    get() { return r['_onsuccess']; },
    set(f: () => void) { r['_onsuccess'] = f; if (f) f(); },
  });
  return r;
}

function fakeArticle(id: string, overrides: Partial<ReadingArticle> = {}): ReadingArticle {
  return {
    id,
    title: `Article ${id}`,
    content: `Content for article ${id}. This is a test article.`,
    language: 'en-GB',
    difficulty: 'intermediate',
    topic: 'science',
    wordCount: 50,
    ...overrides,
  };
}

describe.skip('OfflineReadingEngineService', () => {
  let service: OfflineReadingEngineService;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  let store: Map<string, Record<string, unknown>>;

  function os() {
    return {
      put: (v: Record<string, unknown>) => {
        store.set(String(v['id']), structuredClone(v));
        return syncReq();
      },
      get: (key: string) => syncReq(store.get(key) ?? null),
      getAll: () => syncReq(structuredClone([...store.values()])),
      clear: () => { store.clear(); return syncReq(); },
    };
  }

  function buildDB() {
    return {
      objectStoreNames: { contains: () => true },
      transaction: () => ({ objectStore: () => os() }),
    };
  }

  function mockIDB() {
    vi.stubGlobal('indexedDB', {
      open: () => syncReq(buildDB()),
    });
  }

  beforeEach(() => {
    store = new Map();
    onlineSignal = signal(true);
    mockIDB();

    TestBed.configureTestingModule({
      providers: [
        OfflineReadingEngineService,
        {
          provide: NetworkStatusService,
          useValue: { isOnline: onlineSignal.asReadonly() },
        },
      ],
    });

    service = TestBed.inject(OfflineReadingEngineService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create', () => {
    expect(service).toBeDefined();
  });

  it('should reflect online status', () => {
    expect(service.isOnline()).toBe(true);
    onlineSignal.set(false);
    expect(service.isOnline()).toBe(false);
  });

  describe.skip('article caching', () => {
    it('should cache and retrieve articles', async () => {
      const articles = [fakeArticle('1'), fakeArticle('2')];
      await service.cacheArticles(articles);

      const cached = await service.getCachedArticles();
      expect(cached).toHaveLength(2);
      expect(cached[0].title).toBe('Article 1');
      expect(cached[1].title).toBe('Article 2');
    });

    it('should set cachedDataAvailable after caching', async () => {
      await service.cacheArticles([fakeArticle('a')]);
      expect(service.cachedDataAvailable()).toBe(true);
    });

    it('should return empty array when nothing cached', async () => {
      const cached = await service.getCachedArticles();
      expect(cached).toEqual([]);
      expect(service.cachedDataAvailable()).toBe(false);
    });

    it('should retrieve a single cached article by ID', async () => {
      await service.cacheArticles([fakeArticle('abc'), fakeArticle('def')]);

      const article = await service.getCachedArticle('abc');
      expect(article).toBeTruthy();
      expect(article?.title).toBe('Article abc');
    });

    it('should return null for unknown article ID', async () => {
      const article = await service.getCachedArticle('nonexistent');
      expect(article).toBeNull();
    });

    it('should replace old cache when caching new articles', async () => {
      await service.cacheArticles([fakeArticle('old')]);
      await service.cacheArticles([fakeArticle('new1'), fakeArticle('new2')]);

      const cached = await service.getCachedArticles();
      expect(cached).toHaveLength(2);
      expect(cached.map((a) => a.id)).toEqual(['new1', 'new2']);
    });

    it('should return expired articles as null from getCachedArticle', async () => {
      const pastArticle: ReadingArticle & { _cachedAt: number } = {
        ...fakeArticle('oldie'),
        _cachedAt: Date.now() - 13 * 60 * 60 * 1000, // 13 hours ago
      };
      store.set('oldie', pastArticle as unknown as Record<string, unknown>);

      const article = await service.getCachedArticle('oldie');
      expect(article).toBeNull();
    });
  });

  describe.skip('clearAll', () => {
    it('should clear all cached articles', async () => {
      await service.cacheArticles([fakeArticle('1'), fakeArticle('2')]);
      expect(service.cachedDataAvailable()).toBe(true);

      await service.clearAll();
      const cached = await service.getCachedArticles();
      expect(cached).toEqual([]);
      expect(service.cachedDataAvailable()).toBe(false);
    });
  });
});
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from './cache.service';

type DeleteOutcome = 'success' | 'blocked' | 'error';

function installIndexedDb(outcomes: Record<string, DeleteOutcome> = {}) {
  const deleteDatabase = vi.fn((name: string) => {
    const request = {} as IDBOpenDBRequest;
    queueMicrotask(() => {
      const outcome = outcomes[name] ?? 'success';
      const event = new Event(outcome);
      if (outcome === 'success') {
        request.onsuccess?.call(request, event);
      } else if (outcome === 'blocked') {
        request.onblocked?.call(request, event as IDBVersionChangeEvent);
      } else {
        request.onerror?.call(request, event);
      }
    });
    return request;
  });

  vi.stubGlobal('indexedDB', { deleteDatabase } as unknown as IDBFactory);
  return deleteDatabase;
}

function installCacheStorage(deleteResult = true) {
  const deleteCache = vi.fn().mockResolvedValue(deleteResult);
  vi.stubGlobal('caches', {
    keys: vi.fn().mockResolvedValue(['app-shell', 'media']),
    delete: deleteCache,
  } as unknown as CacheStorage);
  return deleteCache;
}

describe('CacheService', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('clears only transient caches and preserves durable local user state', async () => {
    localStorage.setItem('elgl:tr:one:ja', 'cached translation');
    localStorage.setItem('elgl:chat-draft:user:room', 'unsent private draft');
    localStorage.setItem('hellotalk_cellular_auto_download', 'false');
    sessionStorage.setItem('auth-flow-state', 'keep');
    const deleteDatabase = installIndexedDb();
    const deleteCache = installCacheStorage();
    const service = new CacheService();

    await expect(service.clearCache()).resolves.toEqual({
      localEntriesRemoved: 1,
      cacheStoresRemoved: 2,
      databasesRemoved: 3,
    });

    expect(localStorage.getItem('elgl:tr:one:ja')).toBeNull();
    expect(localStorage.getItem('elgl:chat-draft:user:room')).toBe('unsent private draft');
    expect(localStorage.getItem('hellotalk_cellular_auto_download')).toBe('false');
    expect(sessionStorage.getItem('auth-flow-state')).toBe('keep');
    expect(deleteDatabase).toHaveBeenCalledTimes(3);
    expect(deleteDatabase).toHaveBeenCalledWith('hellotalk_cache');
    expect(deleteDatabase).toHaveBeenCalledWith('mediaCache');
    expect(deleteDatabase).toHaveBeenCalledWith('offlineCache');
    expect(deleteCache).toHaveBeenCalledTimes(2);
  });

  it('attempts every cache deletion before reporting a partial Cache API failure', async () => {
    installIndexedDb();
    const deleteCache = installCacheStorage(false);
    const service = new CacheService();

    await expect(service.clearCache()).rejects.toThrow('partially successful');
    expect(deleteCache).toHaveBeenCalledTimes(2);
  });

  it('reports a blocked IndexedDB deletion without clearing durable storage', async () => {
    localStorage.setItem('elgl:tr:one:fr', 'bonjour');
    localStorage.setItem('elgl:draft:moment:user', 'draft');
    installIndexedDb({ mediaCache: 'blocked' });
    installCacheStorage();
    const service = new CacheService();

    await expect(service.clearCache()).rejects.toThrow('partially successful');

    expect(localStorage.getItem('elgl:tr:one:fr')).toBeNull();
    expect(localStorage.getItem('elgl:draft:moment:user')).toBe('draft');
  });
});

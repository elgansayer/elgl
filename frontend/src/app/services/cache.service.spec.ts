import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from './cache.service';

function installIndexedDb(): ReturnType<typeof vi.fn> {
  const deleteDatabase = vi.fn(() => {
    const request = {} as IDBOpenDBRequest;
    queueMicrotask(() => request.onsuccess?.call(request, new Event('success')));
    return request;
  });
  vi.stubGlobal('indexedDB', { deleteDatabase } as unknown as IDBFactory);
  return deleteDatabase;
}

function installCacheStorage(): {
  keys: ReturnType<typeof vi.fn>;
  deleteCache: ReturnType<typeof vi.fn>;
} {
  const keys = vi.fn().mockResolvedValue(['application', 'media']);
  const deleteCache = vi.fn().mockResolvedValue(true);
  vi.stubGlobal('caches', {
    keys,
    delete: deleteCache,
  } as unknown as CacheStorage);
  return { keys, deleteCache };
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

  it('clears app cache stores without deleting authentication, drafts, or preferences', async () => {
    localStorage.setItem('sb-project-auth-token', 'secret-session');
    localStorage.setItem('hellotalk_cellular_auto_download', 'false');
    sessionStorage.setItem('chat-draft', 'unsent message');
    const deleteDatabase = installIndexedDb();
    const cacheStorage = installCacheStorage();
    const service = new CacheService();

    await service.clearCache();

    expect(deleteDatabase.mock.calls.map(([name]) => name)).toEqual([
      'hellotalk_cache',
      'mediaCache',
      'offlineCache',
    ]);
    expect(cacheStorage.keys).toHaveBeenCalledTimes(1);
    expect(cacheStorage.deleteCache).toHaveBeenCalledWith('application');
    expect(cacheStorage.deleteCache).toHaveBeenCalledWith('media');
    expect(localStorage.getItem('sb-project-auth-token')).toBe('secret-session');
    expect(localStorage.getItem('hellotalk_cellular_auto_download')).toBe('false');
    expect(sessionStorage.getItem('chat-draft')).toBe('unsent message');
  });

  it('works when browser cache APIs are unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('caches', undefined);
    const service = new CacheService();

    await expect(service.clearCache()).resolves.toBeUndefined();
  });

  it('reports a cache deletion failure without clearing user Web Storage', async () => {
    localStorage.setItem('sb-project-auth-token', 'secret-session');
    installIndexedDb();
    vi.stubGlobal('caches', {
      keys: vi.fn().mockRejectedValue(new Error('cache unavailable')),
    } as unknown as CacheStorage);
    const service = new CacheService();

    await expect(service.clearCache()).rejects.toThrow('Unable to clear local cache');
    expect(localStorage.getItem('sb-project-auth-token')).toBe('secret-session');
  });
});

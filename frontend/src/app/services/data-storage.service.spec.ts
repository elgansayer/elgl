import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStorageService } from './data-storage.service';

function storageSize(): number {
  return (
    new Blob([JSON.stringify(localStorage)]).size + new Blob([JSON.stringify(sessionStorage)]).size
  );
}

function cacheWith(responses: Response[]): Cache {
  return {
    matchAll: vi.fn().mockResolvedValue(responses),
  } as unknown as Cache;
}

function installCacheStorage(cachesByName: Map<string, Cache>): {
  open: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
} {
  const open = vi.fn((name: string) => Promise.resolve(cachesByName.get(name)));
  const deleteCache = vi.fn().mockResolvedValue(true);
  vi.stubGlobal('caches', {
    keys: vi.fn().mockResolvedValue([...cachesByName.keys()]),
    open,
    delete: deleteCache,
  } as unknown as CacheStorage);
  return { open, delete: deleteCache };
}

describe('DataStorageService', () => {
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

  it('loads and persists the cellular auto-download preference', () => {
    localStorage.setItem('hellotalk_cellular_auto_download', 'false');
    const service = new DataStorageService();

    expect(service.cellularAutoDownload()).toBe(false);

    service.toggleCellularAutoDownload();

    expect(service.cellularAutoDownload()).toBe(true);
    expect(localStorage.getItem('hellotalk_cellular_auto_download')).toBe('true');
  });

  it('clears browser storage and every named cache while preserving the preference', async () => {
    localStorage.setItem('temporary', 'value');
    sessionStorage.setItem('temporary', 'value');
    const cacheStorage = installCacheStorage(
      new Map([
        ['application', cacheWith([])],
        ['media', cacheWith([])],
      ]),
    );
    const service = new DataStorageService();

    service.clearLocalCache();
    await vi.waitFor(() => expect(cacheStorage.delete).toHaveBeenCalledTimes(2));

    expect(localStorage.getItem('temporary')).toBeNull();
    expect(sessionStorage.getItem('temporary')).toBeNull();
    expect(localStorage.getItem('hellotalk_cellular_auto_download')).toBe('true');
    expect(cacheStorage.delete).toHaveBeenCalledWith('application');
    expect(cacheStorage.delete).toHaveBeenCalledWith('media');
  });

  it('estimates named caches concurrently from valid content-length headers', async () => {
    const first = new Response('ignored', { headers: { 'content-length': '12' } });
    const second = new Response('ignored', { headers: { 'content-length': '30' } });
    const firstClone = vi.spyOn(first, 'clone');
    const secondClone = vi.spyOn(second, 'clone');
    const applicationCache = cacheWith([first]);
    const mediaCache = cacheWith([second]);
    const cacheStorage = installCacheStorage(
      new Map([
        ['application', applicationCache],
        ['media', mediaCache],
      ]),
    );
    const service = new DataStorageService();

    const size = await service.estimateCacheSize();

    expect(size).toBe(storageSize() + 42);
    expect(cacheStorage.open).toHaveBeenCalledTimes(2);
    expect(applicationCache.matchAll).toHaveBeenCalledTimes(1);
    expect(mediaCache.matchAll).toHaveBeenCalledTimes(1);
    expect(firstClone).not.toHaveBeenCalled();
    expect(secondClone).not.toHaveBeenCalled();
  });

  it.each(['not-a-number', '12bytes', '-1', '1.5', ''])(
    'falls back to the response body for invalid content-length %j',
    async (contentLength) => {
      const response = new Response('four', { headers: { 'content-length': contentLength } });
      const clone = vi.spyOn(response, 'clone');
      installCacheStorage(new Map([['application', cacheWith([response])]]));
      const service = new DataStorageService();

      const size = await service.estimateCacheSize();

      expect(size).toBe(storageSize() + 4);
      expect(clone).toHaveBeenCalledTimes(1);
    },
  );

  it('falls back to the response body when content-length is absent', async () => {
    const response = new Response('fallback');
    const clone = vi.spyOn(response, 'clone');
    installCacheStorage(new Map([['application', cacheWith([response])]]));
    const service = new DataStorageService();

    const size = await service.estimateCacheSize();

    expect(size).toBe(storageSize() + 8);
    expect(clone).toHaveBeenCalledTimes(1);
  });

  it('keeps the storage estimate available when the Cache API fails', async () => {
    vi.stubGlobal('caches', {
      keys: vi.fn().mockRejectedValue(new Error('cache unavailable')),
    } as unknown as CacheStorage);
    localStorage.setItem('saved', 'value');
    const service = new DataStorageService();

    await expect(service.estimateCacheSize()).resolves.toBe(storageSize());
  });
});

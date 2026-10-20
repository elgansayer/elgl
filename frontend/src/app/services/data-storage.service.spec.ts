import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStorageService } from './data-storage.service';

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

function localEntrySize(key: string): number {
  return new Blob([key, localStorage.getItem(key) ?? '']).size;
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

  it('supports idempotent explicit cellular preference updates', () => {
    localStorage.setItem('hellotalk_cellular_auto_download', 'true');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const service = new DataStorageService();

    service.setCellularAutoDownload(true);
    expect(setItem).not.toHaveBeenCalled();

    service.setCellularAutoDownload(false);
    expect(setItem).toHaveBeenCalledWith('hellotalk_cellular_auto_download', 'false');
    expect(service.cellularAutoDownload()).toBe(false);
  });

  it('counts transient local cache entries but excludes drafts, preferences, and session data', async () => {
    localStorage.setItem('elgl:tr:first:ja', '{"value":"一"}');
    localStorage.setItem('elgl:chat-draft:user:room', 'private unsent draft');
    localStorage.setItem('hellotalk_cellular_auto_download', 'false');
    sessionStorage.setItem('active-session-state', 'keep me');
    vi.stubGlobal('caches', undefined);
    const service = new DataStorageService();

    await expect(service.estimateCacheSize()).resolves.toBe(localEntrySize('elgl:tr:first:ja'));
  });

  it('estimates named Cache API stores concurrently from valid content-length headers', async () => {
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

    expect(size).toBe(42);
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

      expect(size).toBe(4);
      expect(clone).toHaveBeenCalledTimes(1);
    },
  );

  it('falls back to the response body when content-length is absent', async () => {
    const response = new Response('fallback');
    const clone = vi.spyOn(response, 'clone');
    installCacheStorage(new Map([['application', cacheWith([response])]]));
    const service = new DataStorageService();

    const size = await service.estimateCacheSize();

    expect(size).toBe(8);
    expect(clone).toHaveBeenCalledTimes(1);
  });

  it('keeps the local cache estimate available when the Cache API fails', async () => {
    localStorage.setItem('elgl:tr:first:es', 'hola');
    vi.stubGlobal('caches', {
      keys: vi.fn().mockRejectedValue(new Error('cache unavailable')),
    } as unknown as CacheStorage);
    const service = new DataStorageService();

    await expect(service.estimateCacheSize()).resolves.toBe(localEntrySize('elgl:tr:first:es'));
  });
});

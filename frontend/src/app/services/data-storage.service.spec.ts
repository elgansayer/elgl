import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStorageService } from './data-storage.service';

function cacheWith(responses: Response[]): Cache {
  return {
    matchAll: vi.fn().mockResolvedValue(responses),
  } as unknown as Cache;
}

function installCacheStorage(cachesByName: Map<string, Cache>): {
  open: ReturnType<typeof vi.fn>;
} {
  const open = vi.fn((name: string) => Promise.resolve(cachesByName.get(name)));
  vi.stubGlobal('caches', {
    keys: vi.fn().mockResolvedValue([...cachesByName.keys()]),
    open,
    delete: vi.fn().mockResolvedValue(true),
  } as unknown as CacheStorage);
  return { open };
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

  it('returns zero when the Cache API is unavailable without counting user Web Storage as cache', async () => {
    localStorage.setItem('sb-project-auth-token', 'secret-session');
    sessionStorage.setItem('chat-draft', 'unsent message');
    vi.stubGlobal('caches', undefined);
    const service = new DataStorageService();

    await expect(service.estimateCacheSize()).resolves.toBe(0);
    expect(localStorage.getItem('sb-project-auth-token')).toBe('secret-session');
    expect(sessionStorage.getItem('chat-draft')).toBe('unsent message');
  });

  it('returns zero when cache estimation fails', async () => {
    vi.stubGlobal('caches', {
      keys: vi.fn().mockRejectedValue(new Error('cache unavailable')),
    } as unknown as CacheStorage);
    const service = new DataStorageService();

    await expect(service.estimateCacheSize()).resolves.toBe(0);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from './cache.service';

function installIndexedDbDeleteStub(): ReturnType<typeof vi.fn> {
  const deleteDatabase = vi.fn(() => {
    const request = {} as IDBOpenDBRequest;
    queueMicrotask(() => request.onsuccess?.(new Event('success')));
    return request;
  });
  vi.stubGlobal('indexedDB', { deleteDatabase } as unknown as IDBFactory);
  return deleteDatabase;
}

describe('CacheService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('waits for every IndexedDB and Cache API deletion attempt', async () => {
    const deleteDatabase = installIndexedDbDeleteStub();
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['application', 'media']),
      delete: deleteCache,
    } as unknown as CacheStorage);
    const service = new CacheService();

    await service.clearCache();

    expect(deleteDatabase).toHaveBeenCalledTimes(3);
    expect(deleteDatabase).toHaveBeenCalledWith('hellotalk_cache');
    expect(deleteDatabase).toHaveBeenCalledWith('mediaCache');
    expect(deleteDatabase).toHaveBeenCalledWith('offlineCache');
    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(deleteCache).toHaveBeenCalledWith('application');
    expect(deleteCache).toHaveBeenCalledWith('media');
  });

  it('continues clearing when browser storage and one Cache API deletion fail', async () => {
    vi.stubGlobal('localStorage', {
      clear: vi.fn(() => {
        throw new Error('local storage blocked');
      }),
    } as unknown as Storage);
    vi.stubGlobal('sessionStorage', {
      clear: vi.fn(() => {
        throw new Error('session storage blocked');
      }),
    } as unknown as Storage);
    installIndexedDbDeleteStub();
    const deleteCache = vi
      .fn()
      .mockRejectedValueOnce(new Error('broken cache'))
      .mockResolvedValueOnce(true);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['broken', 'healthy']),
      delete: deleteCache,
    } as unknown as CacheStorage);
    const service = new CacheService();

    await expect(service.clearCache()).resolves.toBeUndefined();

    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(deleteCache).toHaveBeenCalledWith('broken');
    expect(deleteCache).toHaveBeenCalledWith('healthy');
  });
});

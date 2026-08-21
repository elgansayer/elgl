import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { OfflineEconomyService } from './offline-economy.service';
import { NetworkStatusService } from './network-status.service';
import { VirtualGift, CoinPackage, StickerPack } from './economy.store';

/**
 * Synchronous mock for IndexedDB – fires onsuccess immediately when set.
 * Pattern matches the proven approach in offline-queue.service.spec.ts.
 */
function syncReq(result?: unknown) {
  const r: Record<string, unknown> = { result: result ?? null, _onsuccess: null };
  Object.defineProperty(r, 'onsuccess', {
    get() { return r['_onsuccess']; },
    set(f: () => void) { r['_onsuccess'] = f; if (f) f(); },
  });
  return r;
}

describe('OfflineEconomyService', () => {
  let service: OfflineEconomyService;
  let stores: Map<string, Map<string, Record<string, unknown>>>;

  function getStore(name: string): Map<string, Record<string, unknown>> {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  }

  function os(storeName: string) {
    const s = getStore(storeName);
    return {
      put: (v: Record<string, unknown>) => { s.set(String(v['id'] ?? v['key']), v); return syncReq(); },
      get: (key: string) => syncReq(s.get(key) ?? null),
      getAll: () => syncReq([...s.values()]),
      delete: (key: string) => { s.delete(key); return syncReq(); },
      clear: () => { s.clear(); return syncReq(); },
    };
  }

  function buildDB() {
    return {
      objectStoreNames: { contains: () => true },
      transaction: (sName: string) => ({ objectStore: () => os(sName) }),
    };
  }

  beforeEach(() => {
    stores = new Map();

    vi.stubGlobal('indexedDB', {
      open: () => {
        const db = buildDB();
        return syncReq(db);
      },
    });

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    TestBed.configureTestingModule({
      providers: [OfflineEconomyService, NetworkStatusService],
    });
    service = TestBed.inject(OfflineEconomyService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('balance caching', () => {
    it('should cache and retrieve balance', async () => {
      await service.cacheBalance(150);
      const cached = await service.getCachedBalance();
      expect(cached).not.toBeNull();
      expect(cached!.coinsBalance).toBe(150);
    });

    it('should return null when no balance cached', async () => {
      const cached = await service.getCachedBalance();
      expect(cached).toBeNull();
    });

    it('should overwrite previous cached balance', async () => {
      await service.cacheBalance(100);
      await service.cacheBalance(250);
      const cached = await service.getCachedBalance();
      expect(cached!.coinsBalance).toBe(250);
    });
  });

  describe('catalog caching', () => {
    it('should cache and retrieve gift catalog', async () => {
      const catalog: VirtualGift[] = [
        { id: 'g1', name: 'Rose', icon: '🌹', cost_coins: 10, animation_type: 'float' },
        { id: 'g2', name: 'Crown', icon: '👑', cost_coins: 50, animation_type: 'premium' },
      ];
      await service.cacheCatalog(catalog);
      const cached = await service.getCachedCatalog();
      expect(cached).toHaveLength(2);
    });

    it('should return empty array when no catalog cached', async () => {
      const cached = await service.getCachedCatalog();
      expect(cached).toEqual([]);
    });
  });

  describe('coin packages caching', () => {
    it('should cache and retrieve coin packages', async () => {
      const packages: CoinPackage[] = [
        { id: 'p1', name: 'Small', coins: 100, price_ukp: 4.99, price_usd: 5.99 },
      ];
      await service.cacheCoinPackages(packages);
      const cached = await service.getCachedCoinPackages();
      expect(cached).toHaveLength(1);
    });

    it('should return empty array when no packages cached', async () => {
      const cached = await service.getCachedCoinPackages();
      expect(cached).toEqual([]);
    });
  });

  describe('sticker packs caching', () => {
    it('should cache and retrieve sticker packs', async () => {
      const packs: StickerPack[] = [
        { id: 's1', name: 'Fun Pack', cost_coins: 20, owned: false },
      ];
      await service.cacheStickerPacks(packs);
      const cached = await service.getCachedStickerPacks();
      expect(cached).toHaveLength(1);
    });

    it('should return empty array when no stickers cached', async () => {
      const cached = await service.getCachedStickerPacks();
      expect(cached).toEqual([]);
    });
  });

  describe('pending action queue', () => {
    it('should enqueue and retrieve pending actions', async () => {
      const id = await service.enqueuePendingAction('send_gift', { giftId: 'g1', receiverId: 'u1' });
      expect(id).toBeTruthy();
      expect(service.pendingActionCount()).toBe(1);

      const pending = await service.getPendingActions();
      expect(pending).toHaveLength(1);
      expect(pending[0].actionType).toBe('send_gift');
    });

    it('should remove a pending action', async () => {
      const id = await service.enqueuePendingAction('unlock_sticker', { packId: 's1' });
      expect(service.pendingActionCount()).toBe(1);

      await service.removePendingAction(id);
      expect(service.pendingActionCount()).toBe(0);
    });

    it('should clear all pending actions', async () => {
      await service.enqueuePendingAction('send_gift', { giftId: 'g1' });
      await service.enqueuePendingAction('unlock_sticker', { packId: 's1' });
      expect(service.pendingActionCount()).toBe(2);

      await service.clearPendingActions();
      expect(service.pendingActionCount()).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all cached data and pending actions', async () => {
      await service.cacheBalance(100);
      await service.cacheCatalog([{ id: 'g1', name: 'Rose', icon: '🌹', cost_coins: 10, animation_type: 'float' }]);
      await service.enqueuePendingAction('send_gift', { giftId: 'g1' });
      expect(service.pendingActionCount()).toBe(1);

      await service.clearAll();

      const balance = await service.getCachedBalance();
      expect(balance).toBeNull();
      const catalog = await service.getCachedCatalog();
      expect(catalog).toEqual([]);
      expect(service.pendingActionCount()).toBe(0);
    });
  });

  describe('offline mode', () => {
    it('should start in online mode when navigator.onLine is true', () => {
      expect(service.isOfflineMode()).toBe(false);
    });
  });
});
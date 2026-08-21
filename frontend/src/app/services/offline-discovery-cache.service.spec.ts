import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';

import { OfflineDiscoveryCacheService } from './offline-discovery-cache.service';
import { NetworkStatusService } from './network-status.service';

function syncReq(result?: unknown) {
  const r: Record<string, unknown> = { result: result ?? null, ['_onsuccess']: null };
  Object.defineProperty(r, 'onsuccess', {
    get() { return r['_onsuccess']; },
    set(f: () => void) { r['_onsuccess'] = f; if (f) f(); },
  });
  return r;
}

function fakeProfile(id: string) {
  return {
    id,
    display_name: `User ${id}`,
    native_languages: ['en'],
    target_languages: ['es'],
    bio_text: 'Test bio',
    avatar_url: `https://i.pravatar.cc/150?u=${id}`,
    is_vip: false,
    vip_tier: 'free',
    coins_balance: 100,
    study_streak_days: 3,
    correction_ratio: 0.5,
    is_serious_learner: false,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    privacy_hide_gender: false,
    created_at: new Date().toISOString(),
  };
}

describe.skip('OfflineDiscoveryCacheService', () => {
  let service: OfflineDiscoveryCacheService;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  let stores: Map<string, Map<string, Record<string, unknown>>>;

  function getStore(name: string): Map<string, Record<string, unknown>> {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  }

  function os(storeName: string) {
    const s = getStore(storeName);
    return {
      put: (v: Record<string, unknown>) => {
        s.set(String(v['id'] ?? v['key']), structuredClone(v));
        return syncReq();
      },
      get: (key: string) => syncReq(s.get(key) ?? null),
      getAll: () => syncReq(structuredClone([...s.values()])),
      delete: (key: string) => { s.delete(key); return syncReq(); },
      clear: () => { s.clear(); return syncReq(); },
    };
  }

  function buildDB() {
    return {
      objectStoreNames: { contains: () => true },
      transaction: (_sName: string) => ({ objectStore: (name: string) => os(name) }),
    };
  }

  function mockIDB() {
    vi.stubGlobal('indexedDB', {
      open: () => syncReq(buildDB()),
      deleteDatabase: () => syncReq(undefined),
    });
  }

  beforeEach(async () => {
    stores = new Map();
    onlineSignal = signal(true);

    mockIDB();

    await TestBed.configureTestingModule({
      providers: [
        OfflineDiscoveryCacheService,
        {
          provide: NetworkStatusService,
          useValue: { isOnline: onlineSignal.asReadonly() },
        },
      ],
    }).compileComponents();

    service = TestBed.inject(OfflineDiscoveryCacheService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(service).toBeDefined();
  });

  it('should reflect online status from NetworkStatusService', () => {
    expect(service.isOnline()).toBe(true);
    onlineSignal.set(false);
    expect(service.isOnline()).toBe(false);
  });

  describe.skip('partner caching', () => {
    it('should cache and retrieve a single partner', async () => {
       
      await service.cachePartner(fakeProfile('p1') as any);

      const cached = await service.getCachedPartner('p1');
      expect(cached).toBeTruthy();
      expect(cached?.display_name).toBe('User p1');
    });

    it('should return null for unknown partner', async () => {
      const cached = await service.getCachedPartner('nonexistent');
      expect(cached).toBeNull();
    });

    it('should cache multiple partners at once', async () => {
       
      await service.cachePartners([fakeProfile('a'), fakeProfile('b')] as any);

      const all = await service.getAllCachedPartners();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when no partners are cached', async () => {
      const all = await service.getAllCachedPartners();
      expect(all).toEqual([]);
    });

    it('should set cachedDataAvailable after caching', async () => {
       
      await service.cachePartner(fakeProfile('p1') as any);
      expect(service.cachedDataAvailable()).toBe(true);
    });

    it('should return valid cached data for fresh partners', async () => {
       
      await service.cachePartner(fakeProfile('fresh') as any);

      const all = await service.getAllCachedPartners();
      expect(all.length).toBeGreaterThanOrEqual(1);
      expect(all.find((p) => p.id === 'fresh')).toBeTruthy();
    });
  });

  describe.skip('search result caching', () => {
    it('should cache and retrieve search results by filter key', async () => {
       
      await service.cacheSearchResults('target_language=JA&radius_metres=50000', [fakeProfile('s1'), fakeProfile('s2')] as any);

      const cached = await service.getCachedSearchResults('target_language=JA&radius_metres=50000');
      expect(cached).toHaveLength(2);
      expect(cached?.[0].id).toBe('s1');
    });

    it('should return null for unknown filter key', async () => {
      const cached = await service.getCachedSearchResults('unknown-key');
      expect(cached).toBeNull();
    });

    it('should build a deterministic filter key', () => {
      const key = service.buildFiltersKey({
        target_language: 'JA',
        radius_metres: 50000,
        gender: undefined,
        native_languages: '',
      });
      expect(key).toBe('radius_metres=50000&target_language=JA');
    });

    it('should return "default" for empty filter params', () => {
      const key = service.buildFiltersKey({});
      expect(key).toBe('default');
    });
  });

  describe.skip('clearAll', () => {
    it('should delete all cached data', async () => {
       
      await service.cachePartner(fakeProfile('p1') as any);
      await service.clearAll();

      const cached = await service.getCachedPartner('p1');
      expect(cached).toBeNull();
    });
  });
});
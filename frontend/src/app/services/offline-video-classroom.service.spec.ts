import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';

import { OfflineVideoClassroomService } from './offline-video-classroom.service';
import { NetworkStatusService } from './network-status.service';
import { AudioRoomRecord } from './audio-rooms.store';

function syncReq(result?: unknown) {
  const r: Record<string, unknown> = { result: result ?? null, _onsuccess: null };
  Object.defineProperty(r, 'onsuccess', {
    get() { return r['_onsuccess']; },
    set(f: () => void) { r['_onsuccess'] = f; if (f) f(); },
  });
  return r;
}

function fakeRoom(id: string): AudioRoomRecord {
  return {
    id,
    room_name: `Room ${id}`,
    title: `Classroom ${id}`,
    target_language: 'es',
    language_pair: 'en-es',
    topic_tag: 'travel',
    host_id: `host-${id}`,
    is_video_stream: true,
    is_active: true,
    speakers: [`host-${id}`],
    raised_hands: [],
    listeners_count: 5,
    created_at: new Date().toISOString(),
    host: {
      id: `host-${id}`,
      display_name: `Host ${id}`,
      avatar_url: null,
    },
  };
}

describe('OfflineVideoClassroomService', () => {
  let service: OfflineVideoClassroomService;
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
      openCursor: () => {
        const entries = [...s.values()].filter((v) => v && typeof v === 'object' && 'cachedAt' in v);
        return syncReq(entries.length > 0 ? { value: entries[0], continue: () => { /* noop */ } } : null);
      },
    };
  }

  function buildTx(_mode?: string) {
    let oncompleteFn: (() => void) | null = null;
    return {
      objectStore: (name: string) => os(name),
      get oncomplete() { return oncompleteFn; },
      set oncomplete(fn: (() => void) | null) {
        oncompleteFn = fn;
        // Fire oncomplete asynchronously so put() runs first
        if (fn) setTimeout(fn, 0);
      },
      get onerror() { return null; },
      set onerror(_fn: (() => void) | null) {},
    };
  }

  function buildDB() {
    return {
      objectStoreNames: { contains: () => true },
      transaction: (_sName: string, mode?: string) => buildTx(mode),
    };
  }

  function mockIDB() {
    vi.stubGlobal('indexedDB', {
      open: () => syncReq(buildDB()),
      deleteDatabase: (_name: string) => {
        stores = new Map();
        return syncReq(undefined);
      },
    });
  }

  beforeEach(async () => {
    stores = new Map();
    onlineSignal = signal(true);

    mockIDB();

    await TestBed.configureTestingModule({
      providers: [
        OfflineVideoClassroomService,
        {
          provide: NetworkStatusService,
          useValue: { isOnline: onlineSignal.asReadonly() },
        },
      ],
    }).compileComponents();

    service = TestBed.inject(OfflineVideoClassroomService);
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

  it('should signal offline mode when network is unavailable', () => {
    onlineSignal.set(false);
    window.dispatchEvent(new Event('offline'));
    expect(service.isOfflineMode()).toBe(true);
  });

  describe('classroom listing caching', () => {
    it('should cache and retrieve classroom listing', async () => {
      const rooms = [fakeRoom('r1'), fakeRoom('r2')];
      await service.cacheClassroomListing(rooms);

      const cached = await service.getCachedClassroomListing();
      expect(cached).toHaveLength(2);
      expect(cached?.[0].id).toBe('r1');
    });

    it('should return null when no listing is cached', async () => {
      const cached = await service.getCachedClassroomListing();
      expect(cached).toBeNull();
    });

    it('should cache and retrieve listing with a filter key', async () => {
      const rooms = [fakeRoom('ja-room')];
      await service.cacheClassroomListing(rooms, 'language_pair=JA-EN');

      const cached = await service.getCachedClassroomListing('language_pair=JA-EN');
      expect(cached).toHaveLength(1);
      expect(cached?.[0].id).toBe('ja-room');
    });

    it('should return null when filter key does not match', async () => {
      await service.cacheClassroomListing([fakeRoom('r1')], 'en-es');
      const cached = await service.getCachedClassroomListing('ja-en');
      expect(cached).toBeNull();
    });

    it('should set cachedDataAvailable after caching', async () => {
      await service.cacheClassroomListing([fakeRoom('r1')]);
      expect(service.cachedDataAvailable()).toBe(true);
    });
  });

  describe('room detail caching', () => {
    it('should cache and retrieve a single room detail', async () => {
      const room = fakeRoom('room-detail-1');
      await service.cacheRoomDetail(room);

      const cached = await service.getCachedRoomDetail('room-detail-1');
      expect(cached).toBeTruthy();
      expect(cached?.title).toBe('Classroom room-detail-1');
    });

    it('should return null for unknown room detail', async () => {
      const cached = await service.getCachedRoomDetail('nonexistent');
      expect(cached).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('should clear all cached data', async () => {
      await service.cacheClassroomListing([fakeRoom('r1')]);
      await service.cacheRoomDetail(fakeRoom('d1'));

      await service.clearAll();

      const listing = await service.getCachedClassroomListing();
      const detail = await service.getCachedRoomDetail('d1');
      expect(listing).toBeNull();
      expect(detail).toBeNull();
    });

    it('should reset signals after clear', async () => {
      await service.cacheClassroomListing([fakeRoom('r1')]);
      await service.clearAll();

      expect(service.cachedDataAvailable()).toBe(false);
      expect(service.isOfflineMode()).toBe(false);
    });
  });

  describe('evictStaleEntries', () => {
    it('should evict stale entries', async () => {
      await service.cacheClassroomListing([fakeRoom('r1')]);
      await service.evictStaleEntries();

      const cached = await service.getCachedClassroomListing();
      // Should still be valid since it was just cached
      expect(cached).toHaveLength(1);
    });
  });
});
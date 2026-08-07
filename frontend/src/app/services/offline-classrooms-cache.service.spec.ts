import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';

import { OfflineClassroomsCacheService } from './offline-classrooms-cache.service';
import { NetworkStatusService } from './network-status.service';
import { AudioRoomRecord } from './audio-rooms.store';

function syncReq(result?: unknown) {
  const r: Record<string, unknown> = { result: result ?? null, _onsuccess: null };
  Object.defineProperty(r, 'onsuccess', {
    get() { return r._onsuccess; },
    set(f: () => void) { r._onsuccess = f; if (f) f(); },
  });
  return r;
}

function fakeRoom(id: string, overrides?: Partial<AudioRoomRecord>): AudioRoomRecord {
  return {
    id,
    room_name: `room_${id}`,
    title: `Room ${id}`,
    target_language: 'ja',
    language_pair: 'EN-JA',
    topic_tag: 'conversation',
    host_id: `host_${id}`,
    co_host_id: null,
    is_video_stream: true,
    is_active: true,
    speakers: [`host_${id}`],
    raised_hands: [],
    listeners_count: 5,
    created_at: new Date().toISOString(),
    host: { id: `host_${id}`, display_name: `Host ${id}`, avatar_url: null },
    ...overrides,
  };
}

function fakeLanguageGroup(langPair: string, count: number) {
  return {
    language_pair: langPair,
    count,
    rooms: [fakeRoom(`${langPair}-1`), fakeRoom(`${langPair}-2`)],
  };
}

describe('OfflineClassroomsCacheService', () => {
  let service: OfflineClassroomsCacheService;
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
        s.set(String(v.id ?? v.key), structuredClone(v));
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
      transaction: (_sName: string, _mode?: string) => {
        const tx: { oncomplete?: (() => void) | null; onerror?: (() => void) | null; objectStore: (name: string) => ReturnType<typeof os> } = {
          objectStore: (name: string) => os(name),
          oncomplete: null,
          onerror: null,
        };
        // Fire oncomplete asynchronously so .onsuccess fires first
        queueMicrotask(() => {
          if (tx.oncomplete) tx.oncomplete();
        });
        return tx;
      },
    };
  }

  function mockIDB() {
    vi.stubGlobal('indexedDB', {
      open: () => syncReq(buildDB()),
      deleteDatabase: () => {
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
        OfflineClassroomsCacheService,
        {
          provide: NetworkStatusService,
          useValue: { isOnline: onlineSignal.asReadonly() },
        },
      ],
    }).compileComponents();

    service = TestBed.inject(OfflineClassroomsCacheService);
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

  describe('room caching', () => {
    it('should cache and retrieve a single room', async () => {
      await service.cacheRoom(fakeRoom('r1'));

      const cached = await service.getCachedRoom('r1');
      expect(cached).toBeTruthy();
      expect(cached?.title).toBe('Room r1');
    });

    it('should return null for unknown room', async () => {
      const cached = await service.getCachedRoom('nonexistent');
      expect(cached).toBeNull();
    });

    it('should cache multiple rooms at once', async () => {
      await service.cacheRooms([fakeRoom('a'), fakeRoom('b')]);

      const all = await service.getAllCachedRooms();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when no rooms are cached', async () => {
      const all = await service.getAllCachedRooms();
      expect(all).toEqual([]);
    });

    it('should set cachedDataAvailable after caching', async () => {
      await service.cacheRoom(fakeRoom('r1'));
      expect(service.cachedDataAvailable()).toBe(true);
    });

    it('should return cached room with _cachedAt property from single room get', async () => {
      await service.cacheRoom(fakeRoom('r1'));
      const cached = await service.getCachedRoom('r1');
      expect(cached).toBeTruthy();
      expect((cached as Record<string, unknown>)._cachedAt).toBeTypeOf('number');
    });

    it('should strip _cachedAt from rooms in getAllCachedRooms', async () => {
      await service.cacheRoom(fakeRoom('r1'));
      const all = await service.getAllCachedRooms();
      expect(all.length).toBeGreaterThanOrEqual(1);
      expect((all[0] as Record<string, unknown>)._cachedAt).toBeUndefined();
    });
  });

  describe('language group caching', () => {
    it('should cache and retrieve language groups', async () => {
      const groups = [fakeLanguageGroup('EN-JA', 2), fakeLanguageGroup('EN-ES', 1)];
      await service.cacheLanguageGroups(groups);

      const cached = await service.getAllCachedLanguageGroups();
      expect(cached).toHaveLength(2);
      expect(cached[0].language_pair).toBe('EN-JA');
    });

    it('should return empty array when no groups cached', async () => {
      const cached = await service.getAllCachedLanguageGroups();
      expect(cached).toEqual([]);
    });
  });

  describe('clearAll', () => {
    it('should delete all cached rooms', async () => {
      await service.cacheRoom(fakeRoom('r1'));
      await service.clearAll();

      const cached = await service.getCachedRoom('r1');
      expect(cached).toBeNull();
    });

    it('should re-initialise DB and mark cached data as available after clearing', async () => {
      await service.cacheRoom(fakeRoom('r1'));
      await service.clearAll();

      // After clearAll, the service re-initialises IndexedDB
      // and cachedDataAvailable should be true if the re-init succeeded
      expect(service.cachedDataAvailable()).toBe(true);
    });
  });
});
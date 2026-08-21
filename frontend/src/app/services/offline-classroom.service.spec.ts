import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { OfflineClassroomService, ClassroomListing } from './offline-classroom.service';
import { NetworkStatusService } from './network-status.service';

/**
 * Synchronous mock for IDBRequest -- fires onsuccess via setTimeout so the
 * service's Promise wrappers resolve predictably.
 */
function idbReq(result?: unknown) {
  const r: Record<string, unknown> & {
    on_success: (() => void) | null;
    on_error: ((e: unknown) => void) | null;
    on_upgrade_needed: ((e: unknown) => void) | null;
  } = { result: result ?? null, on_success: null, on_error: null, on_upgrade_needed: null };
  Object.defineProperty(r, 'onsuccess', {
    get() { return r.on_success; },
    set(f: (() => void) | null) { r.on_success = f; if (f) setTimeout(f, 0); },
  });
  Object.defineProperty(r, 'onerror', {
    get() { return r.on_error; },
    set(f: ((e: unknown) => void) | null) { r.on_error = f; },
  });
  Object.defineProperty(r, 'onupgradeneeded', {
    get() { return r.on_upgrade_needed; },
    set(f: ((e: unknown) => void) | null) { r.on_upgrade_needed = f; },
  });
  return r;
}

describe('OfflineClassroomService', () => {
  let service: OfflineClassroomService;
  let stores: Map<string, Map<string, Record<string, unknown>>>;

  const mockListing: ClassroomListing = {
    id: 'room-1',
    title: 'English Conversation Practice',
    description: 'Practice speaking English with native speakers',
    host_id: 'user-1',
    host_name: 'Alice',
    host_avatar_url: null,
    language: 'English',
    level: 'intermediate',
    participant_count: 3,
    max_participants: 8,
    is_live: true,
    scheduled_at: null,
    tags: ['conversation', 'speaking'],
    thumbnail_url: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  };

  const mockListing2: ClassroomListing = {
    ...mockListing,
    id: 'room-2',
    title: 'Spanish Beginners',
    language: 'Spanish',
    level: 'beginner',
  };

  function getStore(name: string): Map<string, Record<string, unknown>> {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  }

  function createTransaction() {
    let completeCallback: (() => void) | null = null;
    return {
      objectStore: (name: string) => {
        const s = getStore(name);
        return {
          put: (v: Record<string, unknown>) => {
            s.set(String(v['id'] ?? v['key'] ?? 'unknown'), v);
            return idbReq();
          },
          get: (key: string) => idbReq(s.get(key) ?? null),
          getAll: () => idbReq([...s.values()]),
          delete: (key: string) => { s.delete(key); return idbReq(); },
          clear: () => { s.clear(); return idbReq(); },
        };
      },
      get oncomplete() { return completeCallback; },
      set oncomplete(f: (() => void) | null) {
        completeCallback = f;
        if (f) setTimeout(f, 0);
      },
      get onerror() { return null; },
      set onerror(_f: ((e: unknown) => void) | null) {},
    };
  }

  beforeEach(() => {
    stores = new Map();

    const db = {
      objectStoreNames: { contains: () => true },
      transaction: () => createTransaction(),
    };

    vi.stubGlobal('indexedDB', {
      open: () => idbReq(db),
      deleteDatabase: () => idbReq(),
    });

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    TestBed.configureTestingModule({
      providers: [
        OfflineClassroomService,
        NetworkStatusService,
      ],
    });
    service = TestBed.inject(OfflineClassroomService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Flush pending microtasks so IndexedDB init finishes */
  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  describe('Online/Offline status tracking', () => {
    it('should report online initially', () => {
      expect(service.isOfflineMode()).toBe(false);
    });

    it('should report offline when navigator.onLine is false', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
      await flush();
      expect(service.isOfflineMode()).toBe(true);
    });

    it('should update online status when connectivity changes', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
      await flush();
      expect(service.isOfflineMode()).toBe(true);

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
      await flush();
      expect(service.isOfflineMode()).toBe(false);
    });
  });

  describe('Classroom listings cache', () => {
    it('should return empty array when no listings cached', async () => {
      await flush();
      const listings = await service.getCachedListings();
      expect(listings).toEqual([]);
    });

    it('should cache and retrieve listings', async () => {
      await flush();
      await service.cacheListings([mockListing, mockListing2]);
      const listings = await service.getCachedListings();
      expect(listings).toHaveLength(2);
      expect(listings[0].id).toBe('room-1');
      expect(listings[1].id).toBe('room-2');
    });

    it('should retrieve a single listing by ID', async () => {
      await flush();
      await service.cacheListings([mockListing, mockListing2]);
      const listing = await service.getCachedListingById('room-2');
      expect(listing).toBeTruthy();
      expect(listing?.title).toBe('Spanish Beginners');
    });

    it('should return null for unknown listing ID', async () => {
      await flush();
      const listing = await service.getCachedListingById('nonexistent');
      expect(listing).toBeNull();
    });

    it('should update last sync timestamp when caching', async () => {
      await flush();
      expect(service.lastSyncTimestamp()).toBeNull();
      await service.cacheListings([mockListing]);
      // cacheListings resolves before saveLastSyncTimestamp completes in the mock,
      // so flush pending timers to allow the nested metadata transaction to settle.
      await flush();
      expect(service.lastSyncTimestamp()).toBeGreaterThan(0);
    });

    it('should report cache freshness correctly', async () => {
      await flush();
      expect(service.isCacheFresh()).toBe(false);
      await service.cacheListings([mockListing]);
      await flush();
      expect(service.isCacheFresh()).toBe(true);
    });

    it('should clear listing cache', async () => {
      await flush();
      await service.cacheListings([mockListing]);
      await service.clearListingCache();
      const listings = await service.getCachedListings();
      expect(listings).toHaveLength(0);
    });
  });

  describe('Pending action queue', () => {
    it('should start with zero pending actions', () => {
      expect(service.pendingActionCount()).toBe(0);
    });

    it('should enqueue and retrieve pending actions', async () => {
      await flush();
      const id = await service.enqueueAction('join', 'room-1', { participant_name: 'Bob' });
      expect(id).toBeTruthy();
      expect(service.pendingActionCount()).toBe(1);

      const actions = await service.getPendingActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('join');
      expect(actions[0].classroomId).toBe('room-1');
      expect(actions[0].payload['participant_name']).toBe('Bob');
    });

    it('should enqueue multiple action types', async () => {
      await flush();
      await service.enqueueAction('join', 'room-1');
      await service.enqueueAction('leave', 'room-1');
      await service.enqueueAction('create', 'room-new', { title: 'New Room' });
      await service.enqueueAction('schedule', 'room-2');

      expect(service.pendingActionCount()).toBe(4);
      const actions = await service.getPendingActions();
      expect(actions).toHaveLength(4);
      expect(actions.map((a) => a.actionType)).toEqual(['join', 'leave', 'create', 'schedule']);
    });

    it('should remove a pending action', async () => {
      await flush();
      const id = await service.enqueueAction('join', 'room-1');
      await service.removePendingAction(id);
      expect(service.pendingActionCount()).toBe(0);
    });

    it('should clear all pending actions', async () => {
      await flush();
      await service.enqueueAction('join', 'room-1');
      await service.enqueueAction('leave', 'room-2');
      await service.clearPendingActions();
      expect(service.pendingActionCount()).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should reset all state', async () => {
      await flush();
      await service.cacheListings([mockListing]);
      await service.enqueueAction('join', 'room-1');

      await service.clearAll();

      expect(service.pendingActionCount()).toBe(0);
      expect(service.isOfflineMode()).toBe(false);
      expect(service.lastSyncTimestamp()).toBeNull();
      expect(service.isCacheFresh()).toBe(false);
    });
  });

  describe('flushPendingActions', () => {
    it('should clear pending actions on flush', async () => {
      await flush();
      await service.enqueueAction('join', 'room-1');
      await service.enqueueAction('leave', 'room-2');
      expect(service.pendingActionCount()).toBe(2);

      await service.flushPendingActions();
      expect(service.pendingActionCount()).toBe(0);
    });

    it('should handle flush with no actions', async () => {
      await flush();
      await service.flushPendingActions();
      expect(service.pendingActionCount()).toBe(0);
    });
  });
});

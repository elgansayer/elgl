import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { OfflineModerationService } from './offline-moderation.service';
import { NetworkStatusService } from './network-status.service';
import { ModerationItem } from './moderation.service';

function syncReq(result?: unknown) {
  const r: Record<string, unknown> & { on_success: (() => void) | null } = {
    result: result ?? null,
    on_success: null,
  };
  Object.defineProperty(r, 'onsuccess', {
    get() { return r.on_success; },
    set(f: () => void) { r.on_success = f; if (f) f(); },
  });
  return r;
}

function moderationItem(overrides: Partial<ModerationItem> = {}): ModerationItem {
  return {
    id: 'item-1',
    type: 'moment',
    status: 'pending',
    created_at: '2026-01-01T00:00:00.000Z',
    reason: 'Spam',
    reporter: { id: 'reporter-1', display_name: 'Reporter' },
    reported_user: { id: 'user-1', display_name: 'Reported User' },
    ...overrides,
  };
}

describe('OfflineModerationService', () => {
  let service: OfflineModerationService;
  let stores: Map<string, Map<string, Record<string, unknown>>>;

  function getStore(name: string): Map<string, Record<string, unknown>> {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  }

  function os(storeName: string) {
    const s = getStore(storeName);
    return {
      put: (v: Record<string, unknown>) => { s.set(String(v['type'] ?? v['id'] ?? v['key']), v); return syncReq(); },
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
      providers: [OfflineModerationService, NetworkStatusService],
    });
    service = TestBed.inject(OfflineModerationService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('items caching', () => {
    it('should cache and retrieve moderation items', async () => {
      const items = [moderationItem({ id: 'item-1' }), moderationItem({ id: 'item-2' })];
      await service.cacheItems('moment', items);
      const cached = await service.getCachedItems('moment');
      expect(cached).toHaveLength(2);
      expect(cached[0].id).toBe('item-1');
    });

    it('should return empty array when no items cached', async () => {
      const cached = await service.getCachedItems('profile');
      expect(cached).toEqual([]);
    });

    it('should overwrite previous cached items for the same type', async () => {
      await service.cacheItems('moment', [moderationItem({ id: 'old' })]);
      await service.cacheItems('moment', [moderationItem({ id: 'new' })]);
      const cached = await service.getCachedItems('moment');
      expect(cached).toHaveLength(1);
      expect(cached[0].id).toBe('new');
    });

    it('should keep separate caches for moment and profile types', async () => {
      const momentItems = [moderationItem({ id: 'm1', type: 'moment' })];
      const profileItems = [moderationItem({ id: 'p1', type: 'profile' })];
      await service.cacheItems('moment', momentItems);
      await service.cacheItems('profile', profileItems);

      const cachedMoments = await service.getCachedItems('moment');
      const cachedProfiles = await service.getCachedItems('profile');
      expect(cachedMoments[0].id).toBe('m1');
      expect(cachedProfiles[0].id).toBe('p1');
    });
  });

  describe('pending action queue', () => {
    it('should enqueue and retrieve pending actions', async () => {
      const id = await service.enqueuePendingAction('approve', 'item-1', 'moment');
      expect(id).toBeTruthy();
      expect(service.pendingActionCount()).toBe(1);

      const pending = await service.getPendingActions();
      expect(pending).toHaveLength(1);
      expect(pending[0].actionType).toBe('approve');
      expect(pending[0].itemId).toBe('item-1');
    });

    it('should remove a pending action', async () => {
      const id = await service.enqueuePendingAction('reject', 'item-2', 'profile');
      expect(service.pendingActionCount()).toBe(1);

      await service.removePendingAction(id);
      expect(service.pendingActionCount()).toBe(0);
    });

    it('should store optional reason for reject actions', async () => {
      await service.enqueuePendingAction('reject', 'item-3', 'moment', 'Inappropriate content');
      const pending = await service.getPendingActions();
      expect(pending[0].reason).toBe('Inappropriate content');
    });
  });

  describe('syncPendingActions', () => {
    it('should process all pending actions and clear succeeded ones', async () => {
      await service.enqueuePendingAction('approve', 'item-1', 'moment');
      await service.enqueuePendingAction('reject', 'item-2', 'moment');

      const executor = vi.fn().mockResolvedValue({ success: true });
      const result = await service.syncPendingActions(executor);

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(service.pendingActionCount()).toBe(0);
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it('should keep failed actions in the queue', async () => {
      await service.enqueuePendingAction('approve', 'item-1', 'moment');
      await service.enqueuePendingAction('reject', 'item-2', 'moment');

      const executor = vi.fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false });
      const result = await service.syncPendingActions(executor);

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(service.pendingActionCount()).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('should clear all cached data and pending actions', async () => {
      await service.cacheItems('moment', [moderationItem()]);
      await service.enqueuePendingAction('approve', 'item-1', 'moment');
      expect(service.pendingActionCount()).toBe(1);

      await service.clearAll();

      const items = await service.getCachedItems('moment');
      expect(items).toEqual([]);
      expect(service.pendingActionCount()).toBe(0);
    });
  });

  describe('offline mode', () => {
    it('should start in online mode when navigator.onLine is true', () => {
      expect(service.isOfflineMode()).toBe(false);
    });
  });
});

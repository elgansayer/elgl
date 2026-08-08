import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';

import { OfflineAdminStorageService } from './offline-admin-storage.service';
import { NetworkStatusService } from './network-status.service';
import type { AdminUserSummary, AdminBlockEntry, LoginHistoryEntry } from './admin.service';
import type { ModerationItem } from './moderation.service';

function createMockUser(id: string): AdminUserSummary {
  return {
    id,
    display_name: `User ${id}`,
    avatar_url: undefined,
    native_languages: ['en'],
    target_languages: ['es'],
    is_vip: false,
    vip_tier: 'free',
    is_admin: false,
    coins_balance: 100,
    study_streak_days: 5,
    last_active_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

function createMockBlock(id: string): AdminBlockEntry {
  return {
    id,
    blocker_id: 'admin-1',
    blocked_id: `user-${id}`,
    blocker_name: 'Admin',
    blocked_name: `Blocked ${id}`,
    blocker_avatar: null,
    blocked_avatar: null,
    created_at: new Date().toISOString(),
  };
}

function createMockLoginEntry(id: string, userId: string): LoginHistoryEntry {
  return {
    id,
    user_id: userId,
    ip_address: '192.168.0.1',
    user_agent: 'TestAgent/1.0',
    created_at: new Date().toISOString(),
  };
}

function createMockModerationItem(id: string): ModerationItem {
  return {
    id,
    type: 'profile',
    status: 'pending',
    reason: 'spam',
    created_at: new Date().toISOString(),
    reporter: { id: 'r1', display_name: 'Reporter' },
    reported_user: { id: 'u1', display_name: 'ReportedUser' },
  };
}

describe('OfflineAdminStorageService', () => {
  let service: OfflineAdminStorageService;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  let mockStore: Map<string, unknown>;

  function createIDBReq(result?: unknown) {
    const req: Record<string, unknown> = { result: result ?? null };
    Object.defineProperty(req, 'onsuccess', {
      set(fn: () => void) {
        setTimeout(fn, 0);
      },
    });
    Object.defineProperty(req, 'onerror', {
      set() {},
    });
    return req;
  }

  beforeEach(() => {
    onlineSignal = signal(true);
    mockStore = new Map();

    vi.stubGlobal('indexedDB', {
      open: vi.fn().mockReturnValue({
        result: {
          objectStoreNames: {
            contains: () => false,
          },
        },
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
      }),
    });

    TestBed.configureTestingModule({
      providers: [
        OfflineAdminStorageService,
        {
          provide: NetworkStatusService,
          useValue: { isOnline: onlineSignal.asReadonly() },
        },
      ],
    });
    service = TestBed.inject(OfflineAdminStorageService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose isOnline from NetworkStatusService', () => {
    expect(service.isOnline()).toBe(true);
    onlineSignal.set(false);
    expect(service.isOnline()).toBe(false);
  });

  it('should start with cachedDataAvailable as false', () => {
    expect(service.cachedDataAvailable()).toBe(false);
  });

  describe('when IndexedDB is unavailable', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
    });

    it('should gracefully handle cacheUsers', async () => {
      await expect(
        service.cacheUsers('', 1, 20, [createMockUser('u1')], 1),
      ).resolves.toBeUndefined();
    });

    it('should return null for getCachedUsers', async () => {
      const result = await service.getCachedUsers('', 1, 20);
      expect(result).toBeNull();
    });

    it('should return null for getCachedBlocks', async () => {
      const result = await service.getCachedBlocks(1, 20);
      expect(result).toBeNull();
    });

    it('should return null for getCachedLoginHistory', async () => {
      const result = await service.getCachedLoginHistory('user-1');
      expect(result).toBeNull();
    });

    it('should return null for getCachedModerationItems', async () => {
      const result = await service.getCachedModerationItems('profile', 'pending');
      expect(result).toBeNull();
    });

    it('should not throw on clearAll', async () => {
      await expect(service.clearAll()).resolves.toBeUndefined();
    });
  });
});
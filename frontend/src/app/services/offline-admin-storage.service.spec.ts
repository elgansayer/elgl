import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';

import { OfflineAdminStorageService } from './offline-admin-storage.service';
import { NetworkStatusService } from './network-status.service';
import type { AdminUserSummary } from './admin.service';

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

describe('OfflineAdminStorageService', () => {
  let service: OfflineAdminStorageService;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  beforeEach(() => {
    onlineSignal = signal(true);
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
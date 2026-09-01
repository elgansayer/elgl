import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OfflineDiscoveryCacheService } from './offline-discovery-cache.service';
import { NetworkStatusService } from './network-status.service';

describe('OfflineDiscoveryCacheService', () => {
  let service: OfflineDiscoveryCacheService;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  let deleteDatabase: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    onlineSignal = signal(true);
    deleteDatabase = vi.fn(() => {
      const request: Record<string, unknown> = {};
      Object.defineProperty(request, 'onsuccess', {
        set(callback: () => void) {
          callback();
        },
      });
      return request;
    });
    vi.stubGlobal('indexedDB', { deleteDatabase });

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
    await Promise.resolve();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('purges the legacy profile cache on startup', () => {
    expect(deleteDatabase).toHaveBeenCalledWith('hellotalk_discovery_cache');
    expect(service.cachedDataAvailable()).toBe(false);
  });

  it('never stores or serves partner profiles', async () => {
    const profile = { id: 'partner-1' } as never;

    await service.cachePartner(profile);
    await service.cachePartners([profile]);
    await service.cacheSearchResults('default', [profile]);

    expect(await service.getCachedPartner('partner-1')).toBeNull();
    expect(await service.getAllCachedPartners()).toEqual([]);
    expect(await service.getCachedSearchResults('default')).toBeNull();
    expect(service.cachedDataAvailable()).toBe(false);
  });

  it('retains live network status without exposing cached profiles', () => {
    expect(service.isOnline()).toBe(true);
    onlineSignal.set(false);
    expect(service.isOnline()).toBe(false);
    expect(service.cachedDataAvailable()).toBe(false);
  });

  it('keeps deterministic request-key generation for compatibility', () => {
    expect(
      service.buildFiltersKey({
        target_language: 'JA',
        radius_metres: 50000,
        gender: undefined,
      }),
    ).toBe('radius_metres=50000&target_language=JA');
  });
});

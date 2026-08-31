import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpParams } from '@angular/common/http';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryService } from './discovery.service';
import { AuthService } from './auth.service';
import { SafetyService } from './safety.service';
import { ChatService } from './chat.service';
import { UserService } from './user.service';
import { OfflineDiscoveryCacheService } from './offline-discovery-cache.service';
import { MatchmakingAlgorithmService } from './matchmaking-algorithm.service';

describe('DiscoveryService location privacy', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sends precise coordinates without placing them in the persistent cache key', async () => {
    const buildFiltersKey = vi.fn().mockReturnValue('nearby-cache-key');
    const httpGet = vi.fn((url: string, _options?: { params?: HttpParams }) =>
      of(url.endsWith('/partner-of-week') ? [] : []),
    );

    TestBed.configureTestingModule({
      providers: [
        DiscoveryService,
        { provide: HttpClient, useValue: { get: httpGet } },
        {
          provide: AuthService,
          useValue: { currentUser: signal(null), getAccessToken: vi.fn().mockReturnValue('token') },
        },
        {
          provide: SafetyService,
          useValue: { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) },
        },
        { provide: ChatService, useValue: {} },
        { provide: UserService, useValue: {} },
        {
          provide: OfflineDiscoveryCacheService,
          useValue: {
            buildFiltersKey,
            isOnline: signal(true),
            cacheSearchResults: vi.fn().mockResolvedValue(undefined),
            cachePartners: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: MatchmakingAlgorithmService, useValue: {} },
      ],
    });

    await TestBed.inject(DiscoveryService).findPartners({
      latitude: 51.5074,
      longitude: -0.1278,
      radius_metres: 10_000,
      sort: 'nearest',
    });

    expect(buildFiltersKey).toHaveBeenCalledWith({
      radius_metres: 10_000,
      sort: 'nearest',
      location_cache_scope: 'nearby-memory-origin',
    });
    expect(buildFiltersKey.mock.calls[0][0]).not.toHaveProperty('latitude');
    expect(buildFiltersKey.mock.calls[0][0]).not.toHaveProperty('longitude');

    const partnerRequest = httpGet.mock.calls.find(([url]) =>
      String(url).endsWith('/discovery/partners'),
    );
    const params = partnerRequest?.[1]?.params;
    expect(params).toBeInstanceOf(HttpParams);
    if (!params) throw new Error('Expected partner request parameters');
    expect(params.get('latitude')).toBe('51.5074');
    expect(params.get('longitude')).toBe('-0.1278');
  });
});

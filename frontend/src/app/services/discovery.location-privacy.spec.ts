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

  function configureService(isOnline: boolean) {
    const buildFiltersKey = vi.fn().mockReturnValue('nearby-cache-key');
    const cacheSearchResults = vi.fn().mockResolvedValue(undefined);
    const cachePartners = vi.fn().mockResolvedValue(undefined);
    const getCachedSearchResults = vi.fn().mockResolvedValue([]);
    const getAllCachedPartners = vi.fn().mockResolvedValue([]);
    const httpGet = vi.fn(
      (url: string, _options?: { params?: HttpParams }) =>
        of(url.endsWith('/partner-of-week') ? [] : []),
    );

    TestBed.configureTestingModule({
      providers: [
        DiscoveryService,
        { provide: HttpClient, useValue: { get: httpGet } },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal(null),
            getAccessToken: vi.fn().mockReturnValue('token'),
          },
        },
        {
          provide: SafetyService,
          useValue: {
            getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
          },
        },
        { provide: ChatService, useValue: {} },
        { provide: UserService, useValue: {} },
        {
          provide: OfflineDiscoveryCacheService,
          useValue: {
            buildFiltersKey,
            isOnline: signal(isOnline),
            cacheSearchResults,
            cachePartners,
            getCachedSearchResults,
            getAllCachedPartners,
          },
        },
        { provide: MatchmakingAlgorithmService, useValue: {} },
      ],
    });

    return {
      service: TestBed.inject(DiscoveryService),
      buildFiltersKey,
      cacheSearchResults,
      cachePartners,
      getCachedSearchResults,
      getAllCachedPartners,
      httpGet,
    };
  }

  it('sends each precise origin without persisting location-derived results', async () => {
    const {
      service,
      buildFiltersKey,
      cacheSearchResults,
      cachePartners,
      httpGet,
    } = configureService(true);

    await service.findPartners({
      latitude: 51.5074,
      longitude: -0.1278,
      radius_metres: 10_000,
      sort: 'nearest',
    });
    await service.findPartners({
      latitude: 35.6762,
      longitude: 139.6503,
      radius_metres: 10_000,
      sort: 'nearest',
    });

    expect(buildFiltersKey).not.toHaveBeenCalled();
    expect(cacheSearchResults).not.toHaveBeenCalled();
    expect(cachePartners).not.toHaveBeenCalled();

    const partnerRequests = httpGet.mock.calls.filter(([url]) =>
      String(url).endsWith('/discovery/partners'),
    );
    expect(partnerRequests).toHaveLength(2);

    const londonParams = partnerRequests[0][1]?.params;
    const tokyoParams = partnerRequests[1][1]?.params;
    expect(londonParams).toBeInstanceOf(HttpParams);
    expect(tokyoParams).toBeInstanceOf(HttpParams);
    expect(londonParams?.get('latitude')).toBe('51.5074');
    expect(londonParams?.get('longitude')).toBe('-0.1278');
    expect(tokyoParams?.get('latitude')).toBe('35.6762');
    expect(tokyoParams?.get('longitude')).toBe('139.6503');
  });

  it('does not reuse persistent discovery data for an offline location search', async () => {
    const {
      service,
      getCachedSearchResults,
      getAllCachedPartners,
      httpGet,
    } = configureService(false);

    const result = await service.findPartners({
      latitude: 51.5074,
      longitude: -0.1278,
      radius_metres: 10_000,
      sort: 'nearest',
    });

    expect(result).toEqual([]);
    expect(getCachedSearchResults).not.toHaveBeenCalled();
    expect(getAllCachedPartners).not.toHaveBeenCalled();
    expect(httpGet).not.toHaveBeenCalled();
  });
});

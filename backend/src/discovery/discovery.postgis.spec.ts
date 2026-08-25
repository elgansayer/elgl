import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryService } from './discovery.service';

vi.mock('../mock-data', () => ({
  MOCK_USERS: [],
}));

vi.mock('./sanitise-discovery.helper', () => ({
  sanitiseDiscoveryData: <T>(value: T): T => value,
}));

describe('DiscoveryService PostGIS search contract', () => {
  let service: DiscoveryService;
  let queryBuilder: Record<string, ReturnType<typeof vi.fn>>;
  let supabaseClient: {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };
  let safetyService: {
    getBlockedAndBlockerIds: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    queryBuilder = {};
    for (const method of [
      'select',
      'neq',
      'eq',
      'contains',
      'gt',
      'gte',
      'lt',
      'lte',
      'not',
      'in',
      'range',
      'order',
      'ilike',
      'overlaps',
    ]) {
      queryBuilder[method] = vi.fn().mockReturnValue(queryBuilder);
    }
    queryBuilder['limit'] = vi.fn().mockResolvedValue({ data: [], error: null });

    supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    safetyService = {
      getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
    };

    service = new DiscoveryService(
      {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
      } as never,
      {
        getActiveHostIds: vi.fn().mockResolvedValue([]),
      } as never,
      {
        getClient: vi.fn().mockReturnValue(supabaseClient),
        getRedisClient: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(null),
        }),
      } as never,
      safetyService as never,
      {
        executeWithBreaker: vi.fn(),
        executeWithCascade: vi.fn(),
        recordDegradationEvent: vi.fn(),
        isAvailable: vi.fn().mockReturnValue(true),
        recordSuccess: vi.fn(),
        recordFailure: vi.fn(),
        getAllBreakerStates: vi.fn().mockReturnValue(new Map()),
      } as never,
    );
  });

  it('passes the complete typed proximity-filter contract to search_nearby_users', async () => {
    supabaseClient.rpc.mockResolvedValue({
      data: [{ id: 'nearby-1', distance_metres: 840 }],
      error: null,
    });

    await service.searchPartners(
      'viewer-1',
      { is_vip: true } as never,
      {
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 12_500,
        native_languages: 'ja',
        target_language: 'en',
        serious_learner_only: true,
        level: 'B2',
        gender: 'female',
        age_min: 21,
        age_max: 40,
        has_audio_intro: true,
      },
    );

    expect(supabaseClient.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseClient.rpc).toHaveBeenCalledWith('search_nearby_users', {
      search_lat: 51.5074,
      search_lon: -0.1278,
      radius_m: 12_500,
      exclude_user_id: 'viewer-1',
      filter_native_arr: ['ja'],
      filter_target: 'en',
      serious_only: true,
      filter_level: 'B2',
      filter_gender: 'female',
      filter_age_min: 21,
      filter_age_max: 40,
      filter_audio_intro: true,
    });
    expect(queryBuilder['limit']).not.toHaveBeenCalled();
  });

  it('uses the 50 km service default and normalises the legacy distance field', async () => {
    supabaseClient.rpc.mockResolvedValue({
      data: [{ id: 'nearby-1', distance: 1_234 }],
      error: null,
    });

    const result = await service.searchPartners('viewer-1', null, {
      latitude: 35.6762,
      longitude: 139.6503,
    });

    expect(supabaseClient.rpc).toHaveBeenCalledWith(
      'search_nearby_users',
      expect.objectContaining({ radius_m: 50_000 }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'nearby-1',
        distance: 1_234,
        distance_metres: 1_234,
      }),
    ]);
  });

  it('does not execute a PostGIS query when only one coordinate is present', async () => {
    queryBuilder['limit'].mockResolvedValue({
      data: [{ id: 'ordinary-1' }],
      error: null,
    });

    const result = await service.searchPartners('viewer-1', null, {
      latitude: 51.5074,
    });

    expect(supabaseClient.rpc).not.toHaveBeenCalled();
    expect(queryBuilder['limit']).toHaveBeenCalledWith(50);
    expect(result.map((user) => user.id)).toEqual(['ordinary-1']);
  });

  it('applies blocked-user filtering defensively to successful RPC results', async () => {
    safetyService.getBlockedAndBlockerIds.mockResolvedValue(['blocked-1']);
    supabaseClient.rpc.mockResolvedValue({
      data: [
        { id: 'allowed-1', distance_metres: 100 },
        { id: 'blocked-1', distance_metres: 50 },
      ],
      error: null,
    });

    const result = await service.searchPartners('viewer-1', null, {
      latitude: 51.5074,
      longitude: -0.1278,
    });

    expect(result.map((user) => user.id)).toEqual(['allowed-1']);
  });

  it('uses a valid VIP mock Point as the authoritative proximity origin', async () => {
    supabaseClient.rpc.mockResolvedValue({
      data: [{ id: 'tokyo-1', distance_metres: 500 }],
      error: null,
    });

    await service.searchPartners(
      'viewer-1',
      {
        is_vip: true,
        mock_location: {
          type: 'Point',
          coordinates: [139.6917, 35.6895],
        },
      } as never,
      {
        latitude: 51.5074,
        longitude: -0.1278,
      },
    );

    expect(supabaseClient.rpc).toHaveBeenCalledWith(
      'search_nearby_users',
      expect.objectContaining({
        search_lat: 35.6895,
        search_lon: 139.6917,
      }),
    );
  });

  it('falls back to the bounded non-spatial query when PostGIS is unavailable and removes stale distance metadata', async () => {
    supabaseClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'PostGIS unavailable' },
    });
    queryBuilder['limit'].mockResolvedValue({
      data: [{ id: 'fallback-1', distance_metres: 999 }],
      error: null,
    });

    const result = await service.searchPartners('viewer-1', null, {
      latitude: 40.7128,
      longitude: -74.006,
    });

    expect(queryBuilder['limit']).toHaveBeenCalledTimes(1);
    expect(queryBuilder['limit']).toHaveBeenCalledWith(50);
    expect(result).toEqual([
      expect.objectContaining({
        id: 'fallback-1',
        distance_metres: undefined,
      }),
    ]);
  });
});

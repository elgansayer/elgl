import type { Mock } from 'vitest';
import { DiscoveryService } from './discovery.service';
import type { UserProfile } from '../users/interfaces/user-profile.interface';

type QueryResult = {
  data: unknown[] | null;
  error: { message?: string } | null;
};

type QueryBuilderMock = {
  select: Mock;
  neq: Mock;
  eq: Mock;
  not: Mock;
  contains: Mock;
  gt: Mock;
  gte: Mock;
  overlaps: Mock;
  ilike: Mock;
  lte: Mock;
  limit: Mock;
};

const createQueryBuilder = (): QueryBuilderMock => {
  const builder = {} as QueryBuilderMock;
  const chainMethods = [
    'select',
    'neq',
    'eq',
    'not',
    'contains',
    'gt',
    'gte',
    'overlaps',
    'ilike',
    'lte',
  ] as const;

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.limit = vi.fn().mockResolvedValue({ data: [], error: null });

  return builder;
};

const makeRpcUser = (id: string, distance?: number) => ({
  id,
  display_name: `Partner ${id}`,
  native_languages: ['ja'],
  target_languages: ['en'],
  bio_text: 'Language partner',
  avatar_url: null,
  audio_intro_url: null,
  is_vip: false,
  study_streak_days: 12,
  correction_ratio: 0.9,
  is_serious_learner: true,
  proficiency_level: 'B1',
  created_at: '2026-08-01T00:00:00.000Z',
  last_active_at: '2026-08-19T12:00:00.000Z',
  distance,
});

describe('DiscoveryService PostGIS partner queries', () => {
  let service: DiscoveryService;
  let queryBuilder: QueryBuilderMock;
  let rpc: Mock;
  let getBlockedAndBlockerIds: Mock;
  let redisGet: Mock;

  beforeEach(() => {
    queryBuilder = createQueryBuilder();
    rpc = vi.fn();
    getBlockedAndBlockerIds = vi.fn().mockResolvedValue([]);
    redisGet = vi.fn().mockResolvedValue(null);

    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
      rpc,
    };

    service = new DiscoveryService(
      {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
      {} as never,
      {
        getClient: vi.fn().mockReturnValue(supabaseClient),
        getRedisClient: vi.fn().mockReturnValue({ get: redisGet }),
      } as never,
      { getBlockedAndBlockerIds } as never,
      {} as never,
    );
  });

  it('passes location and supported filters to the PostGIS RPC and normalises distance', async () => {
    rpc.mockResolvedValue({
      data: [makeRpcUser('partner-1', 3210)],
      error: null,
    } satisfies QueryResult);

    const result = await service.searchPartners(
      'current-user',
      { is_vip: false } as UserProfile,
      {
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 25000,
        native_languages: 'ja',
        target_language: 'en',
        serious_learner_only: true,
        level: 'B1',
        gender: 'female',
        age_min: 18,
        age_max: 40,
        has_audio_intro: true,
        sort: 'nearest',
      },
    );

    expect(rpc).toHaveBeenCalledWith('search_nearby_users', {
      search_lat: 51.5074,
      search_lon: -0.1278,
      radius_m: 25000,
      exclude_user_id: 'current-user',
      filter_native_arr: ['ja'],
      filter_target: 'en',
      serious_only: true,
      filter_level: 'B1',
      filter_gender: null,
      filter_age_min: 18,
      filter_age_max: 40,
      filter_audio_intro: true,
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'partner-1',
        distance_metres: 3210,
      }),
    ]);
  });

  it('uses VIP mock coordinates and forwards the VIP-only gender filter', async () => {
    rpc.mockResolvedValue({
      data: [makeRpcUser('tokyo-partner', 800)],
      error: null,
    } satisfies QueryResult);

    await service.searchPartners(
      'current-user',
      {
        is_vip: true,
        mock_location: {
          type: 'Point',
          coordinates: [139.6917, 35.6895],
        },
      } as UserProfile,
      {
        latitude: 51.5074,
        longitude: -0.1278,
        gender: 'female',
      },
    );

    expect(rpc).toHaveBeenCalledWith(
      'search_nearby_users',
      expect.objectContaining({
        search_lat: 35.6895,
        search_lon: 139.6917,
        radius_m: 50000,
        filter_gender: 'female',
      }),
    );
  });

  it('defensively removes blocked users returned by the PostGIS RPC', async () => {
    getBlockedAndBlockerIds.mockResolvedValue(['blocked-user']);
    rpc.mockResolvedValue({
      data: [
        makeRpcUser('allowed-user', 1000),
        makeRpcUser('blocked-user', 500),
      ],
      error: null,
    } satisfies QueryResult);

    const result = await service.searchPartners('current-user', null, {
      latitude: 53.4808,
      longitude: -2.2426,
    });

    expect(queryBuilder.not).toHaveBeenCalledWith('id', 'in', ['blocked-user']);
    expect(result.map((partner) => partner.id)).toEqual(['allowed-user']);
  });

  it('falls back to the standard discovery query when the PostGIS RPC fails', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'PostGIS unavailable' },
    } satisfies QueryResult);
    queryBuilder.limit.mockResolvedValue({
      data: [makeRpcUser('fallback-partner')],
      error: null,
    } satisfies QueryResult);

    const result = await service.searchPartners('current-user', null, {
      latitude: 51.5074,
      longitude: -0.1278,
    });

    expect(queryBuilder.limit).toHaveBeenCalledWith(50);
    expect(result).toEqual([
      expect.objectContaining({
        id: 'fallback-partner',
        distance_metres: undefined,
      }),
    ]);
  });
});

import type { Mock } from 'vitest';
import { DiscoveryService } from './discovery.service';
import type { UserProfile } from '../users/interfaces/user-profile.interface';

type QueryBuilderMock = {
  select: Mock;
  neq: Mock;
  eq: Mock;
  is: Mock;
  not: Mock;
  contains: Mock;
  gt: Mock;
  gte: Mock;
  overlaps: Mock;
  ilike: Mock;
  lte: Mock;
  limit: Mock;
};

const makePartner = (id = 'partner-1') => ({
  id,
  display_name: 'Partner',
  native_languages: ['ja'],
  target_languages: ['en'],
  bio_text: 'Language partner',
  avatar_url: null,
  audio_intro_url: null,
  is_vip: false,
  study_streak_days: 8,
  correction_ratio: 0.9,
  is_serious_learner: true,
  proficiency_level: 'B1',
  created_at: '2026-08-01T00:00:00.000Z',
  last_active_at: '2026-08-20T12:00:00.000Z',
  distance: 500,
});

const createQueryBuilder = (): QueryBuilderMock => {
  const builder = {} as QueryBuilderMock;
  const chainMethods = [
    'select',
    'neq',
    'eq',
    'is',
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
  builder.limit = vi.fn().mockResolvedValue({
    data: [makePartner('fallback-partner')],
    error: null,
  });

  return builder;
};

describe('DiscoveryService VIP location spoofing', () => {
  let service: DiscoveryService;
  let queryBuilder: QueryBuilderMock;
  let rpc: Mock;

  beforeEach(() => {
    queryBuilder = createQueryBuilder();
    rpc = vi.fn().mockResolvedValue({
      data: [makePartner()],
      error: null,
    });

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
        getRedisClient: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(null),
        }),
      } as never,
      {
        getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
      } as never,
      {} as never,
    );
  });

  it('uses a valid VIP mock Point even when browser GPS coordinates are absent', async () => {
    await service.searchPartners(
      'current-user',
      {
        is_vip: true,
        mock_location: {
          type: 'Point',
          coordinates: [139.6917, 35.6895],
        },
      } as UserProfile,
      {},
    );

    expect(rpc).toHaveBeenCalledWith(
      'search_nearby_users',
      expect.objectContaining({
        search_lat: 35.6895,
        search_lon: 139.6917,
        exclude_user_id: 'current-user',
      }),
    );
  });

  it('overrides real GPS coordinates with the VIP mock Point', async () => {
    await service.searchPartners(
      'current-user',
      {
        is_vip: true,
        mock_location: {
          type: 'Point',
          coordinates: [-73.9857, 40.7484],
        },
      } as UserProfile,
      {
        latitude: 51.5074,
        longitude: -0.1278,
      },
    );

    expect(rpc).toHaveBeenCalledWith(
      'search_nearby_users',
      expect.objectContaining({
        search_lat: 40.7484,
        search_lon: -73.9857,
      }),
    );
  });

  it('never applies mock coordinates to a non-VIP user', async () => {
    await service.searchPartners(
      'current-user',
      {
        is_vip: false,
        mock_location: {
          type: 'Point',
          coordinates: [139.6917, 35.6895],
        },
      } as UserProfile,
      {
        latitude: 51.5074,
        longitude: -0.1278,
      },
    );

    expect(rpc).toHaveBeenCalledWith(
      'search_nearby_users',
      expect.objectContaining({
        search_lat: 51.5074,
        search_lon: -0.1278,
      }),
    );
  });

  it.each([
    null,
    'Tokyo',
    { type: 'LineString', coordinates: [139.6917, 35.6895] },
    { type: 'Point', coordinates: [139.6917] },
    { type: 'Point', coordinates: ['139.6917', '35.6895'] },
  ])('ignores malformed VIP mock_location value %#', async (mockLocation) => {
    await service.searchPartners(
      'current-user',
      {
        is_vip: true,
        mock_location: mockLocation,
      } as UserProfile,
      {},
    );

    expect(rpc).not.toHaveBeenCalled();
    expect(queryBuilder.limit).toHaveBeenCalledWith(50);
  });

  it('applies VIP mock country and city to the normal discovery query', async () => {
    await service.searchPartners(
      'current-user',
      {
        is_vip: true,
        mock_country: 'Japan',
        mock_city: 'Tokyo',
      } as UserProfile,
      {
        country: 'United Kingdom',
        city: 'London',
      },
    );

    expect(queryBuilder.ilike).toHaveBeenCalledWith('country', '%Japan%');
    expect(queryBuilder.ilike).toHaveBeenCalledWith('city', '%Tokyo%');
  });

  it('preserves requested country and city for non-VIP discovery', async () => {
    await service.searchPartners(
      'current-user',
      {
        is_vip: false,
        mock_country: 'Japan',
        mock_city: 'Tokyo',
      } as UserProfile,
      {
        country: 'United Kingdom',
        city: 'London',
      },
    );

    expect(queryBuilder.ilike).toHaveBeenCalledWith(
      'country',
      '%United Kingdom%',
    );
    expect(queryBuilder.ilike).toHaveBeenCalledWith('city', '%London%');
    expect(queryBuilder.ilike).not.toHaveBeenCalledWith('country', '%Japan%');
    expect(queryBuilder.ilike).not.toHaveBeenCalledWith('city', '%Tokyo%');
  });
});

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

// The same Tokyo point in each representation PostGIS can hand back for the
// users.mock_location geography(Point, 4326) column. The EWKB values are fixed
// bytes, not output of the parser under test.
const TOKYO_EWKB_LE_SRID = '0101000020E610000095D4096822766140C74B378941D84140';
const NEW_YORK_EWKB_BE_SRID =
  '0020000001000010E6C0527F15B573EAB340445FCB923A29C7';

describe('DiscoveryService VIP location spoofing', () => {
  let service: DiscoveryService;
  let queryBuilder: QueryBuilderMock;
  let rpc: Mock;
  let logger: { info: Mock; warn: Mock; error: Mock };

  beforeEach(() => {
    queryBuilder = createQueryBuilder();
    rpc = vi.fn().mockResolvedValue({
      data: [makePartner()],
      error: null,
    });
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
      rpc,
    };

    service = new DiscoveryService(
      logger as never,
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

  describe('stored mock_location representations', () => {
    it.each([
      ['WKT text', 'POINT(139.6917 35.6895)', 35.6895, 139.6917],
      ['EWKT text', 'SRID=4326;POINT(139.6917 35.6895)', 35.6895, 139.6917],
      ['little endian EWKB hex', TOKYO_EWKB_LE_SRID, 35.6895, 139.6917],
      ['big endian EWKB hex', NEW_YORK_EWKB_BE_SRID, 40.7484, -73.9857],
    ])(
      'overrides real GPS coordinates with a VIP mock_location stored as %s',
      async (_label, mock_location, expectedLat, expectedLon) => {
        await service.searchPartners(
          'current-user',
          { is_vip: true, mock_location } as UserProfile,
          { latitude: 51.5074, longitude: -0.1278 },
        );

        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc).toHaveBeenCalledWith(
          'search_nearby_users',
          expect.objectContaining({
            search_lat: expectedLat,
            search_lon: expectedLon,
            exclude_user_id: 'current-user',
          }),
        );
        expect(logger.warn).not.toHaveBeenCalled();
      },
    );

    it('uses a hex EWKB mock_location when no browser GPS coordinates are sent', async () => {
      await service.searchPartners(
        'current-user',
        { is_vip: true, mock_location: TOKYO_EWKB_LE_SRID } as UserProfile,
        {},
      );

      expect(rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        expect.objectContaining({ search_lat: 35.6895, search_lon: 139.6917 }),
      );
    });

    it('never applies a stored hex EWKB mock_location to a non-VIP user', async () => {
      await service.searchPartners(
        'current-user',
        { is_vip: false, mock_location: TOKYO_EWKB_LE_SRID } as UserProfile,
        { latitude: 51.5074, longitude: -0.1278 },
      );

      expect(rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        expect.objectContaining({ search_lat: 51.5074, search_lon: -0.1278 }),
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('client-supplied spoof attempts', () => {
    it('ignores is_vip and mock_location smuggled into the discovery query', async () => {
      await service.searchPartners(
        'current-user',
        { is_vip: false } as UserProfile,
        {
          latitude: 51.5074,
          longitude: -0.1278,
          is_vip: true,
          mock_location: { type: 'Point', coordinates: [139.6917, 35.6895] },
        } as never,
      );

      expect(rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        expect.objectContaining({ search_lat: 51.5074, search_lon: -0.1278 }),
      );
    });

    it('ignores a missing profile even when the query claims a mock location', async () => {
      await service.searchPartners('current-user', null, {
        latitude: 51.5074,
        longitude: -0.1278,
        mock_location: { type: 'Point', coordinates: [139.6917, 35.6895] },
      } as never);

      expect(rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        expect.objectContaining({ search_lat: 51.5074, search_lon: -0.1278 }),
      );
    });
  });

  describe('unusable stored mock_location', () => {
    it.each([
      [
        'an out-of-range point',
        { type: 'Point', coordinates: [0, 120] },
        'object',
      ],
      [
        'swapped latitude and longitude',
        { type: 'Point', coordinates: [35.6895, 139.6917] },
        'object',
      ],
      [
        'an unsupported SRID',
        '0101000020110F000095D4096822766140C74B378941D84140',
        'string',
      ],
      ['free text', 'Tokyo', 'string'],
    ])(
      'falls back to the request coordinates and warns for %s',
      async (_label, mock_location, expectedType) => {
        await service.searchPartners(
          'current-user',
          { is_vip: true, mock_location } as UserProfile,
          { latitude: 51.5074, longitude: -0.1278 },
        );

        expect(rpc).toHaveBeenCalledWith(
          'search_nearby_users',
          expect.objectContaining({
            search_lat: 51.5074,
            search_lon: -0.1278,
          }),
        );
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          { mockLocationType: expectedType },
          'Ignoring unusable VIP mock_location; using request coordinates',
        );
      },
    );

    it('never writes the stored coordinates to the logs', async () => {
      const mock_location = {
        type: 'Point',
        coordinates: [123.456789, 98.765432],
      };

      await service.searchPartners(
        'current-user',
        { is_vip: true, mock_location } as UserProfile,
        { latitude: 51.5074, longitude: -0.1278 },
      );

      const logged = JSON.stringify([
        logger.info.mock.calls,
        logger.warn.mock.calls,
        logger.error.mock.calls,
      ]);
      expect(logged).not.toContain('123.456789');
      expect(logged).not.toContain('98.765432');
    });

    it('does not warn for a VIP who has not stored a mock_location', async () => {
      await service.searchPartners(
        'current-user',
        { is_vip: true, mock_location: null } as UserProfile,
        { latitude: 51.5074, longitude: -0.1278 },
      );

      expect(rpc).toHaveBeenCalledWith(
        'search_nearby_users',
        expect.objectContaining({ search_lat: 51.5074, search_lon: -0.1278 }),
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('does not warn about a non-VIP profile holding garbage in mock_location', async () => {
      await service.searchPartners(
        'current-user',
        { is_vip: false, mock_location: 'Tokyo' } as UserProfile,
        { latitude: 51.5074, longitude: -0.1278 },
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('keeps the bounded non-spatial path when no usable coordinates exist', async () => {
      const result = await service.searchPartners(
        'current-user',
        { is_vip: true, mock_location: 'Tokyo' } as UserProfile,
        {},
      );

      expect(rpc).not.toHaveBeenCalled();
      expect(queryBuilder.limit).toHaveBeenCalledWith(50);
      expect(result.map((partner) => partner.id)).toEqual(['fallback-partner']);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryService } from './discovery.service';
import type { SearchQueryDto } from './dto/search-query.dto';

vi.mock('./sanitise-discovery.helper', () => ({
  sanitiseDiscoveryData: <T>(value: T): T => value,
}));

vi.mock('../mock-data', () => ({
  MOCK_USERS: [],
}));

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  overlaps: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

function createQueryBuilder(): QueryBuilder {
  const builder: QueryBuilder = {
    select: vi.fn(),
    neq: vi.fn(),
    eq: vi.fn(),
    contains: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    not: vi.fn(),
    in: vi.fn(),
    range: vi.fn(),
    order: vi.fn(),
    ilike: vi.fn(),
    overlaps: vi.fn(),
    limit: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.contains.mockReturnValue(builder);
  builder.gt.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lt.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.not.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.range.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.ilike.mockReturnValue(builder);
  builder.overlaps.mockReturnValue(builder);

  return builder;
}

function createHarness() {
  const queryBuilder = createQueryBuilder();
  const supabaseClient = {
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn(),
  };
  const pipeline = {
    set: vi.fn(),
    exec: vi.fn().mockResolvedValue([]),
  };
  pipeline.set.mockReturnValue(pipeline);

  const redis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn().mockReturnValue(pipeline),
  };
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const audioRoomsService = {
    getActiveHostIds: vi.fn().mockResolvedValue([]),
  };
  const supabaseService = {
    getClient: vi.fn().mockReturnValue(supabaseClient),
    getRedisClient: vi.fn().mockReturnValue(redis),
  };
  const safetyService = {
    getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
  };
  const degradationService = {
    executeWithBreaker: vi.fn(),
    recordDegradationEvent: vi.fn(),
  };

  const service = new DiscoveryService(
    logger as never,
    audioRoomsService as never,
    supabaseService as never,
    safetyService as never,
    degradationService as never,
  );

  return {
    service,
    queryBuilder,
    supabaseClient,
    redis,
    logger,
  };
}

describe('DiscoveryService regression boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Partner of the Week cache safety', () => {
    it('filters non-string values from the Redis partner list', async () => {
      const { service, redis } = createHarness();
      redis.get.mockResolvedValue(
        JSON.stringify(['partner-a', 42, null, { id: 'unsafe' }, 'partner-b']),
      );

      await expect(service.getPartnerOfWeekIds()).resolves.toEqual([
        'partner-a',
        'partner-b',
      ]);
    });

    it('clears stale cached partners when the candidate query fails', async () => {
      const { service, queryBuilder, redis } = createHarness();
      queryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'database unavailable' },
      });

      await service.calculatePartnerOfWeek();

      expect(redis.del).toHaveBeenCalledWith('partner_of_week_ids');
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('clears stale cached partners when no candidates qualify', async () => {
      const { service, queryBuilder, redis } = createHarness();
      queryBuilder.limit.mockResolvedValue({ data: [], error: null });

      await service.calculatePartnerOfWeek();

      expect(redis.del).toHaveBeenCalledWith('partner_of_week_ids');
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('defensively rejects candidates that violate discovery visibility', async () => {
      const { service, queryBuilder, redis } = createHarness();
      queryBuilder.limit.mockResolvedValue({
        data: [
          {
            id: 'hidden-user',
            display_name: 'Hidden user',
            native_languages: ['en'],
            target_languages: ['ja'],
            privacy_hide_from_search: true,
            is_deletion_pending: false,
            correction_ratio: 0.95,
            study_streak_days: 30,
          },
        ],
        error: null,
      });

      await service.calculatePartnerOfWeek();

      expect(redis.del).toHaveBeenCalledWith('partner_of_week_ids');
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('does not crash when stale-cache cleanup itself is unavailable', async () => {
      const { service, queryBuilder, redis, logger } = createHarness();
      const cleanupError = new Error('redis unavailable');
      redis.del.mockRejectedValue(cleanupError);
      queryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'database unavailable' },
      });

      await expect(service.calculatePartnerOfWeek()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to clear stale Partner of the Week cache',
        cleanupError,
      );
    });
  });

  describe('proximity-search boundary', () => {
    const partialCoordinateCases: Array<{
      label: string;
      query: SearchQueryDto;
    }> = [
      { label: 'latitude-only', query: { latitude: 51.5074 } },
      { label: 'longitude-only', query: { longitude: -0.1278 } },
    ];

    it.each(partialCoordinateCases)(
      'uses the standard bounded query for $label coordinates',
      async ({ query }) => {
        const { service, queryBuilder, supabaseClient } = createHarness();
        queryBuilder.limit.mockResolvedValue({
          data: [{ id: 'standard-user', display_name: 'Standard User' }],
          error: null,
        });

        const result = await service.searchPartners(
          'viewer-user',
          null,
          query,
        );

        expect(supabaseClient.rpc).not.toHaveBeenCalled();
        expect(queryBuilder.limit).toHaveBeenCalledWith(50);
        expect(result.map((user) => user.id)).toEqual(['standard-user']);
      },
    );

    it('keeps discovery available when Partner of the Week Redis enrichment fails', async () => {
      const { service, queryBuilder, redis, logger } = createHarness();
      const redisError = new Error('redis read failed');
      redis.get.mockRejectedValue(redisError);
      queryBuilder.limit.mockResolvedValue({
        data: [{ id: 'partner-1', display_name: 'Partner One' }],
        error: null,
      });

      const result = await service.searchPartners('viewer-user', null, {});

      expect(result).toEqual([
        expect.objectContaining({
          id: 'partner-1',
          is_partner_of_week: false,
        }),
      ]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to load partner-of-week IDs, continuing without PoW badges',
        redisError,
      );
    });
  });
});

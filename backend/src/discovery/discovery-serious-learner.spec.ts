import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryService } from './discovery.service';

function createQueryBuilder() {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainableMethods = [
    'select',
    'neq',
    'eq',
    'is',
    'contains',
    'gt',
    'gte',
    'lte',
    'not',
    'ilike',
    'overlaps',
  ];

  for (const method of chainableMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  builder.limit = vi.fn().mockResolvedValue({
    data: [
      {
        id: 'serious-partner',
        study_streak_days: 12,
        correction_ratio: 0.9,
      },
    ],
    error: null,
  });

  return builder;
}

describe('DiscoveryService serious learner filtering', () => {
  let service: DiscoveryService;
  let queryBuilder: ReturnType<typeof createQueryBuilder>;

  beforeEach(() => {
    queryBuilder = createQueryBuilder();

    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
      rpc: vi.fn(),
    };
    const redisClient = {
      get: vi.fn().mockResolvedValue(null),
    };

    service = new DiscoveryService(
      {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
      } as never,
      { getActiveHostIds: vi.fn().mockResolvedValue([]) } as never,
      {
        getClient: vi.fn().mockReturnValue(supabaseClient),
        getRedisClient: vi.fn().mockReturnValue(redisClient),
      } as never,
      { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) } as never,
      {} as never,
    );
  });

  it('applies algorithmic thresholds when the profile enables Serious Learner mode', async () => {
    const query = {};

    await service.searchPartners(
      'current-user',
      { is_serious_learner: true } as never,
      query,
    );

    expect(queryBuilder.gt).toHaveBeenCalledWith('study_streak_days', 7);
    expect(queryBuilder.gte).toHaveBeenCalledWith('correction_ratio', 0.8);
    expect(query).toMatchObject({ serious_learner_only: true });
  });

  it('applies algorithmic thresholds when the request enables Serious Learner mode', async () => {
    const query = { serious_learner_mode: true };

    await service.searchPartners('current-user', null, query);

    expect(queryBuilder.gt).toHaveBeenCalledWith('study_streak_days', 7);
    expect(queryBuilder.gte).toHaveBeenCalledWith('correction_ratio', 0.8);
    expect(query).toMatchObject({ serious_learner_only: true });
  });
});

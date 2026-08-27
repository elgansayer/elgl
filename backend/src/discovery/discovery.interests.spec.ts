import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import { DiscoveryService } from './discovery.service';

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

function createQueryBuilder(data: unknown[]): QueryBuilderMock {
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
  builder.limit = vi.fn().mockResolvedValue({ data, error: null });
  return builder;
}

function makePartner(id: string, interests: string[]) {
  return {
    id,
    display_name: id,
    native_languages: ['ja'],
    target_languages: ['en'],
    interests,
    is_vip: false,
    study_streak_days: 1,
    correction_ratio: 0,
    is_serious_learner: false,
    created_at: '2026-08-01T00:00:00.000Z',
  };
}

function createService(queryBuilder: QueryBuilderMock, rpc: Mock) {
  return new DiscoveryService(
    {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as never,
    {} as never,
    {
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(queryBuilder),
        rpc,
      }),
      getRedisClient: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(null),
      }),
    } as never,
    { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) } as never,
    {} as never,
  );
}

describe('DiscoveryService interest filtering', () => {
  it('applies the selected interest with PostgreSQL array overlap for ordinary search', async () => {
    const queryBuilder = createQueryBuilder([
      makePartner('photo-user', ['photography']),
    ]);
    const service = createService(queryBuilder, vi.fn());

    const result = await service.searchPartners('current-user', null, {
      interests: 'photography',
    });

    expect(queryBuilder.select).toHaveBeenCalledWith(
      expect.stringContaining('interests'),
    );
    expect(queryBuilder.overlaps).toHaveBeenCalledWith('interests', [
      'photography',
    ]);
    expect(result.map((partner) => partner.id)).toEqual(['photo-user']);
  });

  it('does not add an interest predicate when no filter is selected', async () => {
    const queryBuilder = createQueryBuilder([
      makePartner('music-user', ['music']),
    ]);
    const service = createService(queryBuilder, vi.fn());

    await service.searchPartners('current-user', null, {});

    expect(queryBuilder.overlaps).not.toHaveBeenCalled();
  });

  it('post-filters PostGIS results by the selected interest', async () => {
    const queryBuilder = createQueryBuilder([]);
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { ...makePartner('photo-user', ['photography']), distance: 800 },
        { ...makePartner('music-user', ['music']), distance: 400 },
      ],
      error: null,
    });
    const service = createService(queryBuilder, rpc);

    const result = await service.searchPartners('current-user', null, {
      latitude: 51.5074,
      longitude: -0.1278,
      interests: 'photography',
    });

    expect(result.map((partner) => partner.id)).toEqual(['photo-user']);
    expect(result[0]).toEqual(
      expect.objectContaining({
        interests: ['photography'],
        distance_metres: 800,
      }),
    );
  });
});

import type { Mock } from 'vitest';
import { RecommendationsService } from './recommendations.service';

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryChain = {
  select: Mock;
  match: Mock;
  is: Mock;
  not: Mock;
  overlaps: Mock;
  order: Mock;
  limit: Mock;
  then: (resolve: (value: QueryResult) => void) => undefined;
};

const makeQueryChain = (
  data: unknown,
  error: { message: string } | null = null,
): QueryChain => {
  const chain = {} as QueryChain;

  for (const method of [
    'select',
    'match',
    'is',
    'not',
    'overlaps',
    'order',
    'limit',
  ] as const) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  chain.then = (resolve) => {
    resolve({ data, error });
    return undefined;
  };

  return chain;
};

const makeCandidate = (id: string) => ({
  id,
  display_name: `Partner ${id}`,
  avatar_url: null,
  native_languages: ['es'],
  target_languages: ['en'],
  is_serious_learner: true,
  study_streak_days: 14,
  correction_ratio: 0.9,
});

describe('daily recommendations contract', () => {
  const makeService = () => {
    const pipeline = {
      set: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };
    const redis = {
      pipeline: vi.fn().mockReturnValue(pipeline),
    };
    const from = vi.fn();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const service = new RecommendationsService(
      logger as never,
      {
        getClient: vi.fn().mockReturnValue({ from }),
        getRedisClient: vi.fn().mockReturnValue(redis),
      } as never,
      { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) } as never,
      {} as never,
      { isAvailable: vi.fn().mockReturnValue(true) } as never,
      { reportCrash: vi.fn().mockResolvedValue({}) } as never,
    );

    return { service, from, pipeline };
  };

  it('caches at most ten daily partners for 24 hours', async () => {
    const { service, from, pipeline } = makeService();
    const users = makeQueryChain([
      {
        id: 'learner-1',
        native_languages: ['en'],
        target_languages: ['es'],
      },
    ]);
    const matches = makeQueryChain(
      Array.from({ length: 10 }, (_, index) =>
        makeCandidate(`partner-${index + 1}`),
      ),
    );

    from.mockReturnValueOnce(users).mockReturnValueOnce(matches);

    await service.calculateDailyRecommendations();

    const privacyFilters = {
      is_deleted: false,
      privacy_hide_from_search: false,
      is_deletion_pending: false,
    };
    expect(users.match).toHaveBeenCalledWith(privacyFilters);
    expect(users.is).toHaveBeenCalledWith('scheduled_for_deletion_at', null);
    expect(matches.match).toHaveBeenCalledWith(privacyFilters);
    expect(matches.is).toHaveBeenCalledWith('scheduled_for_deletion_at', null);

    expect(users.limit).toHaveBeenCalledWith(5000);
    expect(matches.limit).toHaveBeenCalledWith(10);
    expect(matches.order).toHaveBeenCalledWith('is_serious_learner', {
      ascending: false,
    });
    expect(pipeline.set).toHaveBeenCalledTimes(1);
    expect(pipeline.set).toHaveBeenCalledWith(
      'recommendations:daily:learner-1',
      expect.any(String),
      'EX',
      86400,
    );

    const cached = JSON.parse(
      pipeline.set.mock.calls[0][1] as string,
    ) as Array<{ id: string }>;
    expect(cached).toHaveLength(10);
    expect(cached.map((candidate) => candidate.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `partner-${index + 1}`),
    );
  });

  it('never recommends the learner to themselves', async () => {
    const { service, from, pipeline } = makeService();
    const users = makeQueryChain([
      {
        id: 'learner-1',
        native_languages: ['en'],
        target_languages: ['es'],
      },
    ]);
    const matches = makeQueryChain([
      makeCandidate('partner-1'),
      makeCandidate('learner-1'),
      makeCandidate('partner-2'),
    ]);

    from.mockReturnValueOnce(users).mockReturnValueOnce(matches);

    await service.calculateDailyRecommendations();

    const cached = JSON.parse(
      pipeline.set.mock.calls[0][1] as string,
    ) as Array<{ id: string }>;
    expect(cached.map((candidate) => candidate.id)).toEqual([
      'partner-1',
      'partner-2',
    ]);
  });

  it('reuses one candidate query for learners sharing a language pair', async () => {
    const { service, from, pipeline } = makeService();
    const users = makeQueryChain([
      {
        id: 'learner-1',
        native_languages: ['en'],
        target_languages: ['es'],
      },
      {
        id: 'learner-2',
        native_languages: ['en'],
        target_languages: ['es'],
      },
    ]);
    const matches = makeQueryChain([
      makeCandidate('learner-1'),
      makeCandidate('learner-2'),
      makeCandidate('partner-1'),
    ]);

    from.mockReturnValueOnce(users).mockReturnValueOnce(matches);

    await service.calculateDailyRecommendations();

    expect(from).toHaveBeenCalledTimes(2);
    expect(pipeline.set).toHaveBeenCalledTimes(2);
    expect(pipeline.set.mock.calls.map((call) => call[0])).toEqual([
      'recommendations:daily:learner-1',
      'recommendations:daily:learner-2',
    ]);
  });
});

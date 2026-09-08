/// <reference types="vi" />
import { DiscoveryService } from './discovery.service';

interface PartnerCandidate {
  id: string;
  display_name: string | null;
  native_languages: string[] | null;
  target_languages: string[] | null;
  privacy_hide_from_search: boolean;
  is_deletion_pending: boolean;
  scheduled_for_deletion_at: string | null;
  correction_ratio: number;
  study_streak_days: number;
}

type CorrectorScore = {
  averageScore: number | null;
  totalRatings: number;
};

describe('DiscoveryService Partner of the Week eligibility', () => {
  const makeCandidate = (
    id: string,
    overrides: Partial<PartnerCandidate> = {},
  ): PartnerCandidate => ({
    id,
    display_name: `User ${id}`,
    native_languages: ['en'],
    target_languages: ['ja'],
    privacy_hide_from_search: false,
    is_deletion_pending: false,
    scheduled_for_deletion_at: null,
    correction_ratio: 0.8,
    study_streak_days: 14,
    ...overrides,
  });

  function createHarness(
    scoreResolver?: (userId: string) => Promise<CorrectorScore>,
  ) {
    const queryBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ['select', 'eq', 'is', 'not', 'gt', 'gte', 'order']) {
      queryBuilder[method] = vi.fn().mockReturnValue(queryBuilder);
    }
    queryBuilder['limit'] = vi.fn();

    const redis = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      pipeline: vi.fn(),
    };
    const supabaseClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
    };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    };
    const correctorScoreService = scoreResolver
      ? { getCorrectorScore: vi.fn(scoreResolver) }
      : undefined;
    const service = new DiscoveryService(
      logger as never,
      { getActiveHostIds: vi.fn() } as never,
      {
        getClient: vi.fn().mockReturnValue(supabaseClient),
        getRedisClient: vi.fn().mockReturnValue(redis),
      } as never,
      { getBlockedAndBlockerIds: vi.fn() } as never,
      {} as never,
      correctorScoreService as never,
    );

    return {
      service,
      queryBuilder,
      redis,
      supabaseClient,
      logger,
      correctorScoreService,
    };
  }

  it('applies the canonical discovery visibility and profile-completeness filters', async () => {
    const { service, queryBuilder, redis } = createHarness();
    queryBuilder['limit'].mockResolvedValue({
      data: [makeCandidate('eligible')],
      error: null,
    });

    await service.calculatePartnerOfWeek();

    expect(queryBuilder['eq']).toHaveBeenCalledWith(
      'privacy_hide_from_search',
      false,
    );
    expect(queryBuilder['eq']).toHaveBeenCalledWith(
      'is_deletion_pending',
      false,
    );
    expect(queryBuilder['is']).toHaveBeenCalledWith(
      'scheduled_for_deletion_at',
      null,
    );
    expect(queryBuilder['not']).toHaveBeenCalledWith(
      'display_name',
      'is',
      null,
    );
    expect(queryBuilder['not']).toHaveBeenCalledWith(
      'native_languages',
      'is',
      null,
    );
    expect(queryBuilder['not']).toHaveBeenCalledWith(
      'target_languages',
      'is',
      null,
    );
    expect(queryBuilder['gt']).toHaveBeenCalledWith('correction_ratio', 0.5);
    expect(queryBuilder['gte']).toHaveBeenCalledWith('study_streak_days', 7);
    expect(queryBuilder['limit']).toHaveBeenCalledWith(50);
    expect(redis.set).toHaveBeenCalledWith(
      'partner_of_week_ids',
      '["eligible"]',
      'EX',
      604800,
    );
  });

  it('never highlights hidden, deleting, or incomplete profiles even if returned by the data layer', async () => {
    const { service, queryBuilder, redis } = createHarness();
    queryBuilder['limit'].mockResolvedValue({
      data: [
        makeCandidate('eligible'),
        makeCandidate('hidden', { privacy_hide_from_search: true }),
        makeCandidate('deleting', { is_deletion_pending: true }),
        makeCandidate('scheduled', {
          scheduled_for_deletion_at: '2026-09-02T00:00:00.000Z',
        }),
        makeCandidate('no-name', { display_name: '   ' }),
        makeCandidate('no-native', { native_languages: [] }),
        makeCandidate('no-target', { target_languages: [] }),
      ],
      error: null,
    });

    await service.calculatePartnerOfWeek();

    expect(redis.set).toHaveBeenCalledWith(
      'partner_of_week_ids',
      '["eligible"]',
      'EX',
      604800,
    );
  });

  it('prioritises highly-rated correctors using the documented weighted ranking', async () => {
    const scores = new Map<string, CorrectorScore>([
      ['high-ratio-low-rating', { averageScore: 2, totalRatings: 1 }],
      ['high-rating', { averageScore: 5, totalRatings: 20 }],
    ]);
    const { service, queryBuilder, redis, correctorScoreService } =
      createHarness(async (userId) => scores.get(userId)!);
    queryBuilder['limit'].mockResolvedValue({
      data: [
        makeCandidate('high-ratio-low-rating', {
          correction_ratio: 0.95,
          study_streak_days: 30,
        }),
        makeCandidate('high-rating', {
          correction_ratio: 0.7,
          study_streak_days: 14,
        }),
      ],
      error: null,
    });

    await service.calculatePartnerOfWeek();

    expect(correctorScoreService?.getCorrectorScore).toHaveBeenCalledTimes(2);
    expect(redis.set).toHaveBeenCalledWith(
      'partner_of_week_ids',
      '["high-rating","high-ratio-low-rating"]',
      'EX',
      604800,
    );
  });

  it('isolates an unavailable corrector score without aborting the weekly refresh', async () => {
    const { service, queryBuilder, redis } = createHarness(async (userId) => {
      if (userId === 'score-unavailable') {
        throw new Error('ratings provider unavailable');
      }
      return { averageScore: 5, totalRatings: 10 };
    });
    queryBuilder['limit'].mockResolvedValue({
      data: [
        makeCandidate('score-unavailable'),
        makeCandidate('rated-partner'),
      ],
      error: null,
    });

    await expect(service.calculatePartnerOfWeek()).resolves.toBeUndefined();

    expect(redis.set).toHaveBeenCalledWith(
      'partner_of_week_ids',
      '["rated-partner","score-unavailable"]',
      'EX',
      604800,
    );
  });

  it('treats an unavailable score as a zero rating signal', async () => {
    const { service, queryBuilder, redis } = createHarness(async (userId) => {
      if (userId === 'a-score-unavailable') {
        throw new Error('ratings provider unavailable');
      }
      return { averageScore: 1, totalRatings: 0 };
    });
    queryBuilder['limit'].mockResolvedValue({
      data: [makeCandidate('z-one-star'), makeCandidate('a-score-unavailable')],
      error: null,
    });

    await service.calculatePartnerOfWeek();

    expect(redis.set).toHaveBeenCalledWith(
      'partner_of_week_ids',
      '["a-score-unavailable","z-one-star"]',
      'EX',
      604800,
    );
  });

  it('caps the published highlight list at ten users', async () => {
    const { service, queryBuilder, redis } = createHarness();
    queryBuilder['limit'].mockResolvedValue({
      data: Array.from({ length: 12 }, (_, index) =>
        makeCandidate(`user-${String(index).padStart(2, '0')}`),
      ),
      error: null,
    });

    await service.calculatePartnerOfWeek();

    expect(redis.set).toHaveBeenCalledWith(
      'partner_of_week_ids',
      JSON.stringify(
        Array.from(
          { length: 10 },
          (_, index) => `user-${String(index).padStart(2, '0')}`,
        ),
      ),
      'EX',
      604800,
    );
  });

  it('uses user ID as a deterministic tie-breaker', async () => {
    const { service, queryBuilder, redis } = createHarness();
    queryBuilder['limit'].mockResolvedValue({
      data: [makeCandidate('user-b'), makeCandidate('user-a')],
      error: null,
    });

    await service.calculatePartnerOfWeek();

    expect(redis.set).toHaveBeenCalledWith(
      'partner_of_week_ids',
      '["user-a","user-b"]',
      'EX',
      604800,
    );
  });

  it('clears a stale winner when no candidate remains eligible', async () => {
    const { service, queryBuilder, redis } = createHarness();
    queryBuilder['limit'].mockResolvedValue({ data: [], error: null });

    await service.calculatePartnerOfWeek();

    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('partner_of_week_ids');
  });

  it('clears a stale winner when candidate discovery fails', async () => {
    const { service, queryBuilder, redis } = createHarness();
    queryBuilder['limit'].mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await service.calculatePartnerOfWeek();

    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('partner_of_week_ids');
  });

  it('attempts to clear stale state when refreshing Redis fails', async () => {
    const { service, queryBuilder, redis } = createHarness();
    queryBuilder['limit'].mockResolvedValue({
      data: [makeCandidate('eligible')],
      error: null,
    });
    redis.set.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.calculatePartnerOfWeek()).resolves.toBeUndefined();

    expect(redis.del).toHaveBeenCalledWith('partner_of_week_ids');
  });
});

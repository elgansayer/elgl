/// <reference types="vi" />
import { DiscoveryService } from './discovery.service';

interface PartnerCandidate {
  id: string;
  display_name: string | null;
  native_languages: string[] | null;
  target_languages: string[] | null;
  privacy_hide_from_search: boolean;
  is_deletion_pending: boolean;
  correction_ratio: number;
  study_streak_days: number;
}

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
    correction_ratio: 0.8,
    study_streak_days: 14,
    ...overrides,
  });

  function createHarness() {
    const queryBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ['select', 'eq', 'not', 'gt', 'gte', 'order']) {
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
    const service = new DiscoveryService(
      logger as never,
      { getActiveHostIds: vi.fn() } as never,
      {
        getClient: vi.fn().mockReturnValue(supabaseClient),
        getRedisClient: vi.fn().mockReturnValue(redis),
      } as never,
      { getBlockedAndBlockerIds: vi.fn() } as never,
      {} as never,
    );

    return { service, queryBuilder, redis, supabaseClient, logger };
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

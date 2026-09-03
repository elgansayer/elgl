import type { Mock } from 'vitest';
import {
  DiscoveryRecommendationsService,
  rankDiscoveryRecommendations,
} from './discovery-recommendations.service';

const NOW = Date.parse('2026-08-21T10:00:00Z');
type Candidate = Parameters<typeof rankDiscoveryRecommendations>[1][number];

function candidate(id: string, overrides: Partial<Candidate> = {}): Candidate {
  return {
    id,
    display_name: `User ${id}`,
    avatar_url: null,
    native_languages: ['ja'],
    target_languages: ['en'],
    privacy_hide_from_search: false,
    privacy_hide_online_status: false,
    is_deletion_pending: false,
    is_deleted: false,
    is_serious_learner: false,
    study_streak_days: 0,
    last_active_at: '2026-08-21T09:00:00Z',
    ...overrides,
  };
}

describe('rankDiscoveryRecommendations', () => {
  const current = {
    nativeLanguages: ['en'],
    targetLanguages: ['ja'],
  };

  it('ranks reciprocal language, mutual interests and recent activity together', () => {
    const result = rankDiscoveryRecommendations(
      current,
      [
        candidate('interest-heavy', {
          last_active_at: '2026-08-01T00:00:00Z',
        }),
        candidate('active-and-shared'),
      ],
      new Map([
        ['interest-heavy', 1],
        ['active-and-shared', 2],
      ]),
      NOW,
    );

    expect(result.map((item) => item.id)).toEqual([
      'active-and-shared',
      'interest-heavy',
    ]);
    expect(result[0].recommendation_reasons).toEqual(
      expect.arrayContaining([
        'language_exchange',
        'shared_interests',
        'active_recently',
      ]),
    );
    expect(result[0]).not.toHaveProperty('last_active_at');
    expect(result[0]).not.toHaveProperty('recommendation_score');
  });

  it('does not use hidden online activity as a ranking signal', () => {
    const result = rankDiscoveryRecommendations(
      current,
      [
        candidate('hidden-active', { privacy_hide_online_status: true }),
        candidate('visible-active'),
      ],
      new Map(),
      NOW,
    );

    expect(result.map((item) => item.id)).toEqual([
      'visible-active',
      'hidden-active',
    ]);
    const hidden = result.find((item) => item.id === 'hidden-active');
    const visible = result.find((item) => item.id === 'visible-active');
    expect(hidden?.recommendation_reasons).not.toContain('active_recently');
    expect(visible?.recommendation_reasons).toContain('active_recently');
  });

  it('filters hidden, deleted, deletion-pending and incomplete profiles', () => {
    const result = rankDiscoveryRecommendations(
      current,
      [
        candidate('visible'),
        candidate('hidden', { privacy_hide_from_search: true }),
        candidate('deleted', { is_deleted: true }),
        candidate('pending', { is_deletion_pending: true }),
        candidate('no-name', { display_name: '   ' }),
        candidate('no-language', { native_languages: [] }),
      ],
      new Map(),
      NOW,
    );

    expect(result.map((item) => item.id)).toEqual(['visible']);
  });

  it('uses a stable id tie-breaker and caps the carousel at ten', () => {
    const candidates = Array.from({ length: 15 }, (_, index) =>
      candidate(`candidate-${String(index).padStart(2, '0')}`, {
        last_active_at: null,
      }),
    );

    const result = rankDiscoveryRecommendations(
      current,
      candidates.reverse(),
      new Map(),
      NOW,
      50,
    );

    expect(result).toHaveLength(10);
    expect(result[0].id).toBe('candidate-00');
    expect(result[9].id).toBe('candidate-09');
  });

  it('keeps sparse but complete profiles when a mutual-interest signal exists', () => {
    const result = rankDiscoveryRecommendations(
      { nativeLanguages: ['en'], targetLanguages: ['fr'] },
      [
        candidate('shared-only', {
          native_languages: ['ja'],
          target_languages: ['ko'],
          last_active_at: null,
        }),
      ],
      new Map([['shared-only', 1]]),
      NOW,
    );

    expect(result).toHaveLength(1);
    expect(result[0].recommendation_reasons).toEqual(['shared_interests']);
  });
});

type QueryChain = {
  select: Mock;
  eq: Mock;
  neq: Mock;
  in: Mock;
  is: Mock;
  not: Mock;
  overlaps: Mock;
  limit: Mock;
  maybeSingle: Mock;
  then: (resolve: (value: { data: unknown; error: null }) => void) => undefined;
};

function queryChain(data: unknown): QueryChain {
  const chain = {} as QueryChain;
  for (const method of [
    'select',
    'eq',
    'neq',
    'in',
    'is',
    'not',
    'overlaps',
    'limit',
    'maybeSingle',
  ] as const) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve) => {
    resolve({ data, error: null });
    return undefined;
  };
  return chain;
}

describe('DiscoveryRecommendationsService privacy contract', () => {
  it('excludes scheduled deletions from final candidate hydration', async () => {
    const currentUser = queryChain({
      native_languages: ['en'],
      target_languages: ['ja'],
    });
    const interests = queryChain([]);
    const candidates = queryChain([
      candidate('candidate-1', { display_name: 'Candidate One' }),
    ]);
    const from = vi
      .fn()
      .mockReturnValueOnce(currentUser)
      .mockReturnValueOnce(interests)
      .mockReturnValueOnce(candidates);
    const getBlockedAndBlockerIds = vi.fn().mockResolvedValue([]);
    const getDailyRecommendations = vi.fn().mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        id: `candidate-${index + 1}`,
      })),
    );
    const service = new DiscoveryRecommendationsService(
      { warn: vi.fn() } as never,
      { getClient: vi.fn().mockReturnValue({ from }) } as never,
      { getBlockedAndBlockerIds } as never,
      { getDailyRecommendations } as never,
    );

    await service.getForDiscovery('viewer');

    expect(candidates.is).toHaveBeenCalledWith(
      'scheduled_for_deletion_at',
      null,
    );
    expect(candidates.eq).toHaveBeenCalledWith(
      'privacy_hide_from_search',
      false,
    );
    expect(candidates.eq).toHaveBeenCalledWith('is_deletion_pending', false);
    expect(candidates.eq).toHaveBeenCalledWith('is_deleted', false);
    expect(getBlockedAndBlockerIds).toHaveBeenCalledTimes(1);
    expect(getDailyRecommendations).toHaveBeenCalledWith(
      'viewer',
      expect.any(Set),
    );
  });
});

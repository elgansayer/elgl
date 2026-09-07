import { rankDiscoveryRecommendations } from './discovery-recommendations.service';

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
    proficiency_level: null,
    availability_morning: false,
    availability_afternoon: false,
    availability_evening: false,
    available_time_start: null,
    available_time_end: null,
    correction_ratio: null,
    learning_goals: null,
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

  it('explains proficiency, availability, correction, and goal matches', () => {
    const result = rankDiscoveryRecommendations(
      {
        ...current,
        proficiencyLevel: 'B1',
        availabilityEvening: true,
        availableTimeStart: '18:00',
        availableTimeEnd: '20:00',
        learningGoals: ['conversation'],
      },
      [
        candidate('multidimensional-match', {
          proficiency_level: 'B1',
          availability_evening: true,
          available_time_start: '19:00',
          available_time_end: '21:00',
          correction_ratio: 0.81,
          learning_goals: ['Conversation'],
        }),
      ],
      new Map(),
      NOW,
    );

    expect(result[0].recommendation_reasons).toEqual(
      expect.arrayContaining([
        'proficiency_match',
        'availability_match',
        'high_correction_ratio',
        'learning_goal_match',
      ]),
    );
  });

  it('does not award new signals when profile data is missing or mismatched', () => {
    const result = rankDiscoveryRecommendations(
      {
        ...current,
        proficiencyLevel: 'B1',
        availabilityMorning: true,
        learningGoals: ['grammar'],
      },
      [
        candidate('language-only', {
          proficiency_level: 'A2',
          availability_evening: true,
          correction_ratio: 0.79,
          learning_goals: ['conversation'],
        }),
      ],
      new Map(),
      NOW,
    );

    expect(result[0].recommendation_reasons).not.toEqual(
      expect.arrayContaining([
        'proficiency_match',
        'availability_match',
        'high_correction_ratio',
        'learning_goal_match',
      ]),
    );
  });

  it('treats malformed proficiency values as neutral', () => {
    const result = rankDiscoveryRecommendations(
      { ...current, proficiencyLevel: '   ' },
      [candidate('malformed-proficiency', { proficiency_level: '   ' })],
      new Map(),
      NOW,
    );

    expect(result[0].recommendation_reasons).not.toContain('proficiency_match');
  });

  it('uses the repository-wide inclusive high-correction threshold', () => {
    const result = rankDiscoveryRecommendations(
      current,
      [candidate('threshold', { correction_ratio: 0.8 })],
      new Map(),
      NOW,
    );

    expect(result[0].recommendation_reasons).toContain('high_correction_ratio');
  });

  it('requires real time overlap rather than endpoint-only contact', () => {
    const result = rankDiscoveryRecommendations(
      {
        ...current,
        availableTimeStart: '10:00',
        availableTimeEnd: '12:00',
      },
      [
        candidate('adjacent', {
          available_time_start: '12:00',
          available_time_end: '14:00',
        }),
      ],
      new Map(),
      NOW,
    );

    expect(result[0].recommendation_reasons).not.toContain(
      'availability_match',
    );
  });

  it('matches overlapping overnight windows', () => {
    const result = rankDiscoveryRecommendations(
      {
        ...current,
        availableTimeStart: '23:00',
        availableTimeEnd: '02:00',
      },
      [
        candidate('overnight', {
          available_time_start: '01:00',
          available_time_end: '03:00',
        }),
      ],
      new Map(),
      NOW,
    );

    expect(result[0].recommendation_reasons).toContain('availability_match');
  });

  it('treats malformed and zero-duration windows as neutral', () => {
    const result = rankDiscoveryRecommendations(
      {
        ...current,
        availableTimeStart: '10:00',
        availableTimeEnd: '12:00',
      },
      [
        candidate('malformed', {
          available_time_start: 'not-a-time',
          available_time_end: '11:00',
        }),
        candidate('zero-duration', {
          available_time_start: '11:00',
          available_time_end: '11:00',
        }),
      ],
      new Map(),
      NOW,
    );

    for (const recommendation of result) {
      expect(recommendation.recommendation_reasons).not.toContain(
        'availability_match',
      );
    }
  });
});

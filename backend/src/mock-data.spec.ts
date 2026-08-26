import { MOCK_LINKED_ACCOUNTS, MOCK_USERS } from './mock-data';

describe('offline mock fixtures', () => {
  it('are available only through the explicit test profile', () => {
    expect(process.env.MOCK_BACKEND_MODE).toBe('test');
    expect(MOCK_USERS).toHaveLength(150);
    expect(MOCK_LINKED_ACCOUNTS.length).toBeGreaterThan(0);
  });

  it('uses a deterministic seed, timestamp sequence and ordering', () => {
    expect(MOCK_USERS.slice(0, 3)).toMatchObject([
      {
        id: 'fake-1',
        display_name: 'Omar1',
        native_languages: ['ja'],
        target_languages: ['ja', 'en'],
        study_streak_days: 40,
        correction_ratio: 0.81,
        is_serious_learner: true,
        created_at: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'fake-2',
        display_name: 'Olivia2',
        native_languages: ['no'],
        target_languages: ['en'],
        study_streak_days: 2,
        correction_ratio: 0.55,
        is_serious_learner: false,
        created_at: '2024-01-01T00:01:00.000Z',
      },
      {
        id: 'fake-3',
        display_name: 'Yuki3',
        native_languages: ['ja'],
        target_languages: ['es'],
        study_streak_days: 2,
        correction_ratio: 0.83,
        is_serious_learner: false,
        created_at: '2024-01-01T00:02:00.000Z',
      },
    ]);
  });

  it('contains no third-party media URLs', () => {
    expect(MOCK_USERS.every((user) => user.avatar_url === null)).toBe(true);
  });
});

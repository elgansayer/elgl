import {
  MOCK_FIXTURE_DIAGNOSTICS,
  MOCK_LINKED_ACCOUNTS,
  MOCK_USERS,
  buildMockFixtureSnapshot,
  buildMockUsers,
} from './mock-data';
import {
  DEFAULT_MOCK_FIXTURE_SEED,
  MOCK_FIXTURE_GENERATOR_VERSION,
  MOCK_FIXTURE_SEED_NAME,
} from './mock/deterministic-fixtures';

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

  it('rebuilds byte-stable fixture snapshots for the same seed', () => {
    expect(JSON.stringify(buildMockFixtureSnapshot(7932))).toBe(
      JSON.stringify(buildMockFixtureSnapshot(7932)),
    );
  });

  it('produces distinct valid user records for a different seed', () => {
    const defaultUsers = buildMockUsers(7932);
    const alternateUsers = buildMockUsers(7933);

    expect(alternateUsers).toHaveLength(defaultUsers.length);
    expect(JSON.stringify(alternateUsers)).not.toBe(
      JSON.stringify(defaultUsers),
    );
    expect(
      alternateUsers.every((user) => user.id.startsWith('fake-')),
    ).toBe(true);
  });

  it(
    'recreates the exact initial state after a consumer mutates its snapshot',
    () => {
      const pristine = JSON.stringify(buildMockFixtureSnapshot(7932));
      const mutable = buildMockFixtureSnapshot(7932);
      const firstUser = mutable.users[0];
      if (!firstUser) throw new Error('Expected seeded users');

      firstUser.display_name = 'mutated locally';

      expect(JSON.stringify(buildMockFixtureSnapshot(7932))).toBe(pristine);
    },
  );

  it('exposes the active seed in test diagnostics', () => {
    expect(MOCK_FIXTURE_DIAGNOSTICS).toMatchObject({
      seedName: MOCK_FIXTURE_SEED_NAME,
      seed: DEFAULT_MOCK_FIXTURE_SEED,
      generatorVersion: MOCK_FIXTURE_GENERATOR_VERSION,
      epoch: '2024-01-01T00:00:00.000Z',
    });
  });

  it('contains no third-party media URLs', () => {
    expect(MOCK_USERS.every((user) => user.avatar_url === null)).toBe(true);
  });
});

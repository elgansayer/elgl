import { isMockBackendEnabled } from './config/mock-backend-mode';
import {
  MOCK_FIXTURE_EPOCH_MS,
  createDeterministicFixtureGenerator,
  getMockFixtureDiagnostics,
  resolveMockFixtureSeed,
} from './mock/deterministic-fixtures';
import { assertMockFixtureIntegrity } from './mock/fixture-integrity';

const LINKED_ACCOUNT_FIXTURES = [
  {
    user_id: 'fake-1',
    provider: 'google',
    name: 'sakura@gmail.com',
    active: true,
    created_at: '2024-01-15T00:00:00Z',
  },
  {
    user_id: 'fake-1',
    provider: 'email',
    name: 'sakura1@example.com',
    active: true,
    created_at: '2024-01-10T00:00:00Z',
  },
  {
    user_id: 'fake-2',
    provider: 'facebook',
    name: 'Minjun Kim',
    active: true,
    created_at: '2024-02-20T00:00:00Z',
  },
  {
    user_id: 'fake-2',
    provider: 'twitter',
    name: '@minjun_dev',
    active: true,
    created_at: '2024-02-15T00:00:00Z',
  },
  {
    user_id: 'fake-3',
    provider: 'apple',
    name: 'emma@icloud.com',
    active: true,
    created_at: '2024-03-01T00:00:00Z',
  },
  {
    user_id: 'fake-3',
    provider: 'google',
    name: 'emma.writes@gmail.com',
    active: false,
    created_at: '2024-03-05T00:00:00Z',
  },
  {
    user_id: 'fake-4',
    provider: 'email',
    name: 'liam@example.com',
    active: true,
    created_at: '2024-04-01T00:00:00Z',
  },
  {
    user_id: 'fake-5',
    provider: 'google',
    name: 'olivia@gmail.com',
    active: true,
    created_at: '2024-04-10T00:00:00Z',
  },
  {
    user_id: 'fake-5',
    provider: 'apple',
    name: 'olivia@icloud.com',
    active: true,
    created_at: '2024-04-05T00:00:00Z',
  },
  {
    user_id: 'fake-5',
    provider: 'twitter',
    name: '@olivia_creator',
    active: true,
    created_at: '2024-04-08T00:00:00Z',
  },
] as const;

export function buildMockUsers(seed = resolveMockFixtureSeed()) {
  const generator = createDeterministicFixtureGenerator(seed);
  const random = () => generator.random();
  const nativeLangs = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'no'];
  const targetLangs = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'no'];
  const names = [
    'Sakura',
    'Min-jun',
    'Emma',
    'Liam',
    'Olivia',
    'Noah',
    'Ava',
    'Oliver',
    'Isabella',
    'Elijah',
    'Lars',
    'Astrid',
    'Yuki',
    'Kenji',
    'Satoshi',
    'Mei',
    'Hiroshi',
    'Jin',
    'Ji-eun',
    'Hassan',
    'Fatima',
    'Omar',
    'Aisha',
    'Carlos',
    'Maria',
  ];

  return Array.from({ length: 150 }, (_, i) => {
    const native = nativeLangs[Math.floor(random() * nativeLangs.length)];
    const targets = [targetLangs[Math.floor(random() * targetLangs.length)]];
    if (random() > 0.5 && targets[0] !== 'en') targets.push('en');
    const name = names[Math.floor(random() * names.length)];

    return {
      id: `fake-${i + 1}`,
      display_name: `${name}${i + 1}`,
      native_languages: [native],
      target_languages: targets,
      bio_text: `Hi! I want to learn ${targets.join(', ').toUpperCase()} and I can teach ${native.toUpperCase()}. Let's chat!`,
      // Keep the offline fixture genuinely offline: consumers render their normal
      // avatar fallback instead of contacting a third-party avatar host.
      avatar_url: null,
      is_vip: random() > 0.8,
      study_streak_days: Math.floor(random() * 50),
      correction_ratio: Number((0.5 + random() * 0.5).toFixed(2)),
      is_serious_learner: random() > 0.6,
      created_at: new Date(MOCK_FIXTURE_EPOCH_MS + i * 60_000).toISOString(),
    };
  });
}

export function buildMockFixtureSnapshot(seed = resolveMockFixtureSeed()) {
  const snapshot = {
    diagnostics: getMockFixtureDiagnostics(seed),
    linkedAccounts: LINKED_ACCOUNT_FIXTURES.map((fixture) => ({ ...fixture })),
    users: buildMockUsers(seed),
  };

  assertMockFixtureIntegrity([
    {
      name: 'users',
      records: snapshot.users,
    },
    {
      name: 'linkedAccounts',
      idField: null,
      records: snapshot.linkedAccounts,
      references: [
        {
          field: 'user_id',
          targetCollection: 'users',
        },
      ],
    },
  ]);

  return snapshot;
}

const fixturesEnabled = isMockBackendEnabled();
const fixtureSnapshot = fixturesEnabled ? buildMockFixtureSnapshot() : null;

/**
 * Legacy fixture exports remain for existing local test consumers, but contain
 * no data unless the explicit mock backend activation boundary is enabled.
 */
export const MOCK_LINKED_ACCOUNTS = fixtureSnapshot?.linkedAccounts ?? [];
export const MOCK_USERS = fixtureSnapshot?.users ?? [];
export const MOCK_FIXTURE_DIAGNOSTICS = fixtureSnapshot?.diagnostics ?? null;

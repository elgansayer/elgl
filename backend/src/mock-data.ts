export const MOCK_LINKED_ACCOUNTS = [
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
];

export const MOCK_USERS = Array.from({ length: 150 }, (_, i) => {
  const nativeLangs = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'no'];
  const targetLangs = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'no'];

  const native = nativeLangs[Math.floor(Math.random() * nativeLangs.length)];
  const targets = [targetLangs[Math.floor(Math.random() * targetLangs.length)]];
  if (Math.random() > 0.5 && targets[0] !== 'en') targets.push('en');

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
  const name = names[Math.floor(Math.random() * names.length)];

  return {
    id: `fake-${i + 1}`,
    display_name: `${name}${i + 1}`,
    native_languages: [native],
    target_languages: targets,
    bio_text: `Hi! I want to learn ${targets.join(', ').toUpperCase()} and I can teach ${native.toUpperCase()}. Let's chat!`,
    avatar_url: `https://i.pravatar.cc/150?u=fake-${i + 1}`,
    is_vip: Math.random() > 0.8,
    study_streak_days: Math.floor(Math.random() * 50),
    correction_ratio: Number((0.5 + Math.random() * 0.5).toFixed(2)),
    is_serious_learner: Math.random() > 0.6,
    created_at: new Date().toISOString(),
  };
});

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
    native_languages: native,
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

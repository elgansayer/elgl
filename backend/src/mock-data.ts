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

/** Virtual Coin Economy -- mock gift catalog fallback data. */
export const MOCK_VIRTUAL_GIFTS = [
  {
    id: 'gift_rose',
    name: 'Rose',
    icon: '\ud83c\udf39',
    cost_coins: 10,
    animation_type: 'float',
    animation_url: 'https://r2.example.com/gifts/rose.json',
  },
  {
    id: 'gift_heart',
    name: 'Heart',
    icon: '\u2764\ufe0f',
    cost_coins: 20,
    animation_type: 'float',
    animation_url: 'https://r2.example.com/gifts/heart.json',
  },
  {
    id: 'gift_crown',
    name: 'Crown',
    icon: '\ud83d\udc51',
    cost_coins: 100,
    animation_type: 'pop',
    animation_url: 'https://r2.example.com/gifts/crown.json',
  },
  {
    id: 'gift_rocket',
    name: 'Rocket',
    icon: '\ud83d\ude80',
    cost_coins: 200,
    animation_type: 'launch',
    animation_url: 'https://r2.example.com/gifts/rocket.json',
  },
  {
    id: 'gift_star',
    name: 'Star',
    icon: '\u2b50',
    cost_coins: 50,
    animation_type: 'float',
    animation_url: 'https://r2.example.com/gifts/star.json',
  },
  {
    id: 'gift_diamond',
    name: 'Diamond',
    icon: '\ud83d\udc8e',
    cost_coins: 500,
    animation_type: 'pop',
    animation_url: 'https://r2.example.com/gifts/diamond.json',
  },
  {
    id: 'gift_rainbow',
    name: 'Rainbow',
    icon: '\ud83c\udf08',
    cost_coins: 150,
    animation_type: 'float',
    animation_url: 'https://r2.example.com/gifts/rainbow.json',
  },
  {
    id: 'gift_fireworks',
    name: 'Fireworks',
    icon: '\ud83c\udf86',
    cost_coins: 300,
    animation_type: 'launch',
    animation_url: 'https://r2.example.com/gifts/fireworks.json',
  },
];

/** Virtual Coin Economy -- mock sticker pack fallback data. */
export const MOCK_STICKER_PACKS = [
  {
    id: 'stk_pack_1',
    name: 'Happy Corgi Pack',
    cost_coins: 50,
    is_animated: false,
    sticker_urls: [
      'assets/stickers/happy.png',
      'assets/stickers/laugh.png',
      'assets/stickers/love.png',
    ],
  },
  {
    id: 'stk_pack_2',
    name: 'Rainbow Unicorns',
    cost_coins: 200,
    is_animated: true,
    sticker_urls: [
      'assets/stickers/unicorn-gallop.webm',
      'assets/stickers/unicorn-sparkle.webm',
    ],
    animation_url: 'assets/animations/unicorn.json',
  },
  {
    id: 'stk_pack_3',
    name: 'Study Buddies',
    cost_coins: 100,
    is_animated: false,
    sticker_urls: [
      'assets/stickers/book.png',
      'assets/stickers/pencil.png',
      'assets/stickers/backpack.png',
    ],
  },
  {
    id: 'stk_pack_4',
    name: 'Golden Dragons',
    cost_coins: 500,
    is_animated: true,
    sticker_urls: [
      'assets/stickers/dragon-fire.webm',
      'assets/stickers/dragon-fly.webm',
    ],
    animation_url: 'assets/animations/dragon.json',
  },
  {
    id: 'stk_pack_5',
    name: 'Party Animals',
    cost_coins: 150,
    is_animated: true,
    sticker_urls: [
      'assets/stickers/dog-dance.webm',
      'assets/stickers/cat-party.webm',
      'assets/stickers/bird-dj.webm',
    ],
    animation_url: 'assets/animations/party.json',
  },
  {
    id: 'stk_pack_6',
    name: 'Chill Vibes',
    cost_coins: 80,
    is_animated: false,
    sticker_urls: [
      'assets/stickers/coffee.png',
      'assets/stickers/sunset.png',
      'assets/stickers/hammock.png',
    ],
  },
  {
    id: 'stk_pack_7',
    name: 'Foodie Fun',
    cost_coins: 120,
    is_animated: false,
    sticker_urls: [
      'assets/stickers/pizza.png',
      'assets/stickers/sushi.png',
      'assets/stickers/taco.png',
    ],
  },
  {
    id: 'stk_pack_8',
    name: 'Travel Stamps',
    cost_coins: 180,
    is_animated: false,
    sticker_urls: [
      'assets/stickers/passport.png',
      'assets/stickers/suitcase.png',
      'assets/stickers/camera.png',
    ],
  },
];

/** Virtual Coin Economy -- mock coin purchase transaction history. */
export const MOCK_COIN_PURCHASES = [
  {
    id: 'purchase-1',
    user_id: 'fake-1',
    package_id: 'coins_small',
    coins_added: 100,
    amount_paid: 499,
    currency: 'usd',
    receipt_token: 'tok_mock_1',
    platform: 'web',
    transaction_id: 'txn_mock_1',
    status: 'completed',
  },
  {
    id: 'purchase-2',
    user_id: 'fake-2',
    package_id: 'coins_medium',
    coins_added: 500,
    amount_paid: 1999,
    currency: 'usd',
    receipt_token: 'tok_mock_2',
    platform: 'ios',
    transaction_id: 'txn_mock_2',
    status: 'completed',
  },
  {
    id: 'purchase-3',
    user_id: 'fake-3',
    package_id: 'coins_large',
    coins_added: 1200,
    amount_paid: 3999,
    currency: 'usd',
    receipt_token: 'tok_mock_3',
    platform: 'android',
    transaction_id: 'txn_mock_3',
    status: 'completed',
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

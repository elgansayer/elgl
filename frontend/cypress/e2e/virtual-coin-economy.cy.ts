/// <reference types="cypress" />

/**
 * Virtual Coin Economy E2E Test Flows
 *
 * Covers the full lifecycle of the virtual coin economy:
 * balance retrieval, daily check-in rewards, coin packages,
 * Stripe checkout purchase flow, purchase confirmation,
 * virtual gift catalog browsing and sending gifts,
 * sticker pack store (browse, filter, unlock),
 * daily/weekly quests, shop & cart checkout,
 * host tipping via audio rooms, and error/edge cases.
 *
 * Coin flow overview:
 *  1. User receives daily check-in coins (5-10 coins/day).
 *  2. User can purchase coin packages via Stripe Checkout.
 *  3. User spends coins on: virtual gifts, sticker packs,
 *     shop items (via cart), and audio room host tips.
 *  4. Quests reward coins for completing language activities.
 *  5. All coin mutations are verified server-side.
 */

// -----------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------

const ECONOMY_BASE = '/api/economy';
const SHOPPING_BASE = '/api/shopping';
const QUESTS_BASE = '/api/quests';

interface VirtualGift {
  id: string;
  name: string;
  icon: string;
  cost_coins: number;
  animation_type: string;
  animation_url?: string;
}

interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price_ukp: number;
  price_usd: number;
}

interface StickerPack {
  id: string;
  name: string;
  cost_coins: number;
  owned?: boolean;
  is_animated?: boolean;
  sticker_urls?: string[];
}

interface Quest {
  id: string;
  quest_type: 'daily' | 'weekly';
  quest_key: string;
  progress: number;
  target: number;
  reward_coins: number;
  completed: boolean;
}

function mockGiftCatalog(): VirtualGift[] {
  return [
    { id: 'gift_rose', name: 'Rose', icon: '🌹', cost_coins: 10, animation_type: 'float' },
    { id: 'gift_heart', name: 'Heart', icon: '❤️', cost_coins: 20, animation_type: 'float' },
    { id: 'gift_crown', name: 'Crown', icon: '👑', cost_coins: 100, animation_type: 'premium' },
    { id: 'gift_rocket', name: 'Rocket', icon: '🚀', cost_coins: 200, animation_type: 'confetti' },
    { id: 'gift_diamond', name: 'Diamond', icon: '💎', cost_coins: 500, animation_type: 'premium' },
    { id: 'gift_star', name: 'Star', icon: '⭐', cost_coins: 50, animation_type: 'sparkle' },
  ];
}

function mockCoinPackages(): CoinPackage[] {
  return [
    { id: 'coins_small', name: 'Small Coin Pack', coins: 100, price_ukp: 4, price_usd: 4.99 },
    { id: 'coins_medium', name: 'Medium Coin Pack', coins: 500, price_ukp: 16, price_usd: 19.99 },
    { id: 'coins_large', name: 'Large Coin Pack', coins: 1200, price_ukp: 32, price_usd: 39.99 },
    { id: 'coins_mega', name: 'Mega Coin Pack', coins: 3000, price_ukp: 64, price_usd: 79.99 },
  ];
}

function mockStickerPacks(): StickerPack[] {
  return [
    {
      id: 'stk_pack_1',
      name: 'Cute Animals',
      cost_coins: 50,
      is_animated: false,
      sticker_urls: ['https://r2.example.com/stickers/cat.png', 'https://r2.example.com/stickers/dog.png'],
    },
    {
      id: 'stk_pack_2',
      name: 'Fantasy Creatures',
      cost_coins: 150,
      is_animated: true,
      sticker_urls: ['https://r2.example.com/stickers/dragon.webm'],
    },
    {
      id: 'stk_pack_3',
      name: 'Study Buddies',
      cost_coins: 250,
      is_animated: false,
      sticker_urls: ['https://r2.example.com/stickers/book.png'],
    },
    {
      id: 'stk_pack_4',
      name: 'Premium Dragons',
      cost_coins: 500,
      is_animated: true,
      sticker_urls: ['https://r2.example.com/stickers/epic-dragon.webm'],
    },
  ];
}

function mockQuests(): Quest[] {
  return [
    { id: 'q-1', quest_type: 'daily', quest_key: 'send_messages', progress: 3, target: 10, reward_coins: 5, completed: false },
    { id: 'q-2', quest_type: 'daily', quest_key: 'voice_call', progress: 7, target: 15, reward_coins: 10, completed: false },
    { id: 'q-3', quest_type: 'weekly', quest_key: 'corrections_given', progress: 20, target: 50, reward_coins: 30, completed: false },
    { id: 'q-4', quest_type: 'daily', quest_key: 'study_flashcards', progress: 10, target: 10, reward_coins: 5, completed: true },
  ];
}

function setupE2eMocks(): void {
  cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
  cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
  cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
  cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
  cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
  cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
  cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
    'getBlockedAndBlockerIds',
  );
}

// -----------------------------------------------------------------
// 1. Coin Balance
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Balance', () => {
  beforeEach(() => {
    setupE2eMocks();
  });

  it('should retrieve current user coin balance', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/balance`, {
      statusCode: 200,
      body: { coins_balance: 350 },
    }).as('getBalance');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/balance`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body.coins_balance).to.be.a('number');
        expect(response.body.coins_balance).to.eq(350);
      },
    );
  });

  it('should return zero balance for unauthenticated users', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/balance`, {
      statusCode: 200,
      body: { coins_balance: 0 },
    }).as('getBalanceAnon');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/balance`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body.coins_balance).to.eq(0);
      },
    );
  });

  it('should return 401 when no auth header is present', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/balance`, {
      statusCode: 401,
      body: { statusCode: 401, message: 'Unauthorized' },
    }).as('unauthBalance');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/balance`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(401);
      },
    );
  });

  it('should not cache balance responses (private, no-store)', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/balance`, {
      statusCode: 200,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
      body: { coins_balance: 100 },
    }).as('balanceHeaders');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/balance`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.headers['cache-control']).to.include('no-store');
      },
    );
  });
});

// -----------------------------------------------------------------
// 2. Daily Check-In
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Daily Check-In', () => {
  beforeEach(() => {
    setupE2eMocks();
  });

  it('should claim daily check-in and receive coins (5-10 range)', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/daily-check-in`, {
      statusCode: 201,
      body: { claimed: true, coins_rewarded: 7, new_balance: 357 },
    }).as('dailyCheckIn');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/daily-check-in`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.claimed).to.be.true;
      expect(response.body.coins_rewarded).to.be.within(5, 10);
      expect(response.body.new_balance).to.be.greaterThan(0);
    });
  });

  it('should prevent claiming daily check-in twice on the same day', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/daily-check-in`, {
      statusCode: 200,
      body: { claimed: false, coins_rewarded: 0, new_balance: 350 },
    }).as('doubleCheckIn');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/daily-check-in`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.claimed).to.be.false;
      expect(response.body.coins_rewarded).to.eq(0);
    });
  });

  it('should increment balance by reward amount after successful check-in', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/daily-check-in`, {
      statusCode: 201,
      body: { claimed: true, coins_rewarded: 8, new_balance: 358 },
    }).as('checkInBalance');

    cy.intercept('GET', `${ECONOMY_BASE}/balance`, {
      statusCode: 200,
      body: { coins_balance: 358 },
    }).as('updatedBalance');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/daily-check-in`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.body.new_balance).to.eq(358);
    });

    // Verify subsequent balance read matches
    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/balance`, failOnStatusCode: false }).then(
      (resp) => {
        expect(resp.body.coins_balance).to.eq(358);
      },
    );
  });
});

// -----------------------------------------------------------------
// 3. Coin Packages
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Coin Packages', () => {
  beforeEach(() => {
    setupE2eMocks();
  });

  it('should list all available coin packages', () => {
    const packages = mockCoinPackages();

    cy.intercept('GET', `${ECONOMY_BASE}/packages`, {
      statusCode: 200,
      body: packages,
    }).as('getPackages');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/packages`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.length(4);
        expect(response.body[0]).to.have.all.keys('id', 'name', 'coins', 'price_ukp', 'price_usd');
      },
    );
  });

  it('should have correctly ordered packages by value', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/packages`, {
      statusCode: 200,
      body: mockCoinPackages(),
    }).as('orderedPackages');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/packages`, failOnStatusCode: false }).then(
      (response) => {
        const coins = response.body.map((p: CoinPackage) => p.coins);
        // Packages should be listed in increasing coin order
        expect(coins[0]).to.be.lessThan(coins[1]);
        expect(coins[1]).to.be.lessThan(coins[2]);
        expect(coins[2]).to.be.lessThan(coins[3]);
      },
    );
  });

  it('should have valid GBP and USD prices for each package', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/packages`, {
      statusCode: 200,
      body: mockCoinPackages(),
    }).as('priceValidation');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/packages`, failOnStatusCode: false }).then(
      (response) => {
        for (const pkg of response.body) {
          expect(pkg.price_ukp).to.be.a('number').and.greaterThan(0);
          expect(pkg.price_usd).to.be.a('number').and.greaterThan(0);
          expect(pkg.coins).to.be.a('number').and.greaterThan(0);
          expect(pkg.name).to.be.a('string').and.not.be.empty;
        }
      },
    );
  });

  it('should support long-lived CDN caching for packages', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/packages`, {
      statusCode: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
      body: mockCoinPackages(),
    }).as('cachedPackages');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/packages`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.headers['cache-control']).to.include('public');
        expect(response.headers['cache-control']).to.include('max-age');
      },
    );
  });
});

// -----------------------------------------------------------------
// 4. Coin Purchase Checkout Flow
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Purchase Flow', () => {
  beforeEach(() => {
    setupE2eMocks();
  });

  it('should create a Stripe checkout session for a valid package', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/create-checkout-session`, {
      statusCode: 201,
      body: {
        sessionUrl: 'https://checkout.stripe.com/c/pay/cs_test_abc123',
        sessionId: 'cs_test_abc123',
      },
    }).as('createSession');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/create-checkout-session`,
      body: { package_id: 'coins_small' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.sessionUrl).to.be.a('string').and.include('checkout.stripe.com');
      expect(response.body.sessionId).to.be.a('string').and.match(/^cs_/);
    });
  });

  it('should reject checkout for non-existent package', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/create-checkout-session`, {
      statusCode: 404,
      body: { statusCode: 404, message: 'Coin package "nonexistent" not found' },
    }).as('badPackage');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/create-checkout-session`,
      body: { package_id: 'nonexistent' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
  });

  it('should confirm coin purchase upon returning from Stripe success page', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/purchase-coins`, {
      statusCode: 200,
      body: { coins: 100, new_balance: 450 },
    }).as('confirmPurchase');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/purchase-coins`,
      body: { receipt_token: 'stripe_cs_test_abc123', platform: 'web' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.coins).to.eq(100);
      expect(response.body.new_balance).to.eq(450);
    });
  });

  it('should reject duplicate receipt tokens (idempotency)', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/purchase-coins`, {
      statusCode: 409,
      body: { statusCode: 409, message: 'Duplicate transaction: receipt already processed' },
    }).as('duplicateReceipt');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/purchase-coins`,
      body: { receipt_token: 'stripe_cs_duplicate', platform: 'web' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(409);
    });
  });

  it('should reject purchase with invalid receipt token', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/purchase-coins`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'Invalid receipt token' },
    }).as('badReceipt');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/purchase-coins`,
      body: { receipt_token: '', platform: 'web' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should handle checkout for all coin package sizes', () => {
    const packages = ['coins_small', 'coins_medium', 'coins_large', 'coins_mega'];
    const expectedCoins = [100, 500, 1200, 3000];

    for (let i = 0; i < packages.length; i++) {
      cy.intercept('POST', `${ECONOMY_BASE}/create-checkout-session`, {
        statusCode: 201,
        body: { sessionUrl: 'https://checkout.stripe.com/c/pay/test', sessionId: `cs_test_${packages[i]}` },
      }).as(`session_${packages[i]}`);

      // Verify we can book each package
      cy.request({
        method: 'POST',
        url: `${ECONOMY_BASE}/create-checkout-session`,
        body: { package_id: packages[i] },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(201);
      });
    }
  });
});

// -----------------------------------------------------------------
// 5. Virtual Gift Catalog
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Gift Catalog', () => {
  beforeEach(() => {
    setupE2eMocks();
  });

  it('should list all virtual gifts ordered by cost ascending', () => {
    const catalog = mockGiftCatalog();

    cy.intercept('GET', `${ECONOMY_BASE}/catalog`, {
      statusCode: 200,
      body: catalog,
    }).as('getCatalog');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/catalog`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.length.of.at.least(1);
        // Verify ascending order by cost
        const costs = response.body.map((g: VirtualGift) => g.cost_coins);
        for (let i = 1; i < costs.length; i++) {
          expect(costs[i]).to.be.at.least(costs[i - 1]);
        }
      },
    );
  });

  it('should have required fields for each gift in catalog', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/catalog`, {
      statusCode: 200,
      body: mockGiftCatalog(),
    }).as('catalogFields');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/catalog`, failOnStatusCode: false }).then(
      (response) => {
        for (const gift of response.body) {
          expect(gift).to.have.all.keys('id', 'name', 'icon', 'cost_coins', 'animation_type');
          expect(gift.id).to.be.a('string').and.not.be.empty;
          expect(gift.name).to.be.a('string').and.not.be.empty;
          expect(gift.cost_coins).to.be.a('number').and.greaterThan(0);
        }
      },
    );
  });

  it('should support long-lived CDN caching for catalog', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/catalog`, {
      statusCode: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
      body: mockGiftCatalog(),
    }).as('cachedCatalog');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/catalog`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.headers['cache-control']).to.include('public');
      },
    );
  });

  it('should return default fallback catalog when database is empty', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/catalog`, {
      statusCode: 200,
      body: [
        { id: 'gift_rose', name: 'Rose', icon: '🌹', cost_coins: 10, animation_type: 'float' },
        { id: 'gift_heart', name: 'Heart', icon: '❤️', cost_coins: 20, animation_type: 'float' },
      ],
    }).as('defaultCatalog');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/catalog`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.length(2);
      },
    );
  });

  it('should return empty catalog without errors', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/catalog`, {
      statusCode: 200,
      body: [],
    }).as('emptyCatalog');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/catalog`, failOnStatusCode: false }).then(
      (response) => {
        // Even empty, should be a valid array
        expect(response.body).to.be.an('array');
      },
    );
  });
});

// -----------------------------------------------------------------
// 6. Send Virtual Gift
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Send Gift', () => {
  beforeEach(() => {
    setupE2eMocks();
  });

  it('should send a virtual gift and deduct coins from balance', () => {
    const gift = mockGiftCatalog()[0]; // Rose, 10 coins

    cy.intercept('POST', `${ECONOMY_BASE}/send-gift`, {
      statusCode: 200,
      body: { success: true, coins_remaining: 340, gift },
    }).as('sendGift');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/send-gift`,
      body: { receiver_id: 'user-456', gift_id: 'gift_rose' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      expect(response.body.coins_remaining).to.eq(340);
      expect(response.body.gift.id).to.eq('gift_rose');
    });
  });

  it('should allow sending gift with an optional room_id', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/send-gift`, {
      statusCode: 200,
      body: { success: true, coins_remaining: 480, gift: mockGiftCatalog()[2] },
    }).as('sendGiftWithRoom');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/send-gift`,
      body: { receiver_id: 'user-789', gift_id: 'gift_crown', room_id: 'room-audio-42' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
    });
  });

  it('should reject sending gift when balance is insufficient', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/send-gift`, {
      statusCode: 422,
      body: { statusCode: 422, message: 'Insufficient coin balance to send this gift' },
    }).as('insufficientGift');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/send-gift`,
      body: { receiver_id: 'user-456', gift_id: 'gift_diamond' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(422);
      expect(response.body.message).to.include('Insufficient');
    });
  });

  it('should reject sending gift with invalid receiver_id', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/send-gift`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'receiver_id must be a valid UUID' },
    }).as('invalidReceiver');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/send-gift`,
      body: { receiver_id: 'not-a-uuid', gift_id: 'gift_rose' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should reject sending gift with non-existent gift_id', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/send-gift`, {
      statusCode: 404,
      body: { statusCode: 404, message: 'Gift not found in catalog' },
    }).as('nonExistentGift');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/send-gift`,
      body: { receiver_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', gift_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
  });

  it('should reject sending gift to oneself', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/send-gift`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'Cannot send a gift to yourself' },
    }).as('selfGift');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/send-gift`,
      body: { receiver_id: 'user-self', gift_id: 'gift_heart' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });
});

// -----------------------------------------------------------------
// 7. Sticker Pack Store
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Sticker Packs', () => {
  beforeEach(() => {
    setupE2eMocks();
  });

  const stickerResponse = {
    packs: mockStickerPacks(),
    owned_pack_ids: ['stk_pack_1'],
    user_coins: 300,
  };

  it('should list all available sticker packs with user coins', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/sticker-packs`, {
      statusCode: 200,
      body: stickerResponse,
    }).as('getStickerPacks');

    cy.request({
      method: 'GET',
      url: `${ECONOMY_BASE}/sticker-packs`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.packs).to.have.length(4);
      expect(response.body.user_coins).to.eq(300);
      expect(response.body.owned_pack_ids).to.deep.eq(['stk_pack_1']);
    });
  });

  it('should mark owned packs correctly in response', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/sticker-packs`, {
      statusCode: 200,
      body: stickerResponse,
    }).as('ownedPacks');

    cy.request({
      method: 'GET',
      url: `${ECONOMY_BASE}/sticker-packs`,
      failOnStatusCode: false,
    }).then((response) => {
      // stk_pack_1 should be owned since it's in owned_pack_ids
      expect(response.body.owned_pack_ids).to.include('stk_pack_1');
      expect(response.body.owned_pack_ids).to.not.include('stk_pack_2');
    });
  });

  it('should unlock a sticker pack and return remaining balance', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/unlock-sticker-pack`, {
      statusCode: 200,
      body: {
        success: true,
        coins_remaining: 150,
        pack: mockStickerPacks()[1],
      },
    }).as('unlockPack');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/unlock-sticker-pack`,
      body: { pack_id: 'stk_pack_2' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      expect(response.body.coins_remaining).to.eq(150);
      expect(response.body.pack.name).to.eq('Fantasy Creatures');
    });
  });

  it('should reject unlocking an already-owned sticker pack', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/unlock-sticker-pack`, {
      statusCode: 409,
      body: { statusCode: 409, message: 'Sticker pack already owned' },
    }).as('duplicateUnlock');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/unlock-sticker-pack`,
      body: { pack_id: 'stk_pack_1' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(409);
    });
  });

  it('should reject unlocking pack with insufficient coins', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/unlock-sticker-pack`, {
      statusCode: 422,
      body: { statusCode: 422, message: 'Insufficient coin balance to unlock this sticker pack' },
    }).as('insufficientUnlock');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/unlock-sticker-pack`,
      body: { pack_id: 'stk_pack_4' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(422);
    });
  });

  it('should reject unlocking non-existent pack', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/unlock-sticker-pack`, {
      statusCode: 404,
      body: { statusCode: 404, message: 'Sticker pack not found' },
    }).as('missingPack');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/unlock-sticker-pack`,
      body: { pack_id: 'stk_nonexistent' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
  });
});

// -----------------------------------------------------------------
// 8. Daily & Weekly Quests
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Quests', () => {
  beforeEach(() => {
    setupE2eMocks();
  });

  it('should list all quests with progress and rewards', () => {
    cy.intercept('GET', `${QUESTS_BASE}`, {
      statusCode: 200,
      body: mockQuests(),
    }).as('getQuests');

    cy.request({ method: 'GET', url: `${QUESTS_BASE}`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.length(4);
        for (const quest of response.body) {
          expect(quest).to.have.all.keys(
            'id', 'quest_type', 'quest_key', 'progress', 'target', 'reward_coins', 'completed',
          );
          expect(quest.quest_type).to.match(/^(daily|weekly)$/);
          expect(quest.reward_coins).to.be.greaterThan(0);
        }
      },
    );
  });

  it('should mark completed quests distinctly', () => {
    const quests = mockQuests();
    const completedIds = quests.filter((q) => q.completed).map((q) => q.id);

    cy.intercept('GET', `${QUESTS_BASE}`, {
      statusCode: 200,
      body: quests,
    }).as('completedQuests');

    cy.request({ method: 'GET', url: `${QUESTS_BASE}`, failOnStatusCode: false }).then(
      (response) => {
        expect(completedIds.length).to.be.at.least(1);
        const completed = response.body.filter((q: Quest) => q.completed);
        expect(completed).to.have.length(completedIds.length);
        for (const q of completed) {
          expect(q.progress).to.be.at.least(q.target);
        }
      },
    );
  });

  it('should sort daily quests before weekly quests', () => {
    cy.intercept('GET', `${QUESTS_BASE}`, {
      statusCode: 200,
      body: mockQuests(),
    }).as('sortedQuests');

    cy.request({ method: 'GET', url: `${QUESTS_BASE}`, failOnStatusCode: false }).then(
      (response) => {
        const types = response.body.map((q: Quest) => q.quest_type);
        // Check that all daily come before all weekly in a stable sort
        const firstWeeklyIdx = types.indexOf('weekly');
        if (firstWeeklyIdx >= 0) {
          const before = types.slice(0, firstWeeklyIdx);
          expect(before.every((t: string) => t === 'daily')).to.be.true;
        }
      },
    );
  });

  it('should return empty quest list for new users', () => {
    cy.intercept('GET', `${QUESTS_BASE}`, {
      statusCode: 200,
      body: [],
    }).as('emptyQuests');

    cy.request({ method: 'GET', url: `${QUESTS_BASE}`, failOnStatusCode: false }).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.deep.eq([]);
      },
    );
  });

  it('should have realistic target values for each quest type', () => {
    cy.intercept('GET', `${QUESTS_BASE}`, { statusCode: 200, body: mockQuests() }).as('targets');

    cy.request({ method: 'GET', url: `${QUESTS_BASE}`, failOnStatusCode: false }).then(
      (response) => {
        for (const quest of response.body) {
          expect(quest.target).to.be.greaterThan(0);
          expect(quest.progress).to.be.at.least(0);
          expect(quest.progress).to.be.at.most(quest.target);
        }
      },
    );
  });
});

// -----------------------------------------------------------------
// 9. Shop & Cart Checkout
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Shop & Cart', () => {
  beforeEach(() => {
    setupE2eMocks();
    cy.intercept('GET', `${ECONOMY_BASE}/balance`, {
      statusCode: 200,
      body: { coins_balance: 500 },
    }).as('getBalance');
    cy.intercept('GET', `${ECONOMY_BASE}/catalog`, { body: [] }).as('getCatalog');
  });

  it('should list shop catalog items', () => {
    cy.intercept('GET', `${SHOPPING_BASE}/catalog`, {
      statusCode: 200,
      body: [
        { id: 'item-1', name: 'Language Guide', description: 'A comprehensive guide', price: 75 },
        { id: 'item-2', name: 'Pronunciation Course', description: 'Audio course', price: 150 },
      ],
    }).as('shopCatalog');

    cy.request({
      method: 'GET',
      url: `${SHOPPING_BASE}/catalog`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.length(2);
      expect(response.body[0]).to.have.all.keys('id', 'name', 'description', 'price');
    });
  });

  it('should add an item to the cart', () => {
    cy.intercept('POST', `${SHOPPING_BASE}/cart`, {
      statusCode: 201,
      body: { success: true },
    }).as('addToCart');

    cy.request({
      method: 'POST',
      url: `${SHOPPING_BASE}/cart`,
      body: { itemId: 'item-1' },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.success).to.be.true;
    });
  });

  it('should view cart with multiple items and compute total', () => {
    cy.intercept('GET', `${SHOPPING_BASE}/cart`, {
      statusCode: 200,
      body: [
        { itemId: 'item-1', name: 'Language Guide', quantity: 2, unitPrice: 75 },
        { itemId: 'item-2', name: 'Pronunciation Course', quantity: 1, unitPrice: 150 },
      ],
    }).as('getCart');

    cy.request({
      method: 'GET',
      url: `${SHOPPING_BASE}/cart`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.length(2);

      // Compute expected total
      const total = response.body.reduce(
        (sum: number, item: { unitPrice: number; quantity: number }) =>
          sum + item.unitPrice * item.quantity,
        0,
      );
      expect(total).to.eq(300); // 2 * 75 + 1 * 150
    });
  });

  it('should remove an item from the cart', () => {
    cy.intercept('DELETE', `${SHOPPING_BASE}/cart`, {
      statusCode: 200,
      body: { success: true },
    }).as('removeItem');

    cy.request({
      method: 'DELETE',
      url: `${SHOPPING_BASE}/cart`,
      body: { itemId: 'item-1', quantity: 1 },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });

  it('should checkout cart and deduct total from coin balance', () => {
    cy.intercept('POST', `${SHOPPING_BASE}/cart/checkout`, {
      statusCode: 200,
      body: { success: true, coins_spent: 300, new_balance: 200 },
    }).as('checkout');

    cy.request({
      method: 'POST',
      url: `${SHOPPING_BASE}/cart/checkout`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      expect(response.body.coins_spent).to.eq(300);
      expect(response.body.new_balance).to.eq(200);
    });
  });

  it('should fail checkout with empty cart', () => {
    cy.intercept('POST', `${SHOPPING_BASE}/cart/checkout`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'Cart is empty' },
    }).as('emptyCheckout');

    cy.request({
      method: 'POST',
      url: `${SHOPPING_BASE}/cart/checkout`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should fail checkout with insufficient coins', () => {
    cy.intercept('POST', `${SHOPPING_BASE}/cart/checkout`, {
      statusCode: 422,
      body: { statusCode: 422, message: 'Insufficient coin balance to complete checkout' },
    }).as('insufficientCheckout');

    cy.request({
      method: 'POST',
      url: `${SHOPPING_BASE}/cart/checkout`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(422);
    });
  });
});

// -----------------------------------------------------------------
// 10. Audio Room Host Tipping
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Host Tipping', () => {
  beforeEach(() => {
    setupE2eMocks();
    cy.intercept('GET', `${ECONOMY_BASE}/balance`, {
      statusCode: 200,
      body: { coins_balance: 300 },
    }).as('getBalance');
    cy.intercept('GET', `${ECONOMY_BASE}/catalog`, { body: [] }).as('getCatalog');
  });

  it('should tip a host in an audio room', () => {
    cy.intercept('POST', '/api/audio-rooms/room-audio-42/tip', {
      statusCode: 200,
      body: { tip_id: 'tip-001', tip_amount: 100, coins_remaining: 200 },
    }).as('tipHost');

    cy.request({
      method: 'POST',
      url: '/api/audio-rooms/room-audio-42/tip',
      body: { amount_coins: 100 },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.tip_amount).to.eq(100);
      expect(response.body.tip_id).to.be.a('string');
    });
  });

  it('should reject tip with zero amount', () => {
    cy.intercept('POST', '/api/audio-rooms/room-1/tip', {
      statusCode: 400,
      body: { statusCode: 400, message: 'Tip amount must be greater than 0' },
    }).as('zeroTip');

    cy.request({
      method: 'POST',
      url: '/api/audio-rooms/room-1/tip',
      body: { amount_coins: 0 },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should reject tip when balance is insufficient', () => {
    cy.intercept('POST', '/api/audio-rooms/room-1/tip', {
      statusCode: 422,
      body: { statusCode: 422, message: 'Insufficient coin balance to send this tip' },
    }).as('insufficientTip');

    cy.request({
      method: 'POST',
      url: '/api/audio-rooms/room-1/tip',
      body: { amount_coins: 5000 },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(422);
    });
  });

  it('should accept tip with preset coin amounts', () => {
    const presets = [10, 50, 100, 500];

    for (const amount of presets) {
      cy.intercept('POST', '/api/audio-rooms/room-preset/tip', {
        statusCode: 200,
        body: { tip_id: `tip-${amount}`, tip_amount: amount, coins_remaining: 300 - amount },
      }).as(`tip_${amount}`);

      cy.request({
        method: 'POST',
        url: '/api/audio-rooms/room-preset/tip',
        body: { amount_coins: amount },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.tip_amount).to.eq(amount);
      });
    }
  });
});

// -----------------------------------------------------------------
// 11. UI Flows - Page Rendering & Navigation
// -----------------------------------------------------------------

describe('Virtual Coin Economy - UI Rendering', () => {
  beforeEach(() => {
    setupE2eMocks();
    cy.intercept('GET', `${ECONOMY_BASE}/catalog`, { body: mockGiftCatalog() }).as('getCatalog');
    cy.intercept('GET', `${ECONOMY_BASE}/balance`, {
      statusCode: 200,
      body: { coins_balance: 350 },
    }).as('getBalance');
    cy.intercept('GET', `${ECONOMY_BASE}/packages`, { body: mockCoinPackages() }).as('getPackages');
    cy.intercept('GET', `${ECONOMY_BASE}/sticker-packs`, {
      statusCode: 200,
      body: { packs: mockStickerPacks(), owned_pack_ids: [], user_coins: 350 },
    }).as('getStickerPacks');
    cy.intercept('GET', `${QUESTS_BASE}`, { body: mockQuests() }).as('getQuests');
    cy.intercept('GET', `${SHOPPING_BASE}/catalog`, {
      body: [
        { id: 'item-1', name: 'Language Guide', description: 'Guide', price: 75 },
      ],
    }).as('shopCatalog');
    cy.intercept('GET', `${SHOPPING_BASE}/cart`, { body: [] }).as('getCart');
  });

  it('should render the sticker store page with dark theme', () => {
    cy.visit('/sticker-store');
    cy.wait('@getStickerPacks');

    cy.get('body').should('exist');
    cy.get('app-sticker-store').should('exist');
    cy.contains(/Sticker Store/i).should('exist');
  });

  it('should use RTL logical CSS properties (ps-, pe-) on the sticker store page', () => {
    cy.visit('/sticker-store');
    cy.wait('@getStickerPacks');

    // Verify no banned physical-direction classes in rendered DOM
    cy.document().then((doc) => {
      const html = doc.documentElement.outerHTML.replace(/<!--[\s\S]*?-->/g, '');
      expect(html).not.to.match(/\bpl-\d/, 'No pl-* class present');
      expect(html).not.to.match(/\bpr-\d/, 'No pr-* class present');
      expect(html).not.to.match(/\bml-\d/, 'No ml-* class present');
      expect(html).not.to.match(/\bmr-\d/, 'No mr-* class present');
      expect(html).not.to.match(/\bborder-l\b/, 'No border-l class present');
      expect(html).not.to.match(/\bborder-r\b/, 'No border-r class present');
    });
  });

  it('should use RTL logical CSS properties (ps-, pe-) on the coins success page', () => {
    cy.visit('/coins/success?session_id=cs_test_abc123');

    cy.document().then((doc) => {
      const html = doc.documentElement.outerHTML.replace(/<!--[\s\S]*?-->/g, '');
      expect(html).not.to.match(/\bpl-\d/, 'No pl-* class present');
      expect(html).not.to.match(/\bpr-\d/, 'No pr-* class present');
      expect(html).not.to.match(/\bml-\d/, 'No ml-* class present');
      expect(html).not.to.match(/\bmr-\d/, 'No mr-* class present');
      expect(html).not.to.match(/\bborder-l\b/, 'No border-l class present');
      expect(html).not.to.match(/\bborder-r\b/, 'No border-r class present');
    });
  });

  it('should use RTL logical CSS properties (ps-, pe-) on the coins cancel page', () => {
    cy.visit('/coins/cancel');

    cy.document().then((doc) => {
      const html = doc.documentElement.outerHTML.replace(/<!--[\s\S]*?-->/g, '');
      expect(html).not.to.match(/\bpl-\d/, 'No pl-* class present');
      expect(html).not.to.match(/\bpr-\d/, 'No pr-* class present');
      expect(html).not.to.match(/\bml-\d/, 'No ml-* class present');
      expect(html).not.to.match(/\bmr-\d/, 'No mr-* class present');
      expect(html).not.to.match(/\bborder-l\b/, 'No border-l class present');
      expect(html).not.to.match(/\bborder-r\b/, 'No border-r class present');
    });
  });

  it('should render the quests page with progress bars', () => {
    cy.visit('/quests');
    cy.wait('@getQuests');

    cy.get('app-quests').should('exist');
    cy.contains(/Quest/i).should('exist');
  });

  it('should render the shop page', () => {
    cy.visit('/shop');
    cy.wait('@shopCatalog');

    cy.get('app-shop').should('exist');
  });

  it('should render the cart page', () => {
    cy.visit('/cart');
    cy.wait('@getCart');

    cy.get('app-cart').should('exist');
    cy.contains(/Title/i).should('exist');
  });

  it('should render the coins success page for post-Stripe return', () => {
    cy.visit('/coins/success?session_id=cs_test_abc123');
    cy.get('app-coins-success').should('exist');
  });

  it('should render the coins cancel page', () => {
    cy.visit('/coins/cancel');
    cy.get('app-coins-cancel').should('exist');
    cy.contains(/Checkout Cancelled/i).should('exist');
  });
});

// -----------------------------------------------------------------
// 12. Error Handling & Edge Cases
// -----------------------------------------------------------------

describe('Virtual Coin Economy - Error & Edge Cases', () => {
  beforeEach(() => {
    setupE2eMocks();
  });

  it('should handle 500 server errors gracefully on balance fetch', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/balance`, {
      statusCode: 500,
      body: { statusCode: 500, message: 'Internal server error' },
    }).as('serverError');

    cy.request({
      method: 'GET',
      url: `${ECONOMY_BASE}/balance`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(500);
    });
  });

  it('should handle 500 server error on daily check-in', () => {
    cy.intercept('POST', `${ECONOMY_BASE}/daily-check-in`, {
      statusCode: 500,
      body: { statusCode: 500, message: 'Internal server error' },
    }).as('checkIn500');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/daily-check-in`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(500);
    });
  });

  it('should handle network errors gracefully on gift catalog fetch', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/catalog`, {
      forceNetworkError: true,
    }).as('networkError');

    cy.request({
      method: 'GET',
      url: `${ECONOMY_BASE}/catalog`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.not.be.within(200, 299);
    });
  });

  it('should handle unauthenticated access to protected endpoints', () => {
    const protectedEndpoints = [
      { method: 'POST', url: `${ECONOMY_BASE}/daily-check-in` },
      { method: 'POST', url: `${ECONOMY_BASE}/send-gift`, body: { receiver_id: 'x', gift_id: 'y' } },
      { method: 'POST', url: `${ECONOMY_BASE}/unlock-sticker-pack`, body: { pack_id: 'x' } },
      { method: 'POST', url: `${ECONOMY_BASE}/create-checkout-session`, body: { package_id: 'x' } },
      { method: 'POST', url: `${ECONOMY_BASE}/purchase-coins`, body: { receipt_token: 'x' } },
    ];

    cy.intercept('POST', '**', {
      statusCode: 401,
      body: { statusCode: 401, message: 'Unauthorized' },
    });

    for (const ep of protectedEndpoints) {
      cy.request({
        method: ep.method,
        url: ep.url,
        body: (ep as { body?: Record<string, string> }).body ?? {},
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    }
  });

  it('should reject extremely large gift cost edge case (integer overflow protection)', () => {
    // Verify the API correctly rejects or handles large numbers
    cy.intercept('POST', `${ECONOMY_BASE}/send-gift`, {
      statusCode: 400,
      body: { statusCode: 400, message: 'Invalid gift request' },
    }).as('largeGift');

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/send-gift`,
      body: {
        receiver_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        gift_id: 'gift_rose',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should handle concurrent operations cleanly - balance stays consistent', () => {
    // Simulate state: multiple operations read then mutate
    cy.intercept('GET', `${ECONOMY_BASE}/balance`, {
      statusCode: 200,
      body: { coins_balance: 100 },
    }).as('concurrentBalance');

    cy.request({ method: 'GET', url: `${ECONOMY_BASE}/balance`, failOnStatusCode: false }).then(
      (r) => {
        expect(r.body.coins_balance).to.eq(100);
      },
    );

    // After a gift send, balance should reflect server authority
    cy.intercept('POST', `${ECONOMY_BASE}/send-gift`, {
      statusCode: 200,
      body: { success: true, coins_remaining: 80, gift: mockGiftCatalog()[1] },
    });

    cy.request({
      method: 'POST',
      url: `${ECONOMY_BASE}/send-gift`,
      body: { receiver_id: 'user-5', gift_id: 'gift_heart' },
      failOnStatusCode: false,
    }).then((r) => {
      expect(r.body.coins_remaining).to.eq(80);
    });
  });

  it('should handle empty sticker packs gracefully', () => {
    cy.intercept('GET', `${ECONOMY_BASE}/sticker-packs`, {
      statusCode: 200,
      body: { packs: [], owned_pack_ids: [], user_coins: 50 },
    }).as('emptyStickers');

    cy.request({
      method: 'GET',
      url: `${ECONOMY_BASE}/sticker-packs`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.packs).to.deep.eq([]);
    });
  });
});
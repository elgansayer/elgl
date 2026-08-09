/// <reference types="cypress" />

/**
 * Browser acceptance coverage for the current Find Partners discovery surface.
 *
 * The Angular development server renders with SSR, so the initial data request can
 * happen before Cypress owns the browser. Every test therefore performs a real
 * client-side filter change and waits for that exact request before asserting UI.
 * Backend controller contracts belong to the backend E2E suite, not this browser spec.
 */

interface PartnerRecord {
  id: string;
  display_name: string;
  avatar_url: string;
  bio_text: string;
  native_languages: string[];
  target_languages: string[];
  is_vip: boolean;
  is_serious_learner: boolean;
  mbti_personality_type?: string;
  audio_intro_url?: string;
  distance_metres?: number;
  last_active_at: string;
  interests: string[];
  shared_interests?: string[];
  vip_tier: string;
  coins_balance: number;
  study_streak_days: number;
  correction_ratio: number;
  privacy_hide_age: boolean;
  privacy_hide_location: boolean;
  privacy_hide_from_search: boolean;
  privacy_hide_gender: boolean;
  created_at: string;
}

interface MockOptions {
  partners?: PartnerRecord[];
  blockedIds?: string[];
  partnerOfWeekIds?: string[];
  partnerOfWeekUnavailable?: boolean;
  partnerDelayMs?: number;
}

let unexpectedApiRequests: string[] = [];

const transparentAvatar =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/%3E';

function makePartner(overrides: Partial<PartnerRecord> = {}): PartnerRecord {
  const now = new Date().toISOString();
  return {
    id: 'partner-001',
    display_name: 'Maria Garcia',
    avatar_url: transparentAvatar,
    bio_text: 'Learning English and looking for thoughtful conversation partners.',
    native_languages: ['ES'],
    target_languages: ['EN', 'JA'],
    is_vip: true,
    is_serious_learner: true,
    mbti_personality_type: 'ENFP',
    audio_intro_url: 'data:audio/ogg;base64,T2dnUw==',
    distance_metres: 2500,
    last_active_at: now,
    interests: ['reading', 'travel', 'photography', 'music'],
    shared_interests: ['travel', 'photography'],
    vip_tier: 'premium',
    coins_balance: 0,
    study_streak_days: 7,
    correction_ratio: 0.8,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    privacy_hide_gender: false,
    created_at: now,
    ...overrides,
  };
}

function partners(): PartnerRecord[] {
  return [
    makePartner(),
    makePartner({
      id: 'partner-002',
      display_name: 'Kenji Tanaka',
      bio_text: 'Practising conversation and helping people learn Japanese.',
      native_languages: ['JA'],
      target_languages: ['EN'],
      is_vip: false,
      is_serious_learner: false,
      mbti_personality_type: 'ISTJ',
      audio_intro_url: undefined,
      distance_metres: 8500,
      interests: ['technology', 'gaming'],
      shared_interests: undefined,
    }),
  ];
}

function userProfile(): PartnerRecord {
  return makePartner({
    id: 'mock-user-123',
    display_name: 'Test User',
    native_languages: ['EN'],
    target_languages: ['JA', 'FR'],
    is_vip: true,
    is_serious_learner: false,
    audio_intro_url: undefined,
    interests: [],
    shared_interests: undefined,
  });
}

function installApplicationMocks(options: MockOptions = {}): void {
  unexpectedApiRequests = [];
  const responsePartners = options.partners ?? partners();
  const blockedIds = options.blockedIds ?? [];
  const partnerOfWeekIds = options.partnerOfWeekIds ?? ['partner-001'];

  // Specific routes below are registered later and therefore take precedence.
  // Any unrecognised request is recorded and failed so the acceptance suite cannot
  // hide a removed or misspelt integration behind a permissive empty response.
  cy.intercept('**/api/**', (request) => {
    unexpectedApiRequests.push(`${request.method} ${new URL(request.url).pathname}`);
    request.reply({ statusCode: 418, body: { error: 'Unexpected acceptance request' } });
  });
  cy.intercept('https://mock.supabase.co/**', { statusCode: 200, body: [] });

  cy.intercept('GET', '**/api/version/minimum', {
    statusCode: 200,
    body: { minimumSupported: '1.0.0' },
  });
  cy.intercept('GET', '**/api/economy/catalog', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/economy/balance', {
    statusCode: 200,
    body: { coins_balance: 0 },
  });
  cy.intercept('GET', '**/api/economy/transactions', {
    statusCode: 200,
    body: { transactions: [] },
  });
  cy.intercept('GET', '**/api/economy/sticker-packs', {
    statusCode: 200,
    body: { packs: [], owned_pack_ids: [], user_coins: 0 },
  });
  cy.intercept('POST', '**/api/economy/daily-check-in', {
    statusCode: 200,
    body: { claimed: false, coins_rewarded: 0, new_balance: 0 },
  });
  cy.intercept('POST', '**/api/chat/token', { statusCode: 200, body: {} });
  cy.intercept('GET', '**/api/chat/rooms', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/chat/locked-rooms', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/chat/labels', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/notifications/unread-count', {
    statusCode: 200,
    body: { unreadCount: 0 },
  });
  cy.intercept('GET', '**/api/safety/blocked-ids', {
    statusCode: 200,
    body: blockedIds,
  });
  cy.intercept('GET', '**/api/safety/blocked-ids/*', {
    statusCode: 200,
    body: blockedIds,
  });
  cy.intercept('GET', '**/api/safety/blocker-ids/*', {
    statusCode: 200,
    body: blockedIds,
  });
  cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', {
    statusCode: 200,
    body: blockedIds,
  });
  cy.intercept('GET', '**/api/users/me', {
    statusCode: 200,
    body: userProfile(),
  });
  cy.intercept('PATCH', '**/api/users/me', {
    statusCode: 200,
    body: userProfile(),
  });
  if (options.partnerOfWeekUnavailable) {
    cy.intercept('GET', '**/api/discovery/partner-of-week', { forceNetworkError: true }).as(
      'getPartnerOfWeek',
    );
  } else {
    cy.intercept('GET', '**/api/discovery/partner-of-week', {
      statusCode: 200,
      body: partnerOfWeekIds,
    }).as('getPartnerOfWeek');
  }
  cy.intercept('GET', '**/api/discovery/partners*', {
    statusCode: 200,
    body: responsePartners,
    delay: options.partnerDelayMs ?? 0,
  }).as('getPartners');
}

function waitForSearch(fragment: string): Cypress.Chainable<string> {
  return cy.wait('@getPartners').then((interception) => {
    const url = interception.request.url;
    if (url.includes(fragment)) {
      return cy.wrap(url, { log: false });
    }
    return waitForSearch(fragment);
  });
}

function visitDiscoveryOnline(): void {
  cy.visit('/discovery', {
    onBeforeLoad: (window) => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value: true,
      });
    },
  });
}

function visitDiscovery(options: MockOptions = {}): void {
  installApplicationMocks(options);
  visitDiscoveryOnline();
  cy.contains('app-discovery main [role="listitem"]', 'Maria Garcia', { timeout: 15000 }).should(
    'be.visible',
  );
  cy.get('app-discovery #sortBySelect').select('nearest');
  waitForSearch('sort=nearest');
  cy.get('app-discovery main [role="list"]').should('be.visible');
  cy.contains('app-discovery main [role="listitem"]', 'Maria Garcia').should('be.visible');
}

describe('Discovery Map browser acceptance', () => {
  afterEach(() => {
    expect(unexpectedApiRequests, 'unexpected application API requests').to.deep.equal([]);
  });

  it('renders the Find Partners surface from a controlled client request', () => {
    visitDiscovery();

    cy.get('app-discovery h1').should('contain.text', 'Find partners');
    cy.get('app-discovery main [role="listitem"]').should('have.length', 2);
    cy.contains('Maria Garcia').should('be.visible');
    cy.contains('Kenji Tanaka').should('be.visible');
  });

  it('renders profile quality and language-exchange signals', () => {
    visitDiscovery();

    cy.contains('Learning English and looking for thoughtful conversation partners.').should(
      'be.visible',
    );
    cy.contains('2.5 km').should('be.visible');
    cy.contains('ENFP').should('be.visible');
    cy.contains('VIP').should('be.visible');
    cy.contains('Partner of the Week').should('be.visible');
    cy.contains('travel, photography').should('be.visible');
  });

  it('limits interest chips and shows the remaining count', () => {
    visitDiscovery();

    cy.contains('reading').should('be.visible');
    cy.contains('travel').should('be.visible');
    cy.contains('photography').should('be.visible');
    cy.contains('+1').should('be.visible');
  });

  it('exposes accessible partner cards, avatars and audio controls', () => {
    visitDiscovery();

    cy.get('app-discovery main [role="listitem"]')
      .first()
      .should('have.attr', 'aria-label', 'Language partner: Maria Garcia');
    cy.get('img[alt="Avatar of Maria Garcia"]').should('be.visible');
    cy.get('button[aria-label="Play introduction"]').should(
      'have.attr',
      'aria-pressed',
      'false',
    );
  });

  it('navigates from a partner card to the matching chat', () => {
    visitDiscovery();

    cy.get('app-discovery main [role="listitem"]').first().click();
    cy.location('pathname').should('eq', '/chat/partner-001');
  });

  it('sends the selected sort order to the API', () => {
    visitDiscovery();

    cy.get('#sortBySelect').should('have.value', 'nearest');
  });

  it('applies the serious learner pill', () => {
    visitDiscovery();

    cy.get('app-scrollable-pills').contains('button', 'Serious Learners Only').click();
    waitForSearch('serious_learner_only=true');
    cy.get('app-discovery main [role="listitem"]').should('have.length', 1);
    cy.contains('Maria Garcia').should('be.visible');
  });

  it('applies the near-me distance band', () => {
    visitDiscovery();

    cy.get('app-scrollable-pills').contains('button', 'Near Me (Radius)').click();
    waitForSearch('radius_metres=10000');
  });

  it('applies the city distance band', () => {
    visitDiscovery();

    cy.get('app-scrollable-pills').contains('button', 'City Level').click();
    waitForSearch('radius_metres=25000');
  });

  it('applies list-driven global language and proficiency filters', () => {
    visitDiscovery();

    cy.get('#global-nativeLanguages').select('es');
    cy.get('#global-targetLanguage').select('ja');
    cy.get('#global-proficiencyLevel').select('b1');
    cy.get('app-global-search button').click();
    waitForSearch('native_languages=es')
      .should('include', 'target_language=ja')
      .and('include', 'level=b1');
  });

  it('applies the voice-room-active filter', () => {
    visitDiscovery();

    cy.get('#voiceRoomActiveCheckbox').check();
    waitForSearch('voice_room_active=true');
  });

  it('shows VIP controls for the authenticated VIP mock user', () => {
    visitDiscovery();

    cy.get('#genderSelect').should('not.be.disabled').select('female');
    waitForSearch('gender=female');
    cy.get('app-distance-slider input').should('not.be.disabled');
  });

  it('dismisses the promotional banner with an accessible close action', () => {
    visitDiscovery();

    cy.contains('Unlock Paid Practice').should('be.visible');
    cy.get('app-discovery button[aria-label="Close"]').click();
    cy.contains('Unlock Paid Practice').should('not.exist');
  });

  it('navigates from the promotional action to VIP', () => {
    visitDiscovery();

    cy.get('app-discovery button[aria-label="View VIP"]').click();
    cy.location('pathname').should('eq', '/vip');
  });

  it('shows and recovers from the empty state', () => {
    installApplicationMocks({ partners: [] });
    visitDiscoveryOnline();
    cy.get('app-empty-state', { timeout: 15000 }).should('exist');
    cy.get('app-discovery #sortBySelect').select('nearest');
    waitForSearch('sort=nearest');

    cy.get('app-empty-state').should('exist');
    cy.intercept('GET', '**/api/discovery/partners?*sort=best_match*').as('resetPartners');
    cy.get('app-empty-state button').click({ force: true });
    cy.wait('@resetPartners');
    cy.get('app-discovery #sortBySelect').should('have.value', 'best_match');
  });

  it('announces loading while a client search is in flight', () => {
    installApplicationMocks({ partnerDelayMs: 3000 });
    visitDiscoveryOnline();
    cy.contains('app-discovery main [role="listitem"]', 'Maria Garcia', { timeout: 15000 }).should(
      'be.visible',
    );
    cy.get('app-discovery #sortBySelect').select('nearest');

    cy.get('app-discovery section[aria-busy="true"]').should('be.visible');
    waitForSearch('sort=nearest');
    cy.get('app-discovery section[aria-busy="true"]').should('not.exist');
  });

  it('filters blocked users out of returned partner data', () => {
    visitDiscovery({ blockedIds: ['partner-002'] });

    cy.contains('Maria Garcia').should('be.visible');
    cy.contains('Kenji Tanaka').should('not.exist');
  });

  it('degrades safely when the partner-of-week endpoint is unavailable', () => {
    visitDiscovery({ partnerOfWeekUnavailable: true });

    cy.contains('Maria Garcia').should('be.visible');
    cy.contains('Partner of the Week').should('not.exist');
  });

  it('keeps responsive list layouts for mobile, tablet and desktop', () => {
    visitDiscovery();

    cy.get('app-discovery main [role="list"]')
      .should('have.class', 'grid-cols-1')
      .and('have.class', 'md:grid-cols-2')
      .and('have.class', 'lg:grid-cols-3');
  });
});

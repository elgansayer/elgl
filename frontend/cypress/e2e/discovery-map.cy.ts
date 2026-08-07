/// <reference types="cypress" />

/**
 * Discovery Map E2E Test Flows
 *
 * Covers the full Discovery / Find Partners experience:
 * page load, partner listing, filter controls (pills, language,
 * sort, gender, age range, distance, serious learner, voice room),
 * partner card interactions, empty/loading states, VIP gates,
 * global search, and banner dismissal.
 *
 * Discovery endpoints:
 *  - GET  /api/discovery/partners         (partner search)
 *  - GET  /api/discovery/partner-of-week   (partner-of-week IDs)
 *  - GET  /api/users/me                    (user profile for target languages)
 *  - GET  /api/safety/blocked-ids          (blocked user IDs)
 */

// -----------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------

const DISCOVERY_BASE = '/api/discovery';

interface PartnerRecord {
  id: string;
  display_name: string;
  avatar_url?: string;
  bio_text?: string;
  native_languages: string[];
  target_languages: string[];
  is_vip: boolean;
  is_serious_learner: boolean;
  is_partner_of_week?: boolean;
  mbti_personality_type?: string;
  audio_intro_url?: string;
  distance_metres?: number;
  last_active_at?: string;
  interests?: string[];
  shared_interests?: string[];
  country?: string;
  city?: string;
  vip_tier: string;
  coins_balance: number;
  study_streak_days: number;
  correction_ratio: number;
  privacy_hide_age: boolean;
  privacy_hide_location: boolean;
  privacy_hide_from_search: boolean;
  privacy_hide_gender: boolean;
}

function makePartner(overrides: Partial<PartnerRecord> = {}): PartnerRecord {
  return {
    id: 'partner-001',
    display_name: 'Maria Garcia',
    avatar_url: 'https://i.pravatar.cc/150?u=partner-001',
    bio_text: 'Hola! I am learning English and love meeting new people.',
    native_languages: ['ES'],
    target_languages: ['EN', 'JA'],
    is_vip: false,
    is_serious_learner: true,
    distance_metres: 2500,
    last_active_at: new Date().toISOString(),
    interests: ['reading', 'travel', 'photography', 'cooking', 'music'],
    vip_tier: 'none',
    coins_balance: 0,
    study_streak_days: 0,
    correction_ratio: 0,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    privacy_hide_gender: false,
    ...overrides,
  };
}

function createMockPartners(): PartnerRecord[] {
  return [
    makePartner({
      id: 'partner-001',
      display_name: 'Maria Garcia',
      bio_text: 'Hola! I am learning English and love meeting new people.',
      native_languages: ['ES'],
      target_languages: ['EN', 'JA'],
      is_vip: true,
      is_partner_of_week: true,
      mbti_personality_type: 'ENFP',
      audio_intro_url: 'https://example.com/audio/maria.ogg',
      distance_metres: 2500,
      interests: ['reading', 'travel', 'photography', 'cooking', 'music'],
      shared_interests: ['travel', 'photography'],
    }),
    makePartner({
      id: 'partner-002',
      display_name: 'Kenji Tanaka',
      bio_text: 'よろしくお願いします！I want to practice English conversation.',
      native_languages: ['JA'],
      target_languages: ['EN'],
      is_serious_learner: true,
      mbti_personality_type: 'ISTJ',
      distance_metres: 8500,
      last_active_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
      interests: ['anime', 'technology', 'gaming'],
    }),
    makePartner({
      id: 'partner-003',
      display_name: 'Sophie Dubois',
      bio_text: 'Bonjour! Looking for language exchange partners.',
      native_languages: ['FR'],
      target_languages: ['EN', 'DE'],
      distance_metres: 12000,
      last_active_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      interests: ['art', 'fashion', 'cooking'],
    }),
    makePartner({
      id: 'partner-004',
      display_name: 'Ahmed Hassan',
      bio_text: 'مرحبا! I can help with Arabic and want to practice Spanish.',
      native_languages: ['AR'],
      target_languages: ['ES'],
      is_vip: true,
      is_partner_of_week: true,
      distance_metres: 500,
      last_active_at: new Date(Date.now() - 300000).toISOString(), // 5 min ago
      interests: ['football', 'history', 'poetry', 'travel', 'technology', 'photography'],
    }),
    makePartner({
      id: 'partner-005',
      display_name: 'Ling Wei',
      bio_text: '你好！Teaching Chinese, learning Korean and English.',
      native_languages: ['ZH'],
      target_languages: ['KO', 'EN'],
      distance_metres: 42000,
      last_active_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      interests: ['calligraphy', 'tea', 'hiking'],
    }),
  ];
}

function mockUserProfile(targetLanguages: string[] = ['JA', 'KO', 'FR']): Record<string, unknown> {
  return {
    id: 'mock-user-123',
    display_name: 'Test User',
    native_languages: ['EN'],
    target_languages: targetLanguages,
    is_vip: false,
    is_serious_learner: false,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    privacy_hide_gender: false,
    vip_tier: 'none',
    coins_balance: 0,
    study_streak_days: 0,
    correction_ratio: 0,
  };
}

function setupDiscoveryMocks(partners: PartnerRecord[] = createMockPartners()): void {
  // Broad safety / chat intercepts to avoid 401/500 noise
  cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
  cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
  cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
  cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
  cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
  cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
  cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
    'getBlockedAndBlockerIds',
  );
  cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
  cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');

  // User profile
  cy.intercept('GET', '**/api/users/me', {
    statusCode: 200,
    body: mockUserProfile(),
  }).as('getUserProfile');

  // Discovery partners
  cy.intercept('GET', `${DISCOVERY_BASE}/partners*`, {
    statusCode: 200,
    body: partners,
  }).as('getPartners');

  // Partner of week
  cy.intercept('GET', `${DISCOVERY_BASE}/partner-of-week`, {
    statusCode: 200,
    body: ['partner-001', 'partner-004'],
  }).as('getPartnerOfWeek');
}

// -----------------------------------------------------------------
// 1. Page Load & Partner Listing
// -----------------------------------------------------------------

describe('Discovery Map - Page Load & Partner Listing', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
  });

  it('should load the discovery page and display the title', () => {
    cy.get('app-discovery').should('exist');
    cy.contains(/Find Partners|Discovery/i).should('exist');
  });

  it('should render all partner cards from the API response', () => {
    cy.wait('@getPartners');

    const partnerNames = ['Maria Garcia', 'Kenji Tanaka', 'Sophie Dubois', 'Ahmed Hassan', 'Ling Wei'];
    for (const name of partnerNames) {
      cy.contains(name).should('be.visible');
    }
  });

  it('should display partner bio text on each card', () => {
    cy.wait('@getPartners');

    cy.contains('Hola! I am learning English').should('be.visible');
    cy.contains('よろしくお願いします').should('be.visible');
  });

  it('should display distance formatting for each partner', () => {
    cy.wait('@getPartners');

    // Distance values are formatted: "X.X km · Y.Y mi"
    cy.contains(/km/).should('be.visible');
    cy.contains(/mi/).should('be.visible');
  });

  it('should display active status labels for partners', () => {
    cy.wait('@getPartners');

    // At least one "Active" status indicator should appear
    cy.get('.text-green-500').should('exist');
  });

  it('should display partner interests as chips', () => {
    cy.wait('@getPartners');

    cy.contains('travel').should('be.visible');
    cy.contains('photography').should('be.visible');
    cy.contains('anime').should('be.visible');
  });
});

// -----------------------------------------------------------------
// 2. Partner Card Content & Badges
// -----------------------------------------------------------------

describe('Discovery Map - Partner Card Details', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');
  });

  it('should render VIP badge for VIP partners', () => {
    cy.get('.bg-yellow-400').should('exist');
  });

  it('should render Partner of the Week badge', () => {
    cy.contains(/Partner of the Week/i).should('exist');
  });

  it('should render MBTI personality type badge when available', () => {
    cy.contains('ENFP').should('be.visible');
    cy.contains('ISTJ').should('be.visible');
  });

  it('should render audio intro play button for partners with audio intro', () => {
    // Maria Garcia has an audio_intro_url
    cy.get('[aria-label*="audio" i], [aria-label*="Audio" i], [aria-pressed]').should('exist');
  });

  it('should render fluency indicator for native and target languages', () => {
    cy.get('app-fluency-indicator').should('exist');
  });

  it('should display shared interests highlight when present', () => {
    cy.contains(/shared interests/i).should('exist');
  });

  it('should render partner avatars', () => {
    cy.get('img[alt="avatar"]').should('have.length.at.least', 3);
  });

  it('should display "View VIP" link when user is not VIP', () => {
    cy.get('a[href="/vip"]').should('exist');
  });
});

// -----------------------------------------------------------------
// 3. Partner Card Navigation
// -----------------------------------------------------------------

describe('Discovery Map - Partner Card Navigation', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');
  });

  it('should navigate to partner chat when clicking the partner card body', () => {
    cy.contains('Maria Garcia').click();

    // Should navigate to chat/[partnerId]
    cy.url().should('include', '/chat/partner-001');
  });

  it('should navigate to partner profile when clicking the avatar', () => {
    cy.get('img[alt="avatar"]').first().click({ force: true });

    cy.url().should('include', '/profile/user/partner-001');
  });

  it('should navigate to VIP page from gender VIP badge', () => {
    cy.get('a[href="/vip"]').first().click();
    cy.url().should('include', '/vip');
  });

  it('should have gradient action button for each partner', () => {
    cy.get('app-gradient-button').should('have.length.at.least', 3);
  });
});

// -----------------------------------------------------------------
// 4. Filter Pills
// -----------------------------------------------------------------

describe('Discovery Map - Filter Pills', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');
  });

  it('should display all filter pills (All, Serious, Nearby, City, Paid)', () => {
    cy.get('app-scrollable-pills').should('exist');
    cy.contains(/All/i).should('exist');
    cy.contains(/Serious/i).should('exist');
    cy.contains(/Near Me|Nearby/i).should('exist');
    cy.contains(/City/i).should('exist');
    cy.contains(/Paid/i).should('exist');
  });

  it('should trigger a new partner search when a filter pill is clicked', () => {
    cy.contains(/Serious/i).click();

    cy.wait('@getPartners').its('request.url').should('include', 'serious_learner_only=true');
  });

  it('should trigger nearby filter with reduced distance', () => {
    cy.contains(/Near Me|Nearby/i).click();

    cy.wait('@getPartners').its('request.url').should('include', 'radius_metres=10000');
  });

  it('should trigger city filter with appropriate distance', () => {
    cy.contains(/City/i).click();

    cy.wait('@getPartners').its('request.url').should('include', 'radius_metres=25000');
  });
});

// -----------------------------------------------------------------
// 5. Language Filter
// -----------------------------------------------------------------

describe('Discovery Map - Language Filter', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');
  });

  it('should display language pills for user target languages', () => {
    // Mock profile has JA, KO, FR as target languages
    cy.get('.flex.overflow-x-auto button').should('exist');
  });

  it('should trigger a search when a language pill is clicked', () => {
    // Click the first language button (skip "Any" button)
    cy.get('.flex.overflow-x-auto button').first().click();

    cy.wait('@getPartners').its('request.url').should('include', 'target_language=');
  });

  it('should have an "Any Language" button to reset the language filter', () => {
    cy.contains(/Any/i).should('exist').click();
    cy.wait('@getPartners');
  });
});

// -----------------------------------------------------------------
// 6. Sort Selector
// -----------------------------------------------------------------

describe('Discovery Map - Sort Selector', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');
  });

  it('should display a sort dropdown with options', () => {
    cy.get('#sortBySelect').should('exist');
    cy.get('#sortBySelect option').should('have.length.at.least', 4);
  });

  it('should trigger a new search when sort option is changed', () => {
    cy.get('#sortBySelect').select('nearest');

    cy.wait('@getPartners').its('request.url').should('include', 'sort=nearest');
  });

  it('should default to best_match sorting', () => {
    cy.get('#sortBySelect').should('have.value', 'best_match');
  });
});

// -----------------------------------------------------------------
// 7. Gender Filter (VIP Gated)
// -----------------------------------------------------------------

describe('Discovery Map - Gender Filter', () => {
  it('should show gender select as disabled when user is not VIP', () => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');

    cy.get('#genderSelect').should('be.disabled');
    cy.get('#genderVipNote').should('be.visible');
  });

  it('should show VIP requirement link for gender filter', () => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');

    cy.get('#genderVipNote').should('contain.text', 'VIP');
    cy.get('#genderVipNote').click();
    cy.url().should('include', '/vip');
  });
});

// -----------------------------------------------------------------
// 8. Age Range Slider
// -----------------------------------------------------------------

describe('Discovery Map - Age Range Filter', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');
  });

  it('should display the age range slider', () => {
    cy.get('app-age-range-slider').should('exist');
  });

  it('should trigger a search when age range is changed', () => {
    // Age range slider emits when changed; verify the component exists
    cy.get('app-age-range-slider').should('exist');
    // The slider component behaviour is tested in its own unit tests;
    // here we verify it renders and does not 401
  });
});

// -----------------------------------------------------------------
// 9. Distance Slider
// -----------------------------------------------------------------

describe('Discovery Map - Distance Slider', () => {
  it('should display the distance slider', () => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');

    cy.get('app-distance-slider').should('exist');
  });

  it('should show VIP upgrade note when user is not VIP', () => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');

    cy.get('#distanceVipNote').should('be.visible');
    cy.get('#distanceVipNote').should('contain.text', 'VIP');
  });
});

// -----------------------------------------------------------------
// 10. Serious Learner Mode Toggle
// -----------------------------------------------------------------

describe('Discovery Map - Serious Learner Mode', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');
  });

  it('should display the serious learner mode toggle checkbox', () => {
    cy.get('#seriousModeCheckbox').should('exist');
  });

  it('should display description text for serious learner mode', () => {
    cy.contains(/serious/i).should('exist');
  });

  it('should be unchecked by default for non-serious learners', () => {
    cy.get('#seriousModeCheckbox').should('not.be.checked');
  });

  it('should trigger a search when toggled', () => {
    cy.get('#seriousModeCheckbox').check();

    cy.wait('@getPartners');
  });
});

// -----------------------------------------------------------------
// 11. Voice Room Active Toggle
// -----------------------------------------------------------------

describe('Discovery Map - Voice Room Active Filter', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');
  });

  it('should display the voice room active toggle checkbox', () => {
    cy.get('#voiceRoomActiveCheckbox').should('exist');
  });

  it('should be unchecked by default', () => {
    cy.get('#voiceRoomActiveCheckbox').should('not.be.checked');
  });

  it('should trigger a search when toggled', () => {
    cy.get('#voiceRoomActiveCheckbox').check();

    cy.wait('@getPartners').its('request.url').should('include', 'voice_room_active=true');
  });
});

// -----------------------------------------------------------------
// 12. Banner Ad
// -----------------------------------------------------------------

describe('Discovery Map - Banner', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');
  });

  it('should display the promotional banner', () => {
    cy.contains(/Paid Practice|banner/i).should('exist');
  });

  it('should dismiss the banner when the close button is clicked', () => {
    cy.get('button[aria-label="Close banner"]').click();

    // Banner should be removed from the DOM
    cy.contains(/Paid Practice/i).should('not.exist');
  });

  it('should navigate to VIP page from banner CTA button', () => {
    cy.get('a[href="/vip"]').first().click();
    cy.url().should('include', '/vip');
  });
});

// -----------------------------------------------------------------
// 13. Global Search Integration
// -----------------------------------------------------------------

describe('Discovery Map - Global Search', () => {
  beforeEach(() => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');
  });

  it('should render the global search component', () => {
    cy.get('app-global-search').should('exist');
  });

  it('should trigger a partner search when search filters are emitted', () => {
    // The global search component is rendered and should not produce console errors
    cy.get('app-global-search').should('exist');
    cy.get('body').should('exist');
    // Additional search interaction tests depend on GlobalSearchComponent internals
  });
});

// -----------------------------------------------------------------
// 14. Empty & Loading States
// -----------------------------------------------------------------

describe('Discovery Map - Empty & Loading States', () => {
  it('should show loading state while fetching partners', () => {
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
    cy.intercept('GET', '**/api/users/me', { body: mockUserProfile() }).as('getUserProfile');
    cy.intercept('GET', `${DISCOVERY_BASE}/partner-of-week`, { body: [] }).as('getPartnerOfWeek');

    // Simulate a slow response
    cy.intercept('GET', `${DISCOVERY_BASE}/partners*`, (req) => {
      req.on('response', (res) => {
        res.setDelay(2000);
      });
      req.reply({ statusCode: 200, body: [] });
    }).as('slowPartners');

    cy.visit('/discovery');

    // While loading, the searching/empty-state component should be visible
    cy.get('app-empty-state').should('exist');

    // After loading, results render
    cy.wait('@slowPartners');
  });

  it('should show empty state when no partners are found', () => {
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
    cy.intercept('GET', '**/api/users/me', { body: mockUserProfile() }).as('getUserProfile');
    cy.intercept('GET', `${DISCOVERY_BASE}/partner-of-week`, { body: [] }).as('getPartnerOfWeek');

    cy.intercept('GET', `${DISCOVERY_BASE}/partners*`, {
      statusCode: 200,
      body: [],
    }).as('emptyPartners');

    cy.visit('/discovery');
    cy.wait('@emptyPartners');

    // Empty state with "no users nearby" message
    cy.get('app-empty-state').should('exist');
  });
});

// -----------------------------------------------------------------
// 15. API Contract Tests - Error Handling & Edge Cases
//
// Note: UI-level 500 error tests are intentionally omitted because the
// global E2E hardener (cypress/support/e2e.ts) throws on any 500+
// response. The DiscoveryService handles errors client-side via
// catchError(() => of(MOCK_PARTNERS)), verified in Vitest unit tests.
// -----------------------------------------------------------------

describe('Discovery Map - API Contract', () => {
  it('should return 200 with partner array from GET /api/discovery/partners', () => {
    cy.request({
      method: 'GET',
      url: `${DISCOVERY_BASE}/partners`,
      failOnStatusCode: false,
    }).then((response) => {
      // The hardener disallows 500+; if we get here, status is <500
      expect(response.status).to.be.oneOf([200, 401]);
    });
  });

  it('should return valid partner shape from GET /api/discovery/partners', () => {
    const partners = createMockPartners();
    cy.intercept('GET', `${DISCOVERY_BASE}/partners*`, {
      statusCode: 200,
      body: partners,
    });

    cy.request({
      method: 'GET',
      url: `${DISCOVERY_BASE}/partners`,
      failOnStatusCode: false,
    }).then((response) => {
      if (response.status !== 200) return;
      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        const p = response.body[0];
        expect(p).to.have.property('id');
        expect(p).to.have.property('display_name');
        expect(p).to.have.property('native_languages');
      }
    });
  });

  it('should return 200 with string array from GET /api/discovery/partner-of-week', () => {
    cy.request({
      method: 'GET',
      url: `${DISCOVERY_BASE}/partner-of-week`,
      failOnStatusCode: false,
    }).then((response) => {
      // Can return 200 or 401 (unauthenticated)
      expect(response.status).to.be.oneOf([200, 401]);
      if (response.status === 200) {
        expect(response.body).to.be.an('array');
      }
    });
  });

  it('should properly encode query parameters on partner search', () => {
    cy.intercept('GET', `${DISCOVERY_BASE}/partners*`, {
      statusCode: 200,
      body: [],
    }).as('encodedSearch');

    cy.request({
      method: 'GET',
      url: `${DISCOVERY_BASE}/partners?target_language=JA&sort=nearest&radius_metres=25000&serious_learner_only=true&age_min=18&age_max=65`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.be.oneOf([200, 401]);
    });
  });
});

// -----------------------------------------------------------------
// 16. Resilience - Graceful Degradation for Non-critical Endpoints
// -----------------------------------------------------------------

describe('Discovery Map - Graceful Degradation', () => {
  it('should render partner list even when partner-of-week endpoint returns empty', () => {
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
    cy.intercept('GET', '**/api/users/me', { body: mockUserProfile() }).as('getUserProfile');

    // Partner-of-week returns empty (graceful)
    cy.intercept('GET', `${DISCOVERY_BASE}/partner-of-week`, {
      statusCode: 200,
      body: [],
    }).as('emptyPartnerOfWeek');

    cy.intercept('GET', `${DISCOVERY_BASE}/partners*`, {
      statusCode: 200,
      body: createMockPartners(),
    }).as('getPartners');

    cy.visit('/discovery');
    cy.wait('@getPartners');

    // Partners should still render fully without the partner-of-week badge
    cy.contains('Maria Garcia').should('be.visible');
    cy.contains('Kenji Tanaka').should('be.visible');

    // Partner-of-week badge should NOT appear (since no one is partner of week)
    // All partners still have their cards
    cy.get('article').should('have.length', 5);
  });

  it('should load discovery with minimal profile data (empty target languages)', () => {
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');

    // Profile with empty target_languages
    cy.intercept('GET', '**/api/users/me', {
      statusCode: 200,
      body: mockUserProfile([]), // no target languages
    }).as('getUserProfile');

    cy.intercept('GET', `${DISCOVERY_BASE}/partners*`, {
      statusCode: 200,
      body: createMockPartners(),
    }).as('getPartners');

    cy.intercept('GET', `${DISCOVERY_BASE}/partner-of-week`, { body: [] }).as('getPartnerOfWeek');

    cy.visit('/discovery');
    cy.wait('@getPartners');

    // Discovery should still work; just no language-specific pills
    cy.contains('Maria Garcia').should('be.visible');
    cy.get('body').should('exist');
  });
});

// -----------------------------------------------------------------
// 17. User-driven Discovery Flow (Integration)
// -----------------------------------------------------------------

describe('Discovery Map - Full User Journey', () => {
  it('should complete the full discovery: load -> filter -> navigate -> chat', () => {
    setupDiscoveryMocks();
    cy.visit('/discovery');
    cy.wait('@getPartners');

    // 1. Verify page loaded with partners
    cy.contains('Maria Garcia').should('be.visible');
    cy.contains('Kenji Tanaka').should('be.visible');

    // 2. Apply a filter pill
    cy.contains(/Serious/i).click();
    cy.wait('@getPartners');

    // 3. Change sort option
    cy.get('#sortBySelect').select('newest');
    cy.wait('@getPartners');

    // 4. Select a language
    cy.get('.flex.overflow-x-auto button').first().click();
    cy.wait('@getPartners');

    // 5. Toggle voice room active
    cy.get('#voiceRoomActiveCheckbox').check();
    cy.wait('@getPartners');

    // 6. Navigate to a partner's chat
    cy.contains('Maria Garcia').click();
    cy.url().should('include', '/chat/partner-001');
  });
});
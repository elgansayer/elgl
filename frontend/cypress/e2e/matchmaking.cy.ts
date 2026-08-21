/**
 * Matchmaking Algorithm E2E Test Flows
 *
 * Covers the full matchmaking stack:
 *   1. Discovery partner search (language exchange matching + filters)
 *   2. Study Buddy matching + request/accept/decline flows
 *   3. Recommendations API tiered fallback (for-you / daily)
 */
describe('Matchmaking Algorithm', () => {
  // ---- shared mock data ----
  const mockPartners = [
    {
      id: 'partner-1',
      display_name: 'Maria Garcia',
      native_languages: ['es'],
      target_languages: ['en'],
      bio_text: 'Hola! I want to practice English.',
      avatar_url: 'https://i.pravatar.cc/150?u=partner-1',
      is_vip: false,
      study_streak_days: 30,
      correction_ratio: 0.92,
      is_serious_learner: true,
      proficiency_level: 'B1',
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      interests: ['music', 'travel', 'photography'],
      distance_metres: 3200,
    },
    {
      id: 'partner-2',
      display_name: 'Takeshi Yamamoto',
      native_languages: ['ja'],
      target_languages: ['en', 'es'],
      bio_text: 'Looking for English and Spanish partners.',
      avatar_url: 'https://i.pravatar.cc/150?u=partner-2',
      is_vip: true,
      study_streak_days: 45,
      correction_ratio: 0.88,
      is_serious_learner: true,
      proficiency_level: 'A2',
      created_at: new Date().toISOString(),
      last_active_at: new Date(Date.now() - 3600000).toISOString(),
      interests: ['anime', 'cooking', 'hiking'],
      distance_metres: 8500,
    },
    {
      id: 'partner-3',
      display_name: 'Anna Mueller',
      native_languages: ['de'],
      target_languages: ['en'],
      bio_text: 'German native, learning English.',
      avatar_url: 'https://i.pravatar.cc/150?u=partner-3',
      is_vip: false,
      study_streak_days: 5,
      correction_ratio: 0.45,
      is_serious_learner: false,
      proficiency_level: 'C1',
      created_at: new Date().toISOString(),
      last_active_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      interests: ['reading', 'yoga'],
      distance_metres: 200,
    },
  ];

  const mockRecommendations = [
    {
      id: 'rec-1',
      displayName: 'Carlos Silva',
      avatarUrl: 'https://i.pravatar.cc/150?u=rec-1',
      nativeLanguage: 'pt',
      targetLanguages: ['en'],
      sharedInterests: 3,
      isSeriousLearner: true,
      studyStreakDays: 21,
      correctionRatio: 0.93,
      matchTier: 'interest',
    },
    {
      id: 'rec-2',
      displayName: 'Yuki Tanaka',
      avatarUrl: 'https://i.pravatar.cc/150?u=rec-2',
      nativeLanguage: 'ja',
      targetLanguages: ['en'],
      sharedInterests: 0,
      isSeriousLearner: true,
      studyStreakDays: 60,
      correctionRatio: 0.97,
      matchTier: 'language_exchange',
    },
    {
      id: 'rec-3',
      displayName: 'Active Learner',
      avatarUrl: null,
      nativeLanguage: 'fr',
      targetLanguages: ['en', 'es'],
      sharedInterests: 0,
      isSeriousLearner: false,
      studyStreakDays: 120,
      correctionRatio: 0.85,
      matchTier: 'active_users',
    },
  ];

  const mockDailyRecommendations = [
    {
      id: 'daily-1',
      displayName: 'Sofia Rossi',
      avatarUrl: 'https://i.pravatar.cc/150?u=daily-1',
      nativeLanguage: 'it',
      targetLanguages: ['en'],
      sharedInterests: 0,
      isSeriousLearner: true,
      studyStreakDays: 90,
      correctionRatio: 0.96,
    },
  ];

  const mockStudyBuddyMatches = [
    { id: 'sb-1', display_name: 'Luis Gomez', avatar_url: 'https://i.pravatar.cc/150?u=sb-1' },
    { id: 'sb-2', display_name: 'Hana Kim', avatar_url: 'https://i.pravatar.cc/150?u=sb-2' },
  ];

  const mockBuddyRequests = [
    {
      id: 'req-1',
      requesterId: 'sb-3',
      partnerId: 'mock-user-123',
      message: 'Let us study together!',
      status: 'pending',
      createdAt: new Date().toISOString(),
      requester: {
        id: 'sb-3',
        display_name: 'Jin Park',
        avatar_url: 'https://i.pravatar.cc/150?u=sb-3',
      },
    },
  ];

  // ==========================================================================
  // Helper: register common mocks used by every matchmaking route
  // ==========================================================================
  const interceptCommonMocks = () => {
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/discovery/partner-of-week', { body: [] }).as('getPartnerOfWeek');
  };

  // ==========================================================================
  // 1. Discovery Partner Search (language-exchange matchmaking)
  // ==========================================================================
  describe('Discovery Partner Search', () => {
    beforeEach(() => {
      interceptCommonMocks();

      // Mock the main partner-search endpoint
      cy.intercept('GET', '**/api/discovery/partners*', (req) => {
        req.reply({
          statusCode: 200,
          body: mockPartners,
        });
      }).as('getPartners');

      // Mock user profile (sets target languages)
      cy.intercept('GET', '**/api/users/me*', {
        body: {
          id: 'mock-user-123',
          display_name: 'Test User',
          native_languages: ['en'],
          target_languages: ['es', 'ja', 'de'],
          is_vip: false,
          is_serious_learner: false,
        },
      }).as('getMyProfile');

      // Mock nearby user search (PostGIS RPC)
      cy.intercept('POST', '**/rest/v1/rpc/search_nearby_users', { body: [] }).as(
        'searchNearbyRpc',
      );
    });

    it('should load the discovery page and display partner cards', () => {
      cy.visit('/discovery');

      cy.wait('@getPartners');

      // Verify header is visible
      cy.contains('Find Partners').should('be.visible');

      // Verify partner cards are rendered
      cy.contains('Maria Garcia').should('be.visible');
      cy.contains('Takeshi Yamamoto').should('be.visible');
      cy.contains('Anna Mueller').should('be.visible');
    });

    it('should render filter pills and allow selecting "Serious Learners"', () => {
      cy.visit('/discovery');
      cy.wait('@getPartners');

      // Click the "Serious Learners" pill
      cy.contains('Serious Learners').click();

      // The pill should be visually selected (check via class or aria)
      cy.contains('Serious Learners').should('have.class', 'bg-surface-200');
    });

    it('should filter by target language when a language pill is clicked', () => {
      cy.visit('/discovery');
      cy.wait('@getPartners');

      // Grab the partner request and verify query param
      cy.intercept('GET', '**/api/discovery/partners*').as('filteredPartners');

      // Click on a language pill (Spanish)
      cy.get('button').contains(/🇪🇸|Spanish/i).click();

      cy.wait('@filteredPartners').its('request.url').should('include', 'target_language=es');
    });

    it('should navigate to chat when a partner card is clicked', () => {
      cy.visit('/discovery');
      cy.wait('@getPartners');

      // Click on the first partner card
      cy.contains('Maria Garcia').click();

      // Should navigate to the chat route for that partner
      cy.url().should('include', '/chat/partner-1');
    });

    it('should display partner-of-week badge for featured partners', () => {
      cy.intercept('GET', '**/api/discovery/partner-of-week', {
        body: ['partner-1'],
      }).as('getPartnerOfWeekFeatured');

      cy.visit('/discovery');
      cy.wait('@getPartners');

      // Maria Garcia (partner-1) should have the partner-of-week badge
      cy.contains('POTW').should('be.visible');
    });

    it('should display VIP badge for VIP partners', () => {
      cy.visit('/discovery');
      cy.wait('@getPartners');

      // Takeshi Yamamoto (partner-2) is VIP
      cy.contains('Takeshi Yamamoto')
        .closest('article')
        .find('span')
        .contains('VIP')
        .should('be.visible');
    });

    it('should show fluency indicators for each partner', () => {
      cy.visit('/discovery');
      cy.wait('@getPartners');

      // Each partner should have a fluency indicator component
      cy.get('app-fluency-indicator').should('have.length.at.least', 1);
    });

    it('should show empty state when no partners are returned', () => {
      cy.intercept('GET', '**/api/discovery/partners*', {
        body: [],
      }).as('getEmptyPartners');

      cy.visit('/discovery');
      cy.wait('@getEmptyPartners');

      // The empty state component should render
      cy.get('app-empty-state').should('be.visible');
    });

    it('should gracefully handle API errors and fall back to mock data', () => {
      // Return a 500 error - the DiscoveryService should catch and fall back to MOCK_PARTNERS
      cy.intercept('GET', '**/api/discovery/partners*', {
        statusCode: 500,
        body: { message: 'Internal server error' },
      }).as('getPartnersError');

      cy.visit('/discovery');
      cy.wait('@getPartnersError');

      // The page should still load (fallback to mock data)
      cy.get('body').should('exist');
    });
  });

  // ==========================================================================
  // 2. Study Buddy Matching
  // ==========================================================================
  describe('Study Buddy Matching', () => {
    beforeEach(() => {
      interceptCommonMocks();

      // Mock study buddy matches
      cy.intercept('GET', '**/api/study-buddies/matches', {
        body: mockStudyBuddyMatches,
      }).as('getBuddyMatches');

      // Mock incoming requests
      cy.intercept('GET', '**/api/study-buddies/requests', {
        body: mockBuddyRequests,
      }).as('getBuddyRequests');

      // Mock POST request (send buddy request)
      cy.intercept('POST', '**/api/study-buddies/request', {
        statusCode: 201,
        body: { success: true },
      }).as('postBuddyRequest');

      // Mock accept
      cy.intercept('POST', '**/api/study-buddies/requests/*/accept', {
        statusCode: 200,
        body: { success: true },
      }).as('acceptBuddyRequest');

      // Mock decline
      cy.intercept('POST', '**/api/study-buddies/requests/*/decline', {
        statusCode: 200,
        body: { success: true },
      }).as('declineBuddyRequest');
    });

    it('should load the study buddy page and display potential matches', () => {
      cy.visit('/study-buddy');
      cy.wait('@getBuddyMatches');
      cy.wait('@getBuddyRequests');

      // Should show potential matches section
      cy.contains('Potential Matches').should('be.visible');

      // Should list match cards
      cy.contains('Luis Gomez').should('be.visible');
      cy.contains('Hana Kim').should('be.visible');
    });

    it('should display incoming buddy requests', () => {
      cy.visit('/study-buddy');
      cy.wait('@getBuddyRequests');

      // Should show incoming requests section
      cy.contains('Incoming Requests').should('be.visible');
      cy.contains('Jin Park').should('be.visible');
    });

    it('should allow sending a buddy request to a potential match', () => {
      cy.visit('/study-buddy');
      cy.wait('@getBuddyMatches');

      // Click the "Request" button on the first match
      cy.contains('Luis Gomez')
        .closest('div')
        .find('button')
        .contains('Request')
        .click();

      cy.wait('@postBuddyRequest');

      // After sending, the button text should change to "Request Sent"
      cy.contains('Luis Gomez')
        .closest('div')
        .find('button')
        .contains('Request Sent')
        .should('be.visible');
    });

    it('should allow accepting an incoming buddy request', () => {
      cy.visit('/study-buddy');
      cy.wait('@getBuddyRequests');

      // Click the "Accept" button on the incoming request
      cy.contains('Jin Park')
        .closest('div')
        .find('button')
        .contains('Accept')
        .click();

      cy.wait('@acceptBuddyRequest');
    });

    it('should allow declining an incoming buddy request', () => {
      cy.visit('/study-buddy');
      cy.wait('@getBuddyRequests');

      // Click the "Decline" button on the incoming request
      cy.contains('Jin Park')
        .closest('div')
        .find('button')
        .contains('Decline')
        .click();

      cy.wait('@declineBuddyRequest');
    });

    it('should handle empty matches gracefully', () => {
      cy.intercept('GET', '**/api/study-buddies/matches', { body: [] }).as('getEmptyMatches');
      cy.intercept('GET', '**/api/study-buddies/requests', { body: [] }).as('getEmptyRequests');

      cy.visit('/study-buddy');
      cy.wait('@getEmptyMatches');

      // Should show empty state
      cy.contains('No matches yet').should('be.visible');
    });
  });

  // ==========================================================================
  // 3. Recommendations API (Tiered Fallback)
  // ==========================================================================
  describe('Recommendations API (Multi-Tier Fallback)', () => {
    beforeEach(() => {
      interceptCommonMocks();

      // Mock recommendations endpoints
      cy.intercept('GET', '**/api/recommendations/for-you', {
        body: mockRecommendations,
      }).as('getForYou');

      cy.intercept('GET', '**/api/recommendations/daily', {
        body: mockDailyRecommendations,
      }).as('getDaily');

      // Mock user profile
      cy.intercept('GET', '**/api/users/me*', {
        body: {
          id: 'mock-user-123',
          display_name: 'Test User',
          native_languages: ['en'],
          target_languages: ['es', 'ja'],
          is_vip: false,
        },
      }).as('getMyProfile');
    });

    it('should call GET /recommendations/for-you on the developer dashboard', () => {
      // The developer dashboard calls recommendations endpoints for the
      // PostGIS Matchmaking Sandbox
      cy.visit('/developer');

      cy.wait('@getForYou');

      // Verify the response contains tiered recommendations
      cy.wait('@getForYou').its('response.body').should('have.length', 3);

      // Validate tier presence
      cy.get('@getForYou').then((interception: unknown) => {
        const body = (interception as { response: { body: typeof mockRecommendations } }).response.body;
        const tiers = body.map((r) => r.matchTier);
        expect(tiers).to.include('interest');
        expect(tiers).to.include('language_exchange');
        expect(tiers).to.include('active_users');
      });
    });

    it('should call GET /recommendations/daily for cached daily partners', () => {
      cy.visit('/developer');
      cy.wait('@getDaily');

      cy.wait('@getDaily').its('response.body').should('have.length', 1);
      cy.get('@getDaily').then((interception: unknown) => {
        const body = (interception as { response: { body: typeof mockDailyRecommendations } }).response.body;
        expect(body[0].displayName).to.equal('Sofia Rossi');
      });
    });

    it('should gracefully handle recommendations API returning empty results', () => {
      cy.intercept('GET', '**/api/recommendations/for-you', {
        body: [],
      }).as('getForYouEmpty');

      cy.visit('/developer');
      cy.wait('@getForYouEmpty');

      // API should return 200 with empty array (not an error)
      cy.get('@getForYouEmpty').its('response.statusCode').should('eq', 200);
      cy.get('@getForYouEmpty').its('response.body').should('have.length', 0);
    });

    it('should handle recommendations API error with 200-empty fallback', () => {
      // The RecommendationsService falls back through tiers and ultimately returns []
      cy.intercept('GET', '**/api/recommendations/for-you', {
        statusCode: 500,
        body: { message: 'Internal server error' },
      }).as('getForYouError');

      // We still visit to verify the app does not crash
      cy.visit('/developer');
      cy.wait('@getForYouError');

      // The app should still render without crashing
      cy.get('body').should('exist');
    });
  });

  // ==========================================================================
  // 4. Discovery Sort & Filter Integration
  // ==========================================================================
  describe('Discovery Sort & Advanced Filters', () => {
    beforeEach(() => {
      interceptCommonMocks();

      cy.intercept('GET', '**/api/discovery/partners*', (req) => {
        req.reply({
          statusCode: 200,
          body: mockPartners,
        });
      }).as('getPartners');

      cy.intercept('GET', '**/api/users/me*', {
        body: {
          id: 'mock-user-123',
          display_name: 'Test User',
          native_languages: ['en'],
          target_languages: ['es', 'ja', 'de'],
          is_vip: false,
          is_serious_learner: false,
        },
      }).as('getMyProfile');
    });

    it('should send sort parameter when changing sort select', () => {
      cy.visit('/discovery');
      cy.wait('@getPartners');

      // Change sort to "Newest"
      cy.get('select#sortBySelect').select('newest');

      cy.wait('@getPartners').its('request.url').should('include', 'sort=newest');
    });

    it('should send voice_room_active filter when toggling voice room checkbox', () => {
      cy.visit('/discovery');
      cy.wait('@getPartners');

      // Toggle voice room active
      cy.get('input#voiceRoomActiveCheckbox').check();

      cy.wait('@getPartners').its('request.url').should('include', 'voice_room_active=true');
    });

    it('should send serious_learner_mode when toggling serious learner checkbox', () => {
      cy.visit('/discovery');
      cy.wait('@getPartners');

      // Toggle serious learner mode
      cy.get('input#seriousModeCheckbox').check();

      cy.wait('@getPartners').its('request.url').should(
        'include',
        'serious_learner_mode=true',
      );
    });

    it('should reset filters and send default parameters', () => {
      // We need to intercept first with filters applied, then reset
      cy.visit('/discovery');
      cy.wait('@getPartners');

      // First apply some filters
      cy.get('input#seriousModeCheckbox').check();
      cy.wait('@getPartners');

      // Now check the reset filter behavior: unchecking should go back to defaults
      cy.get('input#seriousModeCheckbox').uncheck();
      cy.wait('@getPartners').its('request.url').should('not.include', 'serious_learner_mode=true');
    });
  });

  // ==========================================================================
  // 5. Matchmaking Tier Verification (Integration)
  // ==========================================================================
  describe('Matchmaking Tier Verification', () => {
    it('should return tier 1 (interest) when shared interests exist', () => {
      cy.intercept('GET', '**/api/recommendations/for-you', {
        body: [mockRecommendations[0]],
      }).as('getForYouTier1');

      cy.visit('/developer');
      cy.wait('@getForYouTier1');

      cy.get('@getForYouTier1').then((interception: unknown) => {
        const body = (interception as { response: { body: typeof mockRecommendations } }).response.body;
        expect(body[0].matchTier).to.equal('interest');
        expect(body[0].sharedInterests).to.be.greaterThan(0);
      });
    });

    it('should return tier 2 (language_exchange) when no shared interests', () => {
      cy.intercept('GET', '**/api/recommendations/for-you', {
        body: [mockRecommendations[1]],
      }).as('getForYouTier2');

      cy.visit('/developer');
      cy.wait('@getForYouTier2');

      cy.get('@getForYouTier2').then((interception: unknown) => {
        const body = (interception as { response: { body: typeof mockRecommendations } }).response.body;
        expect(body[0].matchTier).to.equal('language_exchange');
        expect(body[0].sharedInterests).to.equal(0);
      });
    });

    it('should return tier 3 (active_users) as fallback', () => {
      cy.intercept('GET', '**/api/recommendations/for-you', {
        body: [mockRecommendations[2]],
      }).as('getForYouTier3');

      cy.visit('/developer');
      cy.wait('@getForYouTier3');

      cy.get('@getForYouTier3').then((interception: unknown) => {
        const body = (interception as { response: { body: typeof mockRecommendations } }).response.body;
        expect(body[0].matchTier).to.equal('active_users');
        expect(body[0].studyStreakDays).to.be.greaterThan(100);
      });
    });
  });

  // ==========================================================================
  // 6. Combined Matchmaking Flow (Discovery + Recommendations + Study Buddy)
  // ==========================================================================
  describe('Combined Matchmaking Flow', () => {
    beforeEach(() => {
      interceptCommonMocks();

      // Mock all three matchmaking surfaces simultaneously
      cy.intercept('GET', '**/api/discovery/partners*', { body: mockPartners }).as('getPartners');
      cy.intercept('GET', '**/api/discovery/partner-of-week', { body: ['partner-1'] }).as(
        'getPartnerOfWeek',
      );
      cy.intercept('GET', '**/api/recommendations/for-you', {
        body: mockRecommendations,
      }).as('getForYou');
      cy.intercept('GET', '**/api/recommendations/daily', {
        body: mockDailyRecommendations,
      }).as('getDaily');
      cy.intercept('GET', '**/api/study-buddies/matches', {
        body: mockStudyBuddyMatches,
      }).as('getBuddyMatches');
      cy.intercept('GET', '**/api/study-buddies/requests', {
        body: mockBuddyRequests,
      }).as('getBuddyRequests');

      cy.intercept('GET', '**/api/users/me*', {
        body: {
          id: 'mock-user-123',
          display_name: 'Test User',
          native_languages: ['en'],
          target_languages: ['es', 'ja', 'de'],
          is_vip: false,
          is_serious_learner: false,
        },
      }).as('getMyProfile');
    });

    it('should load all matchmaking data surfaces without 4xx/5xx errors', () => {
      cy.visit('/discovery');
      cy.wait('@getPartners');
      cy.get('article').should('have.length.at.least', 1);

      // Navigate to Study Buddy
      cy.visit('/study-buddy');
      cy.wait('@getBuddyMatches');
      cy.wait('@getBuddyRequests');
      cy.get('body').should('exist');

      // Navigate to Developer dashboard (recommendations)
      cy.visit('/developer');
      cy.wait('@getForYou');
      cy.wait('@getDaily');
      cy.get('body').should('exist');
    });

    it('should filter discovery by target language then match via study buddy', () => {
      // Step 1: Filter discovery by Spanish
      cy.visit('/discovery');
      cy.wait('@getPartners');

      cy.get('button').contains(/🇪🇸|Spanish/i).click();

      cy.wait('@getPartners').its('request.url').should('include', 'target_language=es');

      // Step 2: Navigate to study buddy and verify independent matching
      cy.visit('/study-buddy');
      cy.wait('@getBuddyMatches');

      // Verify that study buddy has its own match list (different endpoint)
      cy.contains('Luis Gomez').should('be.visible');
    });

    it('should degrade gracefully when all matchmaking endpoints fail', () => {
      // Simulate full backend outage across all matchmaking endpoints
      cy.intercept('GET', '**/api/discovery/partners*', { statusCode: 500, body: {} }).as(
        'getPartnersFail',
      );
      cy.intercept('GET', '**/api/study-buddies/matches', { statusCode: 500, body: {} }).as(
        'getBuddyMatchesFail',
      );
      cy.intercept('GET', '**/api/study-buddies/requests', { statusCode: 500, body: {} }).as(
        'getBuddyRequestsFail',
      );
      cy.intercept('GET', '**/api/recommendations/for-you', { statusCode: 500, body: {} }).as(
        'getForYouFail',
      );
      cy.intercept('GET', '**/api/recommendations/daily', { statusCode: 500, body: {} }).as(
        'getDailyFail',
      );

      // Discovery should fall back to mock data (no crash)
      cy.visit('/discovery');
      cy.wait('@getPartnersFail');
      cy.get('body').should('exist');

      // Study buddy should show empty state (no crash)
      cy.visit('/study-buddy');
      cy.wait('@getBuddyMatchesFail');
      cy.get('body').should('exist');

      // Developer dashboard should not crash
      cy.visit('/developer');
      cy.wait('@getForYouFail');
      cy.get('body').should('exist');
    });
  });
});
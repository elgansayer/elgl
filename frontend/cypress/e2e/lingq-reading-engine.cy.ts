/// <reference types="cypress" />

/**
 * LingQ Reading Engine E2E Test Flows
 *
 * Covers: article listing with filters (difficulty, topic),
 * article detail view, tab navigation (Articles / Vocabulary / History),
 * empty states for vocabulary and history tabs,
 * reading progress display, and tokenisation endpoint.
 */

// ─────────────────────────────────────────
// Reading Engine - Article Listing & Filters
// ─────────────────────────────────────────

describe('LingQ Reading Engine - Article Listing & Filters', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/reading/resources?*', {
      body: [
        {
          id: 'art-1',
          title: 'A Day in the Life of a Language Learner',
          content: 'Every morning I wake up and start my day with a cup of coffee.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'daily-life',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'art-2',
          title: 'The Benefits of Bilingualism',
          content: 'Research has shown that speaking multiple languages can have profound effects.',
          language: 'en-GB',
          difficulty: 'intermediate',
          topic: 'science',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'art-3',
          title: 'Exploring Cultural Nuances Through Language',
          content: 'Language is inextricably woven into the fabric of culture.',
          language: 'en-GB',
          difficulty: 'advanced',
          topic: 'culture',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'art-4',
          title: 'How to Order Food Like a Local',
          content: 'When travelling abroad, ordering food can be intimidating yet rewarding.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'travel',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'art-5',
          title: 'The Future of Machine Translation',
          content: 'Neural machine translation has made remarkable strides.',
          language: 'en-GB',
          difficulty: 'advanced',
          topic: 'technology',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }).as('listResources');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should load the reading engine page at /read', () => {
    cy.visit('/read');
    cy.get('body').should('exist');
    cy.get('app-reading-engine').should('exist');
  });

  it('should display the page title and subtitle', () => {
    cy.visit('/read');
    cy.contains('readingEngine.title').should('be.visible');
    cy.contains('readingEngine.subtitle').should('be.visible');
  });

  it('should display vocabulary count chip in the header', () => {
    cy.visit('/read');
    cy.get('.app-chip').should('be.visible');
  });

  it('should render three tab navigation buttons', () => {
    cy.visit('/read');
    cy.get('[role="tab"]').should('have.length', 3);
    cy.contains('[role="tab"]', 'readingEngine.tab.articles').should('be.visible');
    cy.contains('[role="tab"]', 'readingEngine.tab.vocabulary').should('be.visible');
    cy.contains('[role="tab"]', 'readingEngine.tab.history').should('be.visible');
  });

  it('should default to the Articles tab', () => {
    cy.visit('/read');
    cy.get('[role="tab"]').first().should('have.attr', 'aria-selected', 'true');
  });

  it('should display difficulty filter controls in articles tab', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('readingEngine.filterDifficulty').should('be.visible');
    cy.contains('readingEngine.filterAll').should('be.visible');
    cy.contains('readingEngine.difficulty.beginner').should('be.visible');
    cy.contains('readingEngine.difficulty.intermediate').should('be.visible');
    cy.contains('readingEngine.difficulty.advanced').should('be.visible');
  });

  it('should display topic filter controls in articles tab', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('readingEngine.filterTopic').should('be.visible');
  });

  it('should list articles after loading', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.get('[role="list"]').should('exist');
    cy.get('[role="listitem"]').should('have.length', 5);
  });

  it('should display article titles in the list', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('A Day in the Life of a Language Learner').should('be.visible');
    cy.contains('The Benefits of Bilingualism').should('be.visible');
    cy.contains('Exploring Cultural Nuances Through Language').should('be.visible');
    cy.contains('How to Order Food Like a Local').should('be.visible');
    cy.contains('The Future of Machine Translation').should('be.visible');
  });

  it('should display difficulty badges on articles', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.get('[role="listitem"]').first().within(() => {
      cy.contains('readingEngine.difficulty.beginner').should('be.visible');
    });
  });

  it('should display topic badges on articles', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.get('[role="listitem"]').first().within(() => {
      cy.contains('readingEngine.topic.daily-life').should('be.visible');
    });
  });

  it('should display word count on articles', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.get('[role="listitem"]').first().within(() => {
      cy.contains('readingEngine.wordCountShort').should('be.visible');
    });
  });
});

// ─────────────────────────────────────────
// Reading Engine - Article Detail & Navigation
// ─────────────────────────────────────────

describe('LingQ Reading Engine - Article Detail View', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/reading/resources?*', {
      body: [
        {
          id: 'art-1',
          title: 'A Day in the Life of a Language Learner',
          content: 'Every morning I wake up and start my day with a cup of coffee. I open my favourite language learning app and review my flashcards for ten minutes.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'daily-life',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }).as('listResources');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should navigate to article detail when clicking an article', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('A Day in the Life of a Language Learner').click();
    cy.contains('readingEngine.backToList').should('be.visible');
  });

  it('should display article title in the detail view', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('A Day in the Life of a Language Learner').click();
    cy.get('h2').contains('A Day in the Life of a Language Learner').should('be.visible');
  });

  it('should display article content in the detail view', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('A Day in the Life of a Language Learner').click();
    cy.contains('Every morning I wake up').should('be.visible');
  });

  it('should display difficulty and topic badges in detail view', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('A Day in the Life of a Language Learner').click();
    cy.contains('readingEngine.difficulty.beginner').should('be.visible');
    cy.contains('readingEngine.topic.daily-life').should('be.visible');
  });

  it('should have action buttons in detail view (save and next article)', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('A Day in the Life of a Language Learner').click();
    cy.contains('readingEngine.saveArticle').should('be.visible');
    cy.contains('readingEngine.nextArticle').should('be.visible');
  });

  it('should navigate back to article list via back button', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('A Day in the Life of a Language Learner').click();
    cy.contains('readingEngine.backToList').click();
    cy.get('[role="list"]').should('exist');
    cy.get('[role="listitem"]').should('have.length', 1);
  });
});

// ─────────────────────────────────────────
// Reading Engine - Tab Navigation
// ─────────────────────────────────────────

describe('LingQ Reading Engine - Tab Navigation', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/reading/resources?*', {
      body: [
        {
          id: 'art-1',
          title: 'A Day in the Life of a Language Learner',
          content: 'Every morning I wake up and start my day with a cup of coffee.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'daily-life',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }).as('listResources');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should switch to Vocabulary tab and display its content', () => {
    cy.visit('/read');
    cy.contains('[role="tab"]', 'readingEngine.tab.vocabulary').click();
    cy.contains('readingEngine.vocabularyTabTitle').should('be.visible');
    cy.contains('readingEngine.vocabularyTabDescription').should('be.visible');
  });

  it('should show empty state when vocabulary count is zero', () => {
    cy.visit('/read');
    cy.contains('[role="tab"]', 'readingEngine.tab.vocabulary').click();
    cy.contains('readingEngine.noVocabularyTitle').should('be.visible');
    cy.contains('readingEngine.noVocabularyDescription').should('be.visible');
    cy.contains('readingEngine.browseArticlesAction').should('be.visible');
  });

  it('should switch to History tab and display its content', () => {
    cy.visit('/read');
    cy.contains('[role="tab"]', 'readingEngine.tab.history').click();
    cy.contains('readingEngine.historyTabTitle').should('be.visible');
    cy.contains('readingEngine.historyTabDescription').should('be.visible');
  });

  it('should show empty state for history tab', () => {
    cy.visit('/read');
    cy.contains('[role="tab"]', 'readingEngine.tab.history').click();
    cy.contains('readingEngine.noHistoryTitle').should('be.visible');
    cy.contains('readingEngine.noHistoryDescription').should('be.visible');
  });

  it('should navigate from vocabulary empty state to articles tab', () => {
    cy.visit('/read');
    cy.contains('[role="tab"]', 'readingEngine.tab.vocabulary').click();
    cy.contains('readingEngine.browseArticlesAction').click();
    cy.get('[role="tab"]').first().should('have.attr', 'aria-selected', 'true');
  });

  it('should navigate from history empty state to articles tab', () => {
    cy.visit('/read');
    cy.contains('[role="tab"]', 'readingEngine.tab.history').click();
    cy.contains('readingEngine.browseArticlesAction').click();
    cy.get('[role="tab"]').first().should('have.attr', 'aria-selected', 'true');
  });

  it('should allow switching back to Articles tab after visiting others', () => {
    cy.visit('/read');
    cy.contains('[role="tab"]', 'readingEngine.tab.vocabulary').click();
    cy.contains('[role="tab"]', 'readingEngine.tab.articles').click();
    cy.wait('@listResources');
    cy.get('[role="list"]').should('exist');
  });
});

// ─────────────────────────────────────────
// Reading Engine - Reading Progress API
// ─────────────────────────────────────────

describe('LingQ Reading Engine - Reading Progress API', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/reading/resources?*', {
      body: [
        {
          id: 'art-1',
          title: 'Test Article',
          content: 'Test content.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'daily-life',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }).as('listResources');

    cy.intercept('GET', '**/api/reading/progress', {
      body: {
        userId: 'mock-user-123',
        wordsRead: 350,
        articlesCompleted: 7,
        totalReadingTimeSeconds: 1800,
        fluencyPercentage: 42,
        lastReadAt: new Date().toISOString(),
      },
    }).as('getProgress');

    cy.intercept('POST', '**/api/reading/progress/session', (req) => {
      req.reply({
        statusCode: 201,
        body: {
          userId: 'mock-user-123',
          wordsRead: 350 + (req.body.wordsRead ?? 0),
          articlesCompleted: 8,
          totalReadingTimeSeconds: 1800 + (req.body.durationSeconds ?? 0),
          fluencyPercentage: 45,
          lastReadAt: new Date().toISOString(),
        },
      });
    }).as('recordSession');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should fetch reading progress via GET /api/reading/progress', () => {
    cy.visit('/read');
    cy.wait('@listResources');

    cy.request({
      method: 'GET',
      url: '/api/reading/progress',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.wordsRead).to.eq(350);
      expect(response.body.articlesCompleted).to.eq(7);
      expect(response.body.totalReadingTimeSeconds).to.eq(1800);
      expect(response.body.fluencyPercentage).to.eq(42);
    });
  });

  it('should record a reading session via POST /api/reading/progress/session', () => {
    cy.visit('/read');
    cy.wait('@listResources');

    cy.request({
      method: 'POST',
      url: '/api/reading/progress/session',
      body: { resourceId: 'art-1', wordsRead: 73, durationSeconds: 120 },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.wordsRead).to.be.greaterThan(350);
      expect(response.body.articlesCompleted).to.eq(8);
    });
  });

  it('should handle reading progress API error gracefully', () => {
    cy.intercept('GET', '**/api/reading/progress', {
      statusCode: 500,
      body: { error: 'Internal server error' },
    }).as('progressError');

    cy.visit('/read');

    cy.request({
      method: 'GET',
      url: '/api/reading/progress',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(500);
    });
  });
});

// ─────────────────────────────────────────
// Reading Engine - Tokenisation API
// ─────────────────────────────────────────

describe('LingQ Reading Engine - Tokenisation API', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/reading/resources/art-1', {
      body: {
        id: 'art-1',
        title: 'Test Article',
        content: 'Hello world, this is a test.',
        language: 'en-GB',
        difficulty: 'beginner',
        topic: 'daily-life',
        sourceUrl: null,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }).as('getResource');

    cy.intercept('GET', '**/api/reading/resources/art-1/tokenise*', {
      body: {
        resourceId: 'art-1',
        language: 'en-GB',
        totalTokens: 7,
        uniqueTokens: 7,
        tokens: [
          { index: 0, token: 'Hello', position: 0, isWordLike: true },
          { index: 1, token: 'world', position: 6, isWordLike: true },
          { index: 2, token: 'this', position: 13, isWordLike: true },
          { index: 3, token: 'is', position: 18, isWordLike: true },
          { index: 4, token: 'a', position: 21, isWordLike: true },
          { index: 5, token: 'test', position: 23, isWordLike: true },
        ],
      },
    }).as('tokeniseResource');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should fetch a single resource and return correct data', () => {
    cy.visit('/read');

    cy.request({
      method: 'GET',
      url: '/api/reading/resources/art-1',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.id).to.eq('art-1');
      expect(response.body.title).to.eq('Test Article');
      expect(response.body.content).to.eq('Hello world, this is a test.');
      expect(response.body.language).to.eq('en-GB');
      expect(response.body.difficulty).to.eq('beginner');
    });
  });

  it('should tokenise a resource using Intl.Segmenter and return tokens', () => {
    cy.visit('/read');

    cy.request({
      method: 'GET',
      url: '/api/reading/resources/art-1/tokenise',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.resourceId).to.eq('art-1');
      expect(response.body.language).to.eq('en-GB');
      expect(response.body.totalTokens).to.eq(7);
      expect(response.body.uniqueTokens).to.eq(7);
      expect(response.body.tokens).to.be.an('array');
      expect(response.body.tokens[0]).to.have.property('token');
      expect(response.body.tokens[0]).to.have.property('position');
      expect(response.body.tokens[0]).to.have.property('isWordLike', true);
    });
  });

  it('should tokenise a resource with language override param', () => {
    cy.intercept('GET', '**/api/reading/resources/art-1/tokenise?lang=fr', {
      body: {
        resourceId: 'art-1',
        language: 'fr',
        totalTokens: 7,
        uniqueTokens: 7,
        tokens: [
          { index: 0, token: 'Bonjour', position: 0, isWordLike: true },
          { index: 1, token: 'monde', position: 8, isWordLike: true },
        ],
      },
    }).as('tokeniseFrench');

    cy.visit('/read');

    cy.request({
      method: 'GET',
      url: '/api/reading/resources/art-1/tokenise?lang=fr',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.language).to.eq('fr');
      expect(response.body.tokens).to.have.length(2);
    });
  });
});

// ─────────────────────────────────────────
// Reading Engine - Resource CRUD API
// ─────────────────────────────────────────

describe('LingQ Reading Engine - Resource CRUD API', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/reading/resources', (req) => {
      req.reply({
        statusCode: 201,
        body: {
          id: 'new-res-123',
          title: req.body.title,
          content: req.body.content,
          language: req.body.language,
          difficulty: req.body.difficulty,
          topic: req.body.topic,
          sourceUrl: null,
          createdBy: 'mock-user-123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }).as('createResource');

    cy.intercept('PUT', '**/api/reading/resources/art-1', (req) => {
      req.reply({
        body: {
          id: 'art-1',
          title: req.body.title,
          content: req.body.content,
          language: req.body.language,
          difficulty: req.body.difficulty,
          topic: req.body.topic,
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }).as('updateResource');

    cy.intercept('DELETE', '**/api/reading/resources/art-1', {
      statusCode: 204,
    }).as('deleteResource');

    cy.intercept('DELETE', '**/api/reading/cache/user', {
      statusCode: 204,
    }).as('clearCache');

    cy.intercept('GET', '**/api/reading/resources?*', { body: [] }).as('listResources');
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should create a reading resource via POST /api/reading/resources', () => {
    cy.visit('/read');

    cy.request({
      method: 'POST',
      url: '/api/reading/resources',
      body: {
        title: 'New Article',
        content: 'This is a new article for testing.',
        language: 'en-GB',
        difficulty: 'intermediate',
        topic: 'technology',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.id).to.eq('new-res-123');
      expect(response.body.title).to.eq('New Article');
      expect(response.body.difficulty).to.eq('intermediate');
      expect(response.body.topic).to.eq('technology');
    });
  });

  it('should update a reading resource via PUT /api/reading/resources/:id', () => {
    cy.visit('/read');

    cy.request({
      method: 'PUT',
      url: '/api/reading/resources/art-1',
      body: {
        title: 'Updated Article Title',
        content: 'Updated content.',
        language: 'en-GB',
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.title).to.eq('Updated Article Title');
      expect(response.body.content).to.eq('Updated content.');
    });
  });

  it('should delete a reading resource via DELETE /api/reading/resources/:id', () => {
    cy.visit('/read');

    cy.request({
      method: 'DELETE',
      url: '/api/reading/resources/art-1',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(204);
    });
  });

  it('should clear user reading cache via DELETE /api/reading/cache/user', () => {
    cy.visit('/read');

    cy.request({
      method: 'DELETE',
      url: '/api/reading/cache/user',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(204);
    });
  });

  it('should handle 404 when resource not found', () => {
    cy.intercept('GET', '**/api/reading/resources/nonexistent', {
      statusCode: 404,
      body: { error: 'Resource not found' },
    }).as('notFound');

    cy.visit('/read');

    cy.request({
      method: 'GET',
      url: '/api/reading/resources/nonexistent',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
  });
});

// ─────────────────────────────────────────
// Reading Engine - Edge Cases & Empty States
// ─────────────────────────────────────────

describe('LingQ Reading Engine - Edge Cases', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should display empty state when no articles are available', () => {
    cy.intercept('GET', '**/api/reading/resources?*', { body: [] }).as('emptyResources');

    cy.visit('/read');
    cy.wait('@emptyResources');
    cy.contains('readingEngine.noArticlesTitle').should('be.visible');
    cy.contains('readingEngine.noArticlesDescription').should('be.visible');
  });

  it('should display "clear filters" action in empty state for filtered-to-zero', () => {
    cy.intercept('GET', '**/api/reading/resources?*', { body: [] }).as('emptyResources');

    cy.visit('/read');
    cy.wait('@emptyResources');
    cy.contains('readingEngine.clearFilters').should('be.visible');
  });

  it('should show loading skeletons while articles are loading', () => {
    // Use a delayed response to force the skeleton state to render briefly
    cy.intercept('GET', '**/api/reading/resources?*', (req) => {
      req.on('response', (res) => {
        res.setDelay(2000);
      });
      req.reply({ body: [] });
    }).as('slowResources');

    cy.visit('/read');
    // The component uses an 800ms setTimeout to simulate loading, so skeleton should appear
    cy.get('app-skeleton-loader').should('exist');
  });

  it('should handle a large number of articles gracefully', () => {
    const manyArticles = Array.from({ length: 50 }, (_, i) => ({
      id: `art-${i}`,
      title: `Article ${i}`,
      content: `Content for article ${i}.`,
      language: 'en-GB',
      difficulty: i % 2 === 0 ? 'beginner' : 'intermediate',
      topic: 'daily-life',
      sourceUrl: null,
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    cy.intercept('GET', '**/api/reading/resources?*', { body: manyArticles }).as('manyResources');

    cy.visit('/read');
    cy.wait('@manyResources');

    cy.get('[role="listitem"]').should('have.length', 50);
  });

  it('should have the correct route path /read for the reading engine', () => {
    cy.visit('/read');
    cy.url().should('include', '/read');
  });
});

// ─────────────────────────────────────────
// Reading Engine - Accessibility
// ─────────────────────────────────────────

describe('LingQ Reading Engine - Accessibility', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/reading/resources?*', {
      body: [
        {
          id: 'art-1',
          title: 'Test Article',
          content: 'Test content.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'daily-life',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }).as('listResources');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should have proper ARIA roles for tab navigation', () => {
    cy.visit('/read');
    cy.get('[role="tablist"]').should('exist');
    cy.get('[role="tab"]').should('have.length', 3);
  });

  it('should mark the active tab with aria-selected', () => {
    cy.visit('/read');
    cy.contains('[role="tab"]', 'readingEngine.tab.articles').should(
      'have.attr',
      'aria-selected',
      'true',
    );
  });

  it('should have proper ARIA role for the article list', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.get('[role="list"]').should('exist');
    cy.get('[role="listitem"]').should('exist');
  });

  it('should have aria-labels on article list items', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.get('[role="listitem"]').first().should('have.attr', 'aria-label');
  });

  it('should have aria-label on filter controls group', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.get('[role="group"]').should('exist');
    cy.get('[role="group"]').should('have.attr', 'aria-label');
  });

  it('should have aria-label on the tablist navigation', () => {
    cy.visit('/read');
    cy.get('[role="tablist"]').should('have.attr', 'aria-label');
  });
});

// ─────────────────────────────────────────
// Reading Engine - Filter Interaction Tests
// ─────────────────────────────────────────

describe('LingQ Reading Engine - Combined Filter Interactions', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/reading/resources?*', {
      body: [
        {
          id: 'art-1',
          title: 'Beginner Daily Life Article',
          content: 'Content for beginner daily life.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'daily-life',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'art-2',
          title: 'Beginner Travel Article',
          content: 'Content for beginner travel.',
          language: 'en-GB',
          difficulty: 'beginner',
          topic: 'travel',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'art-3',
          title: 'Intermediate Science Article',
          content: 'Content for intermediate science.',
          language: 'en-GB',
          difficulty: 'intermediate',
          topic: 'science',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'art-4',
          title: 'Advanced Culture Article',
          content: 'Content for advanced culture.',
          language: 'en-GB',
          difficulty: 'advanced',
          topic: 'culture',
          sourceUrl: null,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }).as('listResources');

    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');
  });

  it('should filter by difficulty only', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('button', 'readingEngine.difficulty.beginner').click();
    cy.get('[role="listitem"]').should('have.length', 2);
    cy.contains('Beginner Daily Life Article').should('be.visible');
    cy.contains('Beginner Travel Article').should('be.visible');
  });

  it('should filter by topic only', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('button', 'readingEngine.topic.science').click();
    cy.get('[role="listitem"]').should('have.length', 1);
    cy.contains('Intermediate Science Article').should('be.visible');
  });

  it('should apply combined difficulty and topic filters', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('button', 'readingEngine.difficulty.beginner').click();
    cy.contains('button', 'readingEngine.topic.travel').click();
    cy.get('[role="listitem"]').should('have.length', 1);
    cy.contains('Beginner Travel Article').should('be.visible');
  });

  it('should show "clear filters" link when any filter is active', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('button', 'readingEngine.difficulty.beginner').click();
    cy.contains('readingEngine.clearFilters').should('be.visible');
  });

  it('should reset all filters when clear is clicked', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('button', 'readingEngine.difficulty.beginner').click();
    cy.contains('button', 'readingEngine.topic.travel').click();
    cy.contains('readingEngine.clearFilters').click();
    cy.get('[role="listitem"]').should('have.length', 4);
  });

  it('should show the "All" filter button as active when no specific filter is selected', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('button', 'readingEngine.difficulty.advanced').click();
    cy.contains('button', 'readingEngine.filterAll').click();
    cy.get('[role="listitem"]').should('have.length', 4);
  });

  it('should show empty state when combined filters match nothing', () => {
    cy.visit('/read');
    cy.wait('@listResources');
    cy.contains('button', 'readingEngine.difficulty.advanced').click();
    cy.contains('button', 'readingEngine.topic.science').click();
    cy.contains('readingEngine.noArticlesTitle').should('be.visible');
  });
});
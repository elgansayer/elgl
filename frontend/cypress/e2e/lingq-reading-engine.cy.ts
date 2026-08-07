/**
 * LingQ Reading Engine -- End-to-End Test Flows
 *
 * Covers the interactive reading and vocabulary acquisition system:
 *   1. Vocabulary Dashboard (flashcard flip, grading, completion)
 *   2. Flashcard Deck management (list, create, add cards)
 *   3. SRS Flashcard Review (progress bar, grading, completion)
 *   4. Chat Room -- Tokenised Text integration (renders, word-click modal)
 *   5. Audio Sync Reader -- play / pause immersion audio
 */

const MOCK_FLASHCARDS = [
  {
    id: 'fc-1',
    user_id: 'user-1',
    word_token: 'abundant',
    original_context: 'Fish are abundant in the lake.',
    translation: 'abundante',
    definition: 'existing or available in large quantities; plentiful',
    pronunciation_url: null,
    srs_level: 1,
    easiness_factor: 2.5,
    repetitions: 0,
    interval_days: 0,
    next_review_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'fc-2',
    user_id: 'user-1',
    word_token: 'eloquent',
    original_context: 'She gave an eloquent speech.',
    translation: 'elocuente',
    definition: 'fluent or persuasive in speaking or writing',
    pronunciation_url: null,
    srs_level: 3,
    easiness_factor: 2.7,
    repetitions: 3,
    interval_days: 7,
    next_review_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(),
  },
];

const MOCK_DUE_FLASHCARDS = [
  {
    id: 'fc-due-1',
    user_id: 'user-1',
    word_token: 'diligent',
    original_context: 'The diligent student reviewed every lesson.',
    translation: 'diligente',
    definition: "having or showing care and conscientiousness in one's work or duties",
    pronunciation_url: null,
    srs_level: 1,
    easiness_factor: 2.5,
    repetitions: 0,
    interval_days: 0,
    next_review_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'fc-due-2',
    user_id: 'user-1',
    word_token: 'candid',
    original_context: 'His response was surprisingly candid.',
    translation: 'sincero',
    definition: 'truthful and straightforward; frank',
    pronunciation_url: null,
    srs_level: 2,
    easiness_factor: 2.6,
    repetitions: 2,
    interval_days: 3,
    next_review_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date().toISOString(),
  },
];

const MOCK_DECKS = [
  {
    id: 'deck-1',
    user_id: 'user-1',
    name: 'Spanish Basics',
    description: 'Core vocabulary for beginners',
    colour: '#6366f1',
    icon: '📚',
    card_count: 12,
    last_studied_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'deck-2',
    user_id: 'user-1',
    name: 'Travel Phrases',
    description: 'Essential travel expressions',
    colour: '#10b981',
    icon: '✈️',
    card_count: 5,
    last_studied_at: null,
    created_at: new Date().toISOString(),
  },
];

describe('LingQ Reading Engine', () => {
  beforeEach(() => {
    // ---------- Safety / auth foundational mocks ----------
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');

    // ---------- Flashcard API mocks ----------
    cy.intercept('GET', '**/api/flashcards', { body: MOCK_FLASHCARDS }).as('getFlashcards');
    cy.intercept('GET', '**/api/flashcards/due', { body: MOCK_DUE_FLASHCARDS }).as(
      'getDueFlashcards',
    );
    cy.intercept('POST', '**/api/flashcards', (req) => {
      req.reply({
        statusCode: 201,
        body: {
          id: `fc-${Date.now()}`,
          user_id: 'user-1',
          word_token: req.body.word_token,
          original_context: req.body.original_context ?? null,
          translation: req.body.translation,
          definition: req.body.definition ?? null,
          pronunciation_url: req.body.pronunciation_url ?? null,
          srs_level: 1,
          easiness_factor: 2.5,
          repetitions: 0,
          interval_days: 0,
          next_review_at: new Date(Date.now() + 86400000).toISOString(),
          created_at: new Date().toISOString(),
        },
      });
    }).as('saveFlashcard');
    cy.intercept('PATCH', '**/api/flashcards/*/srs', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          id: (req.url ?? '').split('/').slice(-2)[0],
          word_token: 'diligent',
          user_id: 'user-1',
          srs_level: (req.body as { quality: number }).quality >= 4 ? 4 : 1,
          easiness_factor: 2.5,
          repetitions: 1,
          interval_days: 1,
          next_review_at: new Date(Date.now() + 86400000).toISOString(),
          created_at: new Date().toISOString(),
        },
      });
    }).as('updateSrs');

    // ---------- Deck API mocks ----------
    cy.intercept('GET', '**/api/decks', { body: MOCK_DECKS }).as('getDecks');
    cy.intercept('POST', '**/api/decks', (req) => {
      const body = req.body as { name: string; description?: string; colour?: string; icon?: string };
      req.reply({
        statusCode: 201,
        body: {
          id: `deck-${Date.now()}`,
          user_id: 'user-1',
          name: body.name,
          description: body.description ?? '',
          colour: body.colour ?? '#6366f1',
          icon: body.icon ?? '📚',
          card_count: 0,
          last_studied_at: null,
          created_at: new Date().toISOString(),
        },
      });
    }).as('createDeck');
    cy.intercept('POST', '**/api/decks/*/cards', { statusCode: 201, body: { message: 'Card added' } }).as(
      'addCardToDeck',
    );
    cy.intercept('DELETE', '**/api/decks/*', { body: { message: 'Deleted' } }).as('deleteDeck');

    // ---------- Chat / room mocks ----------
    cy.intercept('POST', '**/api/chat/token', {
      body: { token: 'mock-centrifugo-token' },
    }).as('getChatToken');
    cy.intercept('GET', '**/api/chat/rooms/*/members', { body: [] }).as('getRoomMembers');
    cy.intercept('GET', '**/api/chat/groups/*/members', { body: [] }).as('getGroupMembers');
    cy.intercept('GET', '**/api/chat/messages/room-1*', {
      body: [
        {
          id: 'msg-1',
          room_id: 'room-1',
          sender_id: 'partner-1',
          message_type: 'text',
          text_content: 'Hola! ¿Cómo estás? Espero que estés bien.',
          created_at: new Date().toISOString(),
          is_read: true,
        },
      ],
    }).as('getMessages');

    // ---------- NLP mocks ----------
    cy.intercept('POST', '**/api/nlp/translate', {
      body: {
        original_text: 'abundant',
        translated_text: 'abundante',
        detected_language: 'en',
        definition: 'existing or available in large quantities; plentiful',
      },
    }).as('translateWord');
  });

  // ===================================================================
  // 1. Vocabulary Dashboard
  // ===================================================================
  describe('Vocabulary Dashboard (/vocabulary)', () => {
    beforeEach(() => {
      cy.visit('/vocabulary');
      cy.wait('@getFlashcards');
    });

    it('should load the vocabulary dashboard with a flashcard deck', () => {
      // The rendered output of TranslatePipe for vocabulary.title is '📚 Vocabulary studio'
      cy.contains('📚 Vocabulary studio').should('be.visible');
      // Card counter shows "Card 1 of 5"
      cy.contains('Card 1 of 5').should('be.visible');
    });

    it('should flip the flashcard on click', () => {
      // The front face should contain the term 'abundant'
      cy.contains('abundant').should('be.visible');

      // Flip the card
      cy.get('.flashcard').click();
      cy.get('.flashcard.is-flipped').should('exist');
      // The back face should now show the definition
      cy.contains('plentiful').should('be.visible');
    });

    it('should flip the card with keyboard (Enter)', () => {
      // Focus and press Enter
      cy.get('.flashcard').focus().type('{enter}');
      cy.get('.flashcard.is-flipped').should('exist');
    });

    it('should grade cards and progress through the deck', () => {
      // Grade as 'Good'
      cy.contains('Good').click();
      cy.contains('Card 2 of 5').should('be.visible');

      // Grade as 'Known'
      cy.contains('Known').click();
      cy.contains('Card 3 of 5').should('be.visible');

      // Grade as 'Again'
      cy.contains('Again').click();
      cy.contains('Card 4 of 5').should('be.visible');
    });

    it('should reach completion state after all cards are graded', () => {
      for (let i = 0; i < 5; i++) {
        cy.contains('Good').click();
      }
      // Completion message
      cy.contains('No review cards are due right now.').should('be.visible');
      cy.get('.flashcard').should('not.exist');
    });

    it('should restart the deck from the completion screen', () => {
      for (let i = 0; i < 5; i++) {
        cy.contains('Good').click();
      }
      cy.contains('No review cards are due right now.').should('be.visible');

      // Click restart
      cy.contains('Restart review').click();
      // Should be back at card 1
      cy.contains('Card 1 of 5').should('be.visible');
    });
  });

  // ===================================================================
  // 2. Flashcard Deck Management
  // ===================================================================
  describe('Flashcard Deck Management (/decks)', () => {
    beforeEach(() => {
      cy.visit('/decks');
      cy.wait('@getDecks');
    });

    it('should load the deck list with mock decks', () => {
      cy.contains('📚 Flashcard Decks').should('be.visible');
      cy.contains('Spanish Basics').should('be.visible');
      cy.contains('Travel Phrases').should('be.visible');
      cy.contains('2 deck(s)').should('be.visible');
    });

    it('should show the create deck form and cancel it', () => {
      cy.contains('+ New Deck').click();
      // Form should appear
      cy.contains('Create a new deck').should('be.visible');
      cy.contains('Deck name').should('be.visible');
      // Cancel
      cy.contains('Cancel').click();
      cy.contains('Create a new deck').should('not.exist');
    });

    it('should create a new deck', () => {
      cy.contains('+ New Deck').click();
      cy.contains('Create a new deck').should('be.visible');

      // Fill the deck name using the placeholder input
      cy.get('input[placeholder="e.g. Spanish Verbs, Travel Phrases"]').type('French Verbs');
      cy.get('input[placeholder="What is this deck for?"]').type('Common verb conjugations');

      // Submit via Save button
      cy.contains('button', 'Save').click();
      cy.wait('@createDeck');

      // Form should close after creation
      cy.contains('Create a new deck').should('not.exist');
    });

    it('should open deck detail view showing card count and start-review button', () => {
      cy.contains('Spanish Basics').click();

      // Detail view should show card count and back/edit buttons
      cy.contains('12 cards').should('be.visible');
      cy.contains('Back').should('be.visible');
      cy.contains('Edit deck').should('be.visible');
    });

    it('should show add-cards panel within deck detail', () => {
      cy.contains('Spanish Basics').click();
      cy.contains('Back').should('be.visible');

      // The add-cards section should be visible
      cy.contains('Add cards to this deck').should('be.visible');
      // The available-cards list renders "+ Add" buttons for flashcards
      cy.contains('+ Add').should('be.visible');
    });
  });

  // ===================================================================
  // 3. SRS Flashcard Review
  // ===================================================================
  describe('SRS Flashcard Review (/review)', () => {
    beforeEach(() => {
      cy.visit('/review');
      cy.wait('@getDueFlashcards');
    });

    it('should load the review page with due cards', () => {
      cy.contains('🎯 Flashcard Review').should('be.visible');
      cy.contains('Card 1 of 2').should('be.visible');
      // First card word_token should be shown
      cy.contains('diligent').should('be.visible');
    });

    it('should display a progress bar', () => {
      cy.get('[role="progressbar"]').should('be.visible');
      cy.get('[role="progressbar"]').should('have.attr', 'aria-valuemin', '0');
      cy.get('[role="progressbar"]').should('have.attr', 'aria-valuemax', '100');
    });

    it('should flip the flashcard on click in review mode', () => {
      cy.contains('diligent').should('be.visible');
      cy.get('.flip-card').click();
      cy.get('.flip-card.is-flipped').should('exist');
    });

    it('should grade a card and advance to the next', () => {
      cy.contains('diligent').should('be.visible');

      // Grade as 'Good'
      cy.contains('button', 'Good').click();
      cy.wait('@updateSrs');

      // Should now show the second card
      cy.contains('candid').should('be.visible');
      // Progress should reflect position 2 of 2
      cy.contains('Card 2 of 2').should('be.visible');
    });

    it('should show completion screen after all due cards are reviewed', () => {
      cy.contains('button', 'Good').click();
      cy.wait('@updateSrs');
      cy.contains('button', 'Good').click();
      cy.wait('@updateSrs');

      // Completion state
      cy.contains('Review Complete!').should('be.visible');
    });

    it('should restart review session from completion', () => {
      cy.contains('button', 'Good').click();
      cy.wait('@updateSrs');
      cy.contains('button', 'Good').click();
      cy.wait('@updateSrs');

      cy.contains('Review Complete!').should('be.visible');
      cy.contains('Start Again').click();

      // Should reload due cards
      cy.wait('@getDueFlashcards');
      cy.contains('🎯 Flashcard Review').should('be.visible');
    });
  });

  // ===================================================================
  // 4. Chat Room -- Tokenised Text & LingQ Integration
  // ===================================================================
  describe('Chat Room LingQ Token Integration', () => {
    beforeEach(() => {
      cy.visit('/chat/room-1');
      cy.wait('@getMessages');
      cy.wait('@getFlashcards');
    });

    it('should render tokenised text segments in chat messages', () => {
      cy.get('app-tokenised-text').should('exist');
      cy.get('app-tokenised-text span').should('have.length.at.least', 1);
    });

    it('should open word definition modal when clicking a word token', () => {
      // Click on a clickable word button in the tokenised text
      cy.get('app-tokenised-text span[role="button"]').first().click();
      cy.wait('@translateWord');

      // The word definition modal should appear
      cy.get('app-word-definition-modal').should('exist');
      cy.contains('LingQ Interactive Reader').should('be.visible');
    });

    it('should allow saving a word to the SRS deck from the modal', () => {
      cy.get('app-tokenised-text span[role="button"]').first().click();
      cy.wait('@translateWord');

      // Click "Save to learning" button
      cy.contains('Save to learning').should('be.visible').click();
      cy.wait('@saveFlashcard');
    });
  });

  // ===================================================================
  // 5. Audio Sync Reader -- Immersion Playback
  // ===================================================================
  describe('Audio Sync Reader -- Immersion Playback', () => {
    beforeEach(() => {
      cy.visit('/chat/room-1');
      cy.wait('@getMessages');
      cy.wait('@getFlashcards');
    });

    it('should render the audio sync reader with tokenised text', () => {
      // The audio-sync-reader component should be rendered in the chat room
      cy.get('app-audio-sync-reader').should('exist');
    });

    it('should show play button and toggle play/pause via speech synthesis', () => {
      cy.get('app-audio-sync-reader').should('exist');

      // Find the play button
      cy.contains('Play Audio Lesson').should('be.visible');

      // Click play -- should trigger speech synthesis
      cy.contains('Play Audio Lesson').click();

      // Button should change to pause text
      cy.contains('Pause Immersion Audio').should('be.visible');

      // Click again to stop
      cy.contains('Pause Immersion Audio').click();

      // Should revert to play
      cy.contains('Play Audio Lesson').should('be.visible');
    });
  });
});
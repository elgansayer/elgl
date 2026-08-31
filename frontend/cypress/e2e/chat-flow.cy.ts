describe('Chat Flow (Mocked)', () => {
  const roomId = 'room-123';
  const fixedTimestamp = '2026-08-28T12:00:00.000Z';
  let failNextSend = false;
  let sendAttempts = 0;

  beforeEach(() => {
    failNextSend = false;
    sendAttempts = 0;
    Object.assign(Cypress, {
      __cypressExpectedRunnerConsoleError: 'Centrifugo connection error.',
    });

    // Keep the chat flow deterministic and isolated from external services.
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('POST', '**/api/economy/daily-check-in', {
      statusCode: 200,
      body: { claimed: false, coins_rewarded: 0, new_balance: 50 },
    }).as('dailyCheckIn');
    cy.intercept('POST', '**/api/chat/token', { body: { token: 'mock-centrifugo-token' } }).as(
      'getChatToken',
    );
    cy.intercept('GET', '**/api/chat/rooms/*/members', { body: [] }).as('getRoomMembers');
    cy.intercept('GET', '**/api/chat/groups/*/members', { body: [] }).as('getGroupMembers');
    cy.intercept('PATCH', '**/api/chat/messages/*/status', { statusCode: 204, body: {} }).as(
      'markMessageStatus',
    );

    cy.intercept('POST', '**/api/nlp/grammar-check', (req) => {
      const text = typeof req.body?.text === 'string' ? req.body.text : '';
      req.reply({
        statusCode: 200,
        body: {
          original: text,
          corrected: text,
          explanation: '',
          errors_found: 0,
        },
      });
    }).as('checkGrammar');

    cy.intercept('GET', '**/api/chat/rooms', {
      body: [
        {
          id: roomId,
          title: 'Language Exchange with Maria',
          subtitle: 'Hola a todos!',
          created_at: fixedTimestamp,
          avatar: 'https://example.test/maria-avatar.png',
          is_online: true,
          is_pinned: false,
        },
      ],
    }).as('getRooms');

    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');

    cy.intercept('GET', `**/api/chat/messages/${roomId}*`, {
      body: [
        {
          id: 'msg-1',
          room_id: roomId,
          sender_id: 'partner-2',
          message_type: 'text',
          text_content: 'Hola, how are you?',
          created_at: fixedTimestamp,
          is_read: true,
        },
      ],
    }).as('getMessages');

    cy.intercept('POST', '**/api/chat/messages', (req) => {
      sendAttempts += 1;
      if (failNextSend) {
        failNextSend = false;
        req.reply({
          statusCode: 503,
          headers: { 'x-cypress-expected-error': 'true' },
          body: { message: 'Chat service temporarily unavailable' },
        });
        return;
      }

      req.reply({
        statusCode: 201,
        body: {
          id: `msg-sent-${sendAttempts}`,
          room_id: roomId,
          sender_id: 'mock-user-123',
          message_type: 'text',
          text_content: req.body.text_content,
          created_at: fixedTimestamp,
          is_read: false,
        },
      });
    }).as('sendMessage');
  });

  afterEach(() => {
    Reflect.deleteProperty(Cypress, '__cypressExpectedRunnerConsoleError');
  });

  it('displays the chat list and navigates to the selected room', () => {
    cy.visit('/chat');

    cy.wait('@getRooms');
    cy.contains('Language Exchange with Maria').should('be.visible').click();

    cy.url().should('include', `/chat/${roomId}`);
    cy.wait('@getMessages');
    cy.get('[data-testid="chat-message"]').should('have.length', 1);
  });

  it('sends a text message with the canonical room and message payload', () => {
    cy.visit(`/chat/${roomId}`);
    cy.wait('@getMessages');

    const testMessage = 'I am doing great, thanks for asking!';
    cy.get('[data-testid="chat-message-input"]').type(`${testMessage}{enter}`);

    cy.wait('@checkGrammar')
      .its('request.body.text')
      .should('eq', testMessage);
    cy.wait('@sendMessage').then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      expect(interception.request.body).to.deep.include({
        room_id: roomId,
        message_type: 'text',
        text_content: testMessage,
      });
    });

    cy.get('[data-testid="chat-message"]').should('have.length', 2);
    cy.get('[data-testid="chat-message-input"]').should('have.value', '');
  });

  it('does not submit whitespace-only messages', () => {
    cy.visit(`/chat/${roomId}`);
    cy.wait('@getMessages');

    cy.get('[data-testid="chat-message-input"]').type('   {enter}');

    cy.then(() => {
      expect(sendAttempts).to.eq(0);
    });
    cy.get('[data-testid="chat-message"]').should('have.length', 1);
  });

  it('retains a failed message draft and allows a successful retry', () => {
    failNextSend = true;
    const retryMessage = 'Please keep this draft if sending fails.';

    cy.visit(`/chat/${roomId}`);
    cy.wait('@getMessages');
    cy.window().then((win) => {
      (win as typeof win & { __cypressExpectedConsoleError?: string }).__cypressExpectedConsoleError =
        'Error sending message:';
    });
    cy.get('[data-testid="chat-message-input"]').type(`${retryMessage}{enter}`);

    cy.wait('@sendMessage').its('response.statusCode').should('eq', 503);
    cy.get('[data-testid="chat-message-input"]').should('have.value', retryMessage);
    cy.get('[data-testid="chat-message"]').should('have.length', 1);

    cy.get('[data-testid="chat-message-input"]').type('{enter}');
    cy.wait('@sendMessage').then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      expect(interception.request.body.text_content).to.eq(retryMessage);
    });

    cy.get('[data-testid="chat-message-input"]').should('have.value', '');
    cy.get('[data-testid="chat-message"]').should('have.length', 2);
    cy.then(() => {
      expect(sendAttempts).to.eq(2);
    });
  });
});

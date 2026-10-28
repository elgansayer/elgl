interface HistoryReply {
  statusCode: number;
  headers?: Record<string, string>;
  body: unknown;
}

interface InterceptedRequest {
  request: { url: string };
}

type ExpectedErrorWindow = Window & { __cypressExpectedConsoleError?: string };

describe('Chat Flow (Mocked)', () => {
  const roomId = 'room-123';
  const fixedTimestamp = '2026-08-28T12:00:00.000Z';
  const currentUserId = 'mock-user-123';
  let failNextSend = false;
  let sendAttempts = 0;
  let historyReply: (url: string) => HistoryReply;

  function messageAt(minute: number): string {
    return new Date(Date.parse(fixedTimestamp) + minute * 60_000).toISOString();
  }

  function partnerMessage(id: string, minute: number, unread = false) {
    return {
      id,
      room_id: roomId,
      sender_id: 'partner-2',
      message_type: 'text',
      text_content: `Message ${id}`,
      created_at: messageAt(minute),
      is_read: !unread,
      ...(unread ? { delivery_status: 'delivered' } : {}),
    };
  }

  function ownMessage(id: string, minute: number, deliveryStatus: 'sent' | 'delivered' | 'read') {
    return {
      id,
      room_id: roomId,
      sender_id: currentUserId,
      message_type: 'text',
      text_content: `Message ${id}`,
      created_at: messageAt(minute),
      is_read: false,
      delivery_status: deliveryStatus,
    };
  }

  beforeEach(() => {
    failNextSend = false;
    sendAttempts = 0;
    historyReply = () => ({
      statusCode: 200,
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
    });

    // Keep the chat flow deterministic and isolated from external services.
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('POST', '**/api/economy/daily-check-in', {
      body: { claimed: false, coins_rewarded: 0, new_balance: 50 },
    }).as('dailyCheckIn');

    // Mock the backend's supported rate-limit response so this product-flow test
    // exercises the realtime degraded path without creating a real WebSocket.
    cy.intercept('POST', '**/api/chat/token', {
      statusCode: 429,
      headers: { 'retry-after': '30' },
      body: { message: 'Centrifugo unavailable in the mocked E2E environment' },
    }).as('centrifugoUnavailable');
    cy.intercept('GET', '**/api/chat/rooms/*/members', { body: [] }).as('getRoomMembers');
    cy.intercept('GET', '**/api/chat/groups/*/members', { body: [] }).as('getGroupMembers');
    cy.intercept('PATCH', '**/api/chat/messages/*/status', { statusCode: 204, body: {} }).as(
      'markMessageStatus',
    );
    cy.intercept('POST', `**/api/chat/rooms/${roomId}/read`, {
      statusCode: 200,
      body: { success: true, marked: 0 },
    }).as('markRoomRead');
    cy.intercept('POST', '**/api/chat/typing', { statusCode: 200, body: { success: true } }).as(
      'sendTyping',
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

    // The inbox requests `/chat/rooms` and the routed room requests
    // `/chat/rooms?include_locked=true`, so the pattern must tolerate a query string.
    cy.intercept('GET', '**/api/chat/rooms*', {
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
    cy.intercept('GET', '**/api/chat/archived-rooms', { body: [] }).as('getArchivedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');

    cy.intercept('GET', `**/api/chat/messages/${roomId}*`, (req) => {
      req.reply(historyReply(req.url));
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

  it('displays the chat list and navigates to the selected room', () => {
    cy.visit('/chat');

    // The room and message may come from IndexedDB on a Cypress retry.
    cy.contains('Language Exchange with Maria').should('be.visible').click();

    cy.url().should('include', `/chat/${roomId}`);
    cy.get('[data-testid="chat-message"]').should(($messages) => {
      expect($messages.length).to.be.greaterThan(0);
    });
    // The routed room asks the API for its own lock state instead of trusting the inbox list.
    cy.get<InterceptedRequest[]>('@getRooms.all').should((interceptions) => {
      const requestedUrls = interceptions.map((interception) => interception.request.url);
      expect(requestedUrls.some((url) => url.includes('include_locked=true'))).to.eq(true);
    });
  });

  it('sends a text message with the canonical room and message payload', () => {
    let initialMessageCount = 0;
    cy.visit(`/chat/${roomId}`);
    cy.get('[data-testid="chat-message"]').then(($messages) => {
      initialMessageCount = $messages.length;
      expect(initialMessageCount).to.be.greaterThan(0);
    });

    const testMessage = 'I am doing great, thanks for asking!';
    cy.get('[data-testid="chat-message-input"]').type(`${testMessage}{enter}`);

    cy.wait('@checkGrammar').its('request.body.text').should('eq', testMessage);
    cy.wait('@sendMessage').then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      expect(interception.request.body).to.deep.include({
        room_id: roomId,
        message_type: 'text',
        text_content: testMessage,
      });
    });

    cy.get('[data-testid="chat-message"]').should(($messages) => {
      expect($messages).to.have.length(initialMessageCount + 1);
    });
    cy.get('[data-testid="chat-message-input"]').should('have.value', '');
  });

  it('does not submit whitespace-only messages', () => {
    let initialMessageCount = 0;
    cy.visit(`/chat/${roomId}`);
    cy.get('[data-testid="chat-message"]').then(($messages) => {
      initialMessageCount = $messages.length;
      expect(initialMessageCount).to.be.greaterThan(0);
    });

    cy.get('[data-testid="chat-message-input"]').type('   {enter}');

    cy.then(() => {
      expect(sendAttempts).to.eq(0);
    });
    cy.get('[data-testid="chat-message"]').should(($messages) => {
      expect($messages).to.have.length(initialMessageCount);
    });
  });

  it('retains a failed message draft and allows a successful retry', () => {
    failNextSend = true;
    const retryMessage = 'Please keep this draft if sending fails.';
    let initialMessageCount = 0;

    cy.visit(`/chat/${roomId}`);
    cy.get('[data-testid="chat-message"]').then(($messages) => {
      initialMessageCount = $messages.length;
      expect(initialMessageCount).to.be.greaterThan(0);
    });
    cy.window().then((win) => {
      (
        win as typeof win & { __cypressExpectedConsoleError?: string }
      ).__cypressExpectedConsoleError = 'Failed to send text message:';
    });
    cy.get('[data-testid="chat-message-input"]').type(`${retryMessage}{enter}`);

    cy.wait('@sendMessage').its('response.statusCode').should('eq', 503);
    cy.get('[data-testid="chat-message-input"]').should('have.value', retryMessage);
    cy.get('[data-testid="chat-message"]').should(($messages) => {
      expect($messages).to.have.length(initialMessageCount);
    });

    cy.get('[data-testid="chat-message-input"]').type('{enter}');
    cy.wait('@sendMessage').then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      expect(interception.request.body.text_content).to.eq(retryMessage);
    });

    cy.get('[data-testid="chat-message-input"]').should('have.value', '');
    cy.get('[data-testid="chat-message"]').should(($messages) => {
      expect($messages).to.have.length(initialMessageCount + 1);
    });
    cy.then(() => {
      expect(sendAttempts).to.eq(2);
    });
  });

  it('shows delivery and read receipts on the reader own messages with accessible names', () => {
    historyReply = () => ({
      statusCode: 200,
      body: [
        partnerMessage('in-1', 1),
        ownMessage('own-1', 2, 'delivered'),
        ownMessage('own-2', 3, 'read'),
      ],
    });

    cy.visit(`/chat/${roomId}`);

    cy.get('[role="log"]').should('have.attr', 'aria-label', 'Conversation messages');
    cy.get('app-read-receipt').should('have.length', 2);
    cy.get('app-read-receipt')
      .first()
      .find('[role="img"]')
      .should('have.attr', 'aria-label', 'Delivered');
    // Only the newest own message repeats its state as visible text.
    cy.get('app-read-receipt').first().should('not.contain.text', 'Delivered');
    cy.get('app-read-receipt')
      .last()
      .find('[role="img"]')
      .should('have.attr', 'aria-label', 'Read');
    cy.get('app-read-receipt').last().should('contain.text', 'Read');
  });

  it('acknowledges unread partner messages with a single bulk request', () => {
    historyReply = () => ({
      statusCode: 200,
      body: [partnerMessage('in-1', 1, true), partnerMessage('in-2', 2, true)],
    });

    cy.visit(`/chat/${roomId}`);

    cy.wait('@markRoomRead')
      .its('request.body')
      .should('deep.equal', { message_ids: ['in-1', 'in-2'] });
    cy.get('@markRoomRead.all').should('have.length', 1);
  });

  it('pages earlier history using the oldest loaded timestamp as the cursor', () => {
    const newestPage = Array.from({ length: 100 }, (_, index) =>
      partnerMessage(`page-${index}`, 100 + index),
    );
    const earlier = [partnerMessage('old-1', 1), partnerMessage('old-2', 2)];
    historyReply = (url) => ({
      statusCode: 200,
      body: url.includes('before=') ? earlier : newestPage,
    });

    cy.visit(`/chat/${roomId}`);
    cy.get('[data-testid="chat-message"]').should('have.length', 100);
    cy.contains('button', 'Load earlier messages').click();

    cy.get('@getMessages.all').should('have.length.at.least', 2);
    cy.get('@getMessages.all').then((interceptions) => {
      const last = new URL(String(interceptions[interceptions.length - 1].request.url));
      expect(last.searchParams.get('before')).to.eq(newestPage[0].created_at);
      expect(last.searchParams.get('limit')).to.eq('100');
    });
    cy.get('[data-testid="chat-message"]').should('have.length', 102);
    // A short page means the beginning of the conversation was reached.
    cy.contains('button', 'Load earlier messages').should('not.exist');
  });

  it('explains an unavailable history and recovers when the reader retries', () => {
    let attempts = 0;
    historyReply = () => {
      attempts += 1;
      if (attempts === 1) {
        return {
          statusCode: 503,
          headers: { 'x-cypress-expected-error': 'true' },
          body: { message: 'Chat service temporarily unavailable' },
        };
      }
      return { statusCode: 200, body: [partnerMessage('after-retry', 1)] };
    };

    cy.visit(`/chat/${roomId}`, {
      onBeforeLoad(win) {
        // Start from a cold cache so the API failure is what the reader sees.
        win.indexedDB.deleteDatabase('hellotalk_cache');
        const expectedWindow: ExpectedErrorWindow = win;
        expectedWindow.__cypressExpectedConsoleError = 'Failed to load chat history:';
      },
    });

    cy.contains('[role="alert"]', 'Messages could not be loaded').should('be.visible');
    cy.get('[data-testid="chat-message"]').should('not.exist');
    cy.contains('[role="alert"] button', 'Retry').click();

    cy.get('[data-testid="chat-message"]').should('have.length', 1);
    cy.contains('[role="alert"]', 'Messages could not be loaded').should('not.exist');
  });
});

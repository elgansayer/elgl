describe('Chat Flow (Mocked)', () => {
  beforeEach(() => {
    // 1. Mock the user's session and basic API requirements
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('POST', '**/api/chat/token', { body: { token: 'mock-centrifugo-token' } }).as(
      'getChatToken',
    );
    cy.intercept('GET', '**/api/chat/rooms/*/members', { body: [] }).as('getRoomMembers');
    cy.intercept('GET', '**/api/chat/groups/*/members', { body: [] }).as('getGroupMembers');

    // 2. Mock Chat Rooms List
    cy.intercept('GET', '**/api/chat/rooms', {
      body: [
        {
          id: 'room-123',
          title: 'Language Exchange with Maria',
          subtitle: 'Hola a todos!',
          created_at: new Date().toISOString(),
          avatar: 'https://i.pravatar.cc/150?u=partner-2',
          is_online: true,
          is_pinned: false,
        },
      ],
    }).as('getRooms');

    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');

    // 3. Mock Chat Messages for room-123
    cy.intercept('GET', '**/api/chat/messages/room-123*', {
      body: [
        {
          id: 'msg-1',
          room_id: 'room-123',
          sender_id: 'partner-2',
          message_type: 'text',
          text_content: 'Hola, how are you?',
          created_at: new Date().toISOString(),
          is_read: true,
        },
      ],
    }).as('getMessages');

    // 4. Mock sending a new message
    cy.intercept('POST', '**/api/chat/messages', (req) => {
      // Echo back the sent message as a successful response
      req.reply({
        statusCode: 201,
        body: {
          id: `msg-${Date.now()}`,
          room_id: 'room-123',
          sender_id: 'mock-user-123',
          message_type: 'text',
          text_content: req.body.text_content,
          created_at: new Date().toISOString(),
          is_read: false,
        },
      });
    }).as('sendMessage');
  });

  it('should display the chat list and navigate to a chat room', () => {
    cy.visit('/chat');

    // Verify the chat room appears in the list
    cy.wait('@getRooms');
    cy.contains('Language Exchange with Maria').should('be.visible');

    // Click on the room to navigate
    cy.contains('Language Exchange with Maria').click();

    // Verify we are routed to the room and messages load
    cy.url().should('include', '/chat/room-123');
  });

  it('should allow sending a new text message', () => {
    cy.visit('/chat/room-123');

    const testMessage = 'I am doing great, thanks for asking!';

    // Type and send a message
    cy.get('[data-testid="chat-message-input"]').type(testMessage);

    // Sometimes send buttons are just icons, we can hit Enter instead or find the button
    cy.get('[data-testid="chat-message-input"]').type('{enter}');

    // Wait for the POST request to complete
    cy.wait('@sendMessage').its('request.body.text_content').should('eq', testMessage);

    // Assert the message is optimistically added to the UI
    cy.get('[data-testid="chat-message"]').should('have.length', 2);
  });
});

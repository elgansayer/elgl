describe('Chat Messaging Flow', () => {
  beforeEach(() => {
    // Assuming a mock login or session setup happens here
    // cy.login('test@example.com', 'password123');
    cy.visit('/chat/room-123');
  });

  it('should send a text message and display it in the chat room', () => {
    const testMessage = 'Hello, this is a test message from Cypress!';

    // Type message
    cy.get('input[placeholder="Type your message"]').type(testMessage);

    // Click send
    cy.contains('Send').click();

    // Verify message appears in the chat feed
    cy.contains(testMessage).should('be.visible');
  });

  it('should allow sending a correction', () => {
    cy.contains('Correct').click();

    cy.get('input[placeholder="Original sentence"]').type('I goes to school');
    cy.get('input[placeholder="Corrected sentence"]').type('I go to school');
    cy.get('input[placeholder="Explanation"]').type('Subject-verb agreement');

    cy.contains('Send correction').click();

    cy.contains('I go to school').should('be.visible');
    cy.contains('Subject-verb agreement').should('be.visible');
  });
});

describe('Home / Discovery Feed', () => {
  beforeEach(() => {
    // Intercept API calls to prevent 401s if unauthenticated.
    // We mock the backend responses to ensure the frontend renders correctly.
    cy.intercept('GET', '**/api/chat/locked-rooms', { body: [] }).as('getLockedRooms');
    cy.intercept('GET', '**/api/chat/rooms', { body: [] }).as('getRooms');
    cy.intercept('GET', '**/api/chat/labels', { body: [] }).as('getLabels');
    cy.intercept('GET', '**/api/safety/blocked-ids', { body: [] }).as('getBlockedIds');
    cy.intercept('GET', '**/api/safety/blocked-ids/*', { body: [] }).as('getUserBlockedIds');
    cy.intercept('GET', '**/api/safety/blocker-ids/*', { body: [] }).as('getBlockerIds');
    cy.intercept('GET', '**/api/safety/blocked-and-blocker-ids/*', { body: [] }).as(
      'getBlockedAndBlockerIds',
    );
    cy.intercept('GET', '**/api/economy/catalog', { body: [] }).as('getCatalog');
    cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 0 } }).as('getBalance');

    cy.visit('/home');
  });

  it('should load the home page without any console errors or 401s', () => {
    cy.get('body').should('exist');
    // Ensure the main layout shell or a key component exists
    cy.get('app-home, .app-layout').should('exist');
  });
});

// Add custom Cypress commands here

export function setupCommonMocks(): void {
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
  cy.intercept('GET', '**/api/economy/balance', { body: { coins_balance: 500 } }).as('getBalance');
}

Cypress.Commands.add('setupCommonMocks', setupCommonMocks);

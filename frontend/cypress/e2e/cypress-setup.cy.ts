describe('Cypress frontend setup', () => {
  it('reaches the Angular dev server through the configured baseUrl', () => {
    cy.request('/').its('status').should('eq', 200);
  });

  it('boots the Angular application shell in a browser', () => {
    cy.visit('/');

    cy.get('app-root').should('exist');
    cy.document().its('readyState').should('eq', 'complete');
  });
});

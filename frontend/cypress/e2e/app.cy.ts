describe('App Initialization', () => {
  it('should load the app', () => {
    cy.visit('/');
    cy.get('body').should('exist');
  });
});

describe('Cypress frontend setup', () => {
  it('loads the frontend Cypress configuration', () => {
    expect(Cypress.config('baseUrl')).to.eq('http://localhost:4200');
  });

  it('executes Cypress commands in the browser runner', () => {
    cy.wrap('cypress-ready').should('eq', 'cypress-ready');
  });
});

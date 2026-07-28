describe('Authentication Flow', () => {
  it('should allow a user to sign in and redirect to discovery', () => {
    cy.visit('/login');

    // Fill in login credentials
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');

    // Submit form
    cy.get('button[type="submit"]').click();

    // Verify redirect to main app area
    cy.url().should('include', '/discovery');
  });

  it('should show an error on invalid credentials', () => {
    cy.visit('/login');

    cy.get('input[type="email"]').type('wrong@example.com');
    cy.get('input[type="password"]').type('wrongpass');
    cy.get('button[type="submit"]').click();

    // Verify error message appears
    cy.contains('Invalid login credentials').should('be.visible');
  });
});

describe('Moment Creation Flow', () => {
  beforeEach(() => {
    // cy.login('test@example.com', 'password123');
    cy.visit('/moments');
  });

  it('should create a new text moment and display it in the feed', () => {
    const momentText = 'Practising my Spanish today! Hola a todos.';

    // Type into the moment creation textarea
    cy.get('textarea[placeholder="Share what you are practising today..."]').type(momentText);

    // Submit the moment
    cy.contains('Post moment').click();

    // Verify the new moment appears in the feed
    cy.contains(momentText).should('be.visible');
  });

  it('should allow liking a moment', () => {
    // Find the first like button and click it
    cy.contains('Like').first().click();

    // Verify the like state changed (e.g., button text or icon changes, or count increases)
    // This is a basic check assuming the UI updates immediately
    cy.get('.liked-state, .text-primary').should('exist');
  });
});

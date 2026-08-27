describe('Mock GPS discovery fixtures', () => {
  it('renders deterministic nearby-search fixture users through Discovery', () => {
    cy.fixture('mock-gps-discovery').then((fixture) => {
      cy.intercept('GET', '**/api/**', { body: [] });
      cy.intercept('GET', '**/api/users/me*', {
        body: {
          id: 'mock-gps-viewer',
          display_name: 'GPS Viewer',
          native_languages: ['en'],
          target_languages: ['ja'],
          is_vip: false,
          is_serious_learner: false,
        },
      });
      cy.intercept('GET', '**/api/discovery/partner-of-week', { body: [] });
      cy.intercept('GET', '**/api/discovery/partners*', {
        statusCode: 200,
        body: fixture.case.users,
      }).as('gpsPartners');

      cy.visit('/discovery');
      cy.wait('@gpsPartners');

      cy.contains('GPS Same Location').should('be.visible');
      cy.contains('GPS Radius Inside').should('be.visible');
    });
  });
});

describe('Help and About', () => {
  it('shows generated build metadata and production licence records', () => {
    cy.intercept('GET', '**/assets/generated/third-party-licences.json', {
      body: [
        {
          id: '@angular/core@22.2.2',
          name: '@angular/core',
          version: '22.2.2',
          licence: 'MIT',
          packageUrl: 'https://www.npmjs.com/package/%40angular%2Fcore/v/22.2.2',
        },
      ],
    }).as('licenceManifest');

    cy.visit('/settings/help-about');
    cy.wait('@licenceManifest');

    cy.get('app-help-about h1').should('contain.text', 'Help & About');
    cy.get('app-help-about').should('contain.text', 'App Version');
    cy.get('app-help-about').should('contain.text', 'Build Number');
    cy.get('app-help-about').should('contain.text', '@angular/core');
    cy.get('app-help-about a')
      .should('have.attr', 'target', '_blank')
      .and('have.attr', 'rel', 'noopener noreferrer');
  });
});

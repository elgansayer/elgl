import './commands';

// Harden Cypress: Fail tests if any network request returns a 401 or 500+ error
beforeEach(() => {
  cy.intercept('**/*', (req) => {
    req.on('response', (res) => {
      // 401 Unauthorized or 500+ Server Errors indicate a failure state that shouldn't occur
      if (res.statusCode === 401 || res.statusCode >= 500) {
        throw new Error(
          `E2E FAILURE: Caught unexpected ${res.statusCode} on ${req.method} ${req.url}`,
        );
      }
    });
  });
});

// Harden Cypress: Fail tests on unexpected console.error (catches Angular runtime crashes)
Cypress.on('window:before:load', (win) => {
  cy.stub(win.console, 'error').callsFake((msg, ..._args) => {
    // We can whitelist specific expected errors here if needed in the future
    const message = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if (
      message.includes('Expected Error') ||
      message.includes('Centrifugo error:') ||
      message.includes('Subscription to the channel')
    ) {
      return;
    }
    throw new Error(`E2E FAILURE: console.error was called with: ${message}`);
  });
});

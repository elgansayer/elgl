import './commands';

const EXPECTED_ERROR_HEADER = 'x-cypress-expected-error';
const EXPECTED_CONSOLE_ERROR_KEY = '__cypressExpectedConsoleError';
const EXPECTED_RUNNER_CONSOLE_ERROR_KEY = '__cypressExpectedRunnerConsoleError';

type ExpectedErrorWindow = Window & {
  [EXPECTED_CONSOLE_ERROR_KEY]?: string;
};

// Harden Cypress: Fail tests if any unexpected network request returns a 401 or 500+ error
beforeEach(() => {
  cy.intercept('**/*', (req) => {
    req.on('response', (res) => {
      const isExpectedFailure = res.headers[EXPECTED_ERROR_HEADER] === 'true';

      // 401 Unauthorized or 500+ Server Errors indicate a failure state that shouldn't occur.
      // Failure-path specs may opt out for a single mocked response using the test-only header.
      if (!isExpectedFailure && (res.statusCode === 401 || res.statusCode >= 500)) {
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
    const message = typeof msg === 'string' ? msg : JSON.stringify(msg);
    const expectedWindow = win as ExpectedErrorWindow;
    const expectedConsoleError = expectedWindow[EXPECTED_CONSOLE_ERROR_KEY];
    const expectedRunnerConsoleError = Object.getOwnPropertyDescriptor(
      Cypress,
      EXPECTED_RUNNER_CONSOLE_ERROR_KEY,
    )?.value;

    // Failure-path specs can permit one specific, handled console error without weakening
    // the suite-wide guard for unrelated runtime failures.
    if (expectedConsoleError && message.includes(expectedConsoleError)) {
      delete expectedWindow[EXPECTED_CONSOLE_ERROR_KEY];
      return;
    }

    // Some startup failures happen before a spec can access the application window.
    // Specs may permit one exact startup error through runner state, which is consumed here.
    if (
      typeof expectedRunnerConsoleError === 'string' &&
      message === expectedRunnerConsoleError
    ) {
      Reflect.deleteProperty(Cypress, EXPECTED_RUNNER_CONSOLE_ERROR_KEY);
      return;
    }

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

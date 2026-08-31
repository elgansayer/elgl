/// <reference types="cypress" />

// ***********************************************
// Custom Cypress Commands
// ***********************************************

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    interface Chainable<Subject = any> {
      expectConsoleError(message: string): Chainable<void>;
    }
  }
}

// Ensure this file is treated as a module
export {}

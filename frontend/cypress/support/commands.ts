/// <reference types="cypress" />

// ***********************************************
// Custom Cypress Commands
// ***********************************************

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Chainable<Subject = unknown> {
      // Custom command types can be added here as needed
    }
  }
}

// Ensure this file is treated as a module
export {}

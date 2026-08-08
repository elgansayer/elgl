/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Sets up common API mocks for chat, safety, and economy endpoints.
     * Use this in beforeEach blocks to mock backend responses.
     */
    setupCommonMocks(): Chainable<void>;
  }
}
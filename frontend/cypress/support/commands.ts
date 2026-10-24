/// <reference types="cypress" />

// ***********************************************
// Custom Cypress Commands
// ***********************************************

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    // Must mirror Cypress's own declaration so the interfaces merge.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    interface Chainable<Subject = any> {
      /**
       * Visit a route with a seeded Supabase session. Authentication fails
       * closed (#7603), so specs for signed-in screens must provide one.
       */
      visitWithSession(url: string, userId?: string): Chainable<AUTWindow>;
    }
  }
}

// supabase-js stores the session under sb-<project ref>-auth-token; the
// development environment points at https://mock.supabase.co.
const SUPABASE_SESSION_KEY = 'sb-mock-auth-token';

Cypress.Commands.add('visitWithSession', (url: string, userId = 'mock-user-123') => {
  const session = {
    access_token: 'cypress-access-token',
    refresh_token: 'cypress-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${userId}@example.invalid`,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z',
    },
  };
  return cy.visit(url, {
    onBeforeLoad(win) {
      win.localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(session));
    },
  });
});

// Ensure this file is treated as a module
export {}

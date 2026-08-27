import assert from 'node:assert/strict';
import test from 'node:test';

import { collectCypressSetupFailures } from './verify-cypress-setup.mjs';

function validFixture() {
  const files = new Set([
    'cypress/support/e2e.ts',
    'cypress/support/commands.ts',
    'cypress/e2e/cypress-setup.cy.ts',
    'cypress/e2e/app.cy.ts',
  ]);

  return {
    pkg: {
      scripts: {
        'cypress:open': 'cypress open',
        e2e: 'cypress run',
        'e2e:ci': 'start-server-and-test start http://localhost:4200 e2e',
      },
      devDependencies: {
        cypress: '^15.21.0',
        'start-server-and-test': '^3.0.12',
      },
    },
    lockfile: {
      packages: {
        '': {
          devDependencies: {
            cypress: '^15.21.0',
            'start-server-and-test': '^3.0.12',
          },
        },
        'node_modules/cypress': { version: '15.21.0' },
        'node_modules/start-server-and-test': { version: '3.0.12' },
      },
    },
    config: [
      "import { defineConfig } from 'cypress';",
      "baseUrl: 'http://localhost:4200'",
      "supportFile: 'cypress/support/e2e.ts'",
      "specPattern: 'cypress/e2e/**/*.cy.ts'",
    ].join('\n'),
    exists: (file) => files.has(file),
  };
}

test('accepts the canonical frontend Cypress setup', () => {
  assert.deepEqual(collectCypressSetupFailures(validFixture()), []);
});

test('rejects a Cypress dependency missing from package.json or the lockfile', () => {
  const fixture = validFixture();
  delete fixture.pkg.devDependencies.cypress;
  delete fixture.lockfile.packages['node_modules/cypress'];

  assert.deepEqual(collectCypressSetupFailures(fixture), [
    'cypress must be declared in frontend devDependencies',
    'package-lock must contain node_modules/cypress',
  ]);
});

test('rejects package.json and package-lock dependency drift', () => {
  const fixture = validFixture();
  fixture.lockfile.packages[''].devDependencies.cypress = '^14.0.0';
  fixture.lockfile.packages[''].devDependencies['start-server-and-test'] = '^2.0.0';

  assert.deepEqual(collectCypressSetupFailures(fixture), [
    'package-lock root Cypress version must match package.json',
    'package-lock root start-server-and-test version must match package.json',
  ]);
});

test('rejects missing runner scripts and canonical configuration', () => {
  const fixture = validFixture();
  fixture.pkg.scripts.e2e = 'echo skipped';
  fixture.config = "import { defineConfig } from 'cypress';";

  const failures = collectCypressSetupFailures(fixture);
  assert.ok(failures.includes('e2e must execute cypress run'));
  assert.ok(failures.includes("cypress.config.ts missing: baseUrl: 'http://localhost:4200'"));
  assert.ok(
    failures.includes("cypress.config.ts missing: supportFile: 'cypress/support/e2e.ts'"),
  );
  assert.ok(
    failures.includes("cypress.config.ts missing: specPattern: 'cypress/e2e/**/*.cy.ts'"),
  );
});

test('rejects a missing support or smoke-test file', () => {
  const fixture = validFixture();
  fixture.exists = (file) => file !== 'cypress/support/commands.ts' && file !== 'cypress/e2e/app.cy.ts';

  assert.deepEqual(collectCypressSetupFailures(fixture), [
    'missing Cypress setup file: cypress/support/commands.ts',
    'missing Cypress setup file: cypress/e2e/app.cy.ts',
  ]);
});

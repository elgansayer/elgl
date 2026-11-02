import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { collectCypressSetupFailures, verifyCypressSetup } from './verify-cypress-setup.mjs';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function validFixture() {
  const files = new Set([
    'cypress/tsconfig.json',
    'cypress/support/e2e.ts',
    'cypress/support/commands.ts',
    'cypress/e2e/cypress-setup.cy.ts',
    'cypress/e2e/app.cy.ts',
    'cypress/e2e/moments-flow.cy.ts',
    'cypress/e2e/chat-flow.cy.ts',
  ]);

  return {
    pkg: {
      scripts: {
        'cypress:open': 'cypress open',
        e2e: 'cypress run',
        'e2e:ci': 'start-server-and-test start http://localhost:4200 e2e',
        'test:cypress-setup': 'node --test scripts/verify-cypress-setup.test.mjs',
        pretest: 'npm run test:cypress-setup',
        'check:cypress-types': 'tsc -p cypress/tsconfig.json --noEmit',
        lint: 'eslint "src/**/*.ts" && npm run check:cypress-types',
        'lint:check': 'eslint "src/**/*.ts" && npm run check:cypress-types',
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
  assert.ok(failures.includes("cypress.config.ts missing: supportFile: 'cypress/support/e2e.ts'"));
  assert.ok(failures.includes("cypress.config.ts missing: specPattern: 'cypress/e2e/**/*.cy.ts'"));
});

test('rejects regression tests that are missing or not part of the test gate', () => {
  const fixture = validFixture();
  fixture.pkg.scripts['test:cypress-setup'] = 'echo skipped';
  fixture.pkg.scripts.pretest = 'npm run test:help-about-data';

  assert.deepEqual(collectCypressSetupFailures(fixture), [
    'test:cypress-setup must run the Cypress setup regression tests',
    'pretest must run test:cypress-setup',
  ]);

  delete fixture.pkg.scripts['test:cypress-setup'];
  delete fixture.pkg.scripts.pretest;

  assert.deepEqual(collectCypressSetupFailures(fixture), [
    'test:cypress-setup must run the Cypress setup regression tests',
    'pretest must run test:cypress-setup',
  ]);
});

test('rejects a Cypress type-check that is missing or not part of the lint gates', () => {
  const fixture = validFixture();
  fixture.pkg.scripts['check:cypress-types'] = 'echo skipped';
  fixture.pkg.scripts.lint = 'eslint "src/**/*.ts"';
  fixture.pkg.scripts['lint:check'] = 'eslint "src/**/*.ts"';

  assert.deepEqual(collectCypressSetupFailures(fixture), [
    'check:cypress-types must type-check cypress/tsconfig.json',
    'lint must run check:cypress-types',
    'lint:check must run check:cypress-types',
  ]);

  delete fixture.pkg.scripts['check:cypress-types'];
  delete fixture.pkg.scripts.lint;
  delete fixture.pkg.scripts['lint:check'];

  assert.deepEqual(collectCypressSetupFailures(fixture), [
    'check:cypress-types must type-check cypress/tsconfig.json',
    'lint must run check:cypress-types',
    'lint:check must run check:cypress-types',
  ]);
});

test('rejects a missing Cypress TypeScript project', () => {
  const fixture = validFixture();
  fixture.exists = (file) => file !== 'cypress/tsconfig.json';

  assert.deepEqual(collectCypressSetupFailures(fixture), [
    'missing Cypress setup file: cypress/tsconfig.json',
  ]);
});

test('rejects missing support or smoke-test files', () => {
  const fixture = validFixture();
  fixture.exists = (file) =>
    file !== 'cypress/support/commands.ts' &&
    file !== 'cypress/e2e/app.cy.ts' &&
    file !== 'cypress/e2e/chat-flow.cy.ts';

  assert.deepEqual(collectCypressSetupFailures(fixture), [
    'missing Cypress setup file: cypress/support/commands.ts',
    'missing Cypress setup file: cypress/e2e/app.cy.ts',
    'missing Cypress setup file: cypress/e2e/chat-flow.cy.ts',
  ]);
});

test('the frontend package satisfies its own Cypress installation contract', () => {
  // Reads the real package.json, package-lock.json, cypress.config.ts and Cypress files, so
  // lockfile drift or a dropped script fails here instead of only on a clean-checkout `npm ci`.
  assert.deepEqual(verifyCypressSetup(frontendRoot), []);
});

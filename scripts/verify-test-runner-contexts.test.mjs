import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findCommandViolations,
  validateE2ERunnerWorkflow,
  validatePackageScripts,
} from './verify-test-runner-contexts.mjs';

test('rejects direct Node execution of Playwright specs', () => {
  const violations = findCommandViolations(
    'run: node e2e/tests/auth.spec.ts',
    '.github/workflows/qa.yml',
  );

  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, 'direct-playwright-spec');
});

test('rejects Playwright specs passed to Vitest', () => {
  const violations = findCommandViolations(
    'run: npx vitest run e2e/tests/chat-messaging.spec.ts',
    '.github/workflows/qa.yml',
  );

  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, 'wrong-test-runner');
});

test('allows package-owned Playwright discovery and Node test runner usage', () => {
  assert.deepEqual(findCommandViolations('cd e2e && npm test -- --list'), []);
  assert.deepEqual(findCommandViolations('node --test scripts/example.test.mjs'), []);
});

test('requires the e2e package to own standalone Playwright execution', () => {
  const packages = {
    'package.json': { scripts: { test: 'npm run test:frontend' } },
    'frontend/package.json': { scripts: { test: 'ng test --no-watch' } },
    'backend/package.json': { scripts: { test: 'vitest run' } },
    'admin-portal/package.json': { scripts: { test: 'vitest run' } },
    'e2e/package.json': { scripts: { test: 'npx playwright test' } },
  };

  assert.deepEqual(validatePackageScripts(packages), []);

  packages['frontend/package.json'].scripts.test = 'npx playwright test e2e/tests/auth.spec.ts';
  const violations = validatePackageScripts(packages);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, 'playwright-owned-by-wrong-package');
});

test('requires Playwright discovery to run from the e2e working directory', () => {
  const validWorkflow = `
steps:
  - run: npm ci --legacy-peer-deps
    working-directory: e2e
  - run: npm test -- --list
    working-directory: e2e
`;
  assert.deepEqual(validateE2ERunnerWorkflow(validWorkflow), []);

  const invalidWorkflow = `
steps:
  - run: npm ci --legacy-peer-deps
    working-directory: e2e
  - run: npm test -- --list
`;
  const violations = validateE2ERunnerWorkflow(invalidWorkflow);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, 'wrong-playwright-working-directory');
});

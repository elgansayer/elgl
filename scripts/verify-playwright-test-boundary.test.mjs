import assert from 'node:assert/strict';
import test from 'node:test';

import { analysePlaywrightBoundary } from './verify-playwright-test-boundary.mjs';

const validPackage = JSON.stringify({
  scripts: { test: 'npx playwright test' },
  devDependencies: { '@playwright/test': '^1.50.1' },
});
const validConfig = "export default defineConfig({ testDir: './tests' });";

function analyse(files, overrides = {}) {
  return analysePlaywrightBoundary({
    files,
    e2ePackageJson: overrides.e2ePackageJson ?? validPackage,
    e2eConfig: overrides.e2eConfig ?? validConfig,
  });
}

test('accepts the canonical e2e package invocation', () => {
  assert.deepEqual(
    analyse({
      'e2e/package.json': validPackage,
      'e2e/tests/smoke.spec.ts': "import { test } from '@playwright/test';",
    }),
    [],
  );
});

test('accepts workflows that explicitly run Playwright from e2e', () => {
  assert.deepEqual(
    analyse({
      '.github/workflows/e2e.yml': [
        '- name: Run e2e',
        '  working-directory: e2e',
        '  run: npx playwright test',
      ].join('\n'),
    }),
    [],
  );
});

test('accepts root automation that explicitly changes into e2e', () => {
  assert.deepEqual(
    analyse({
      'automation/qa-loop.sh': '(cd e2e && npx playwright test)',
    }),
    [],
  );
});

test('rejects Playwright launched from the frontend working directory', () => {
  const violations = analyse({
    'automation/qa-loop.sh': '(cd frontend && npx playwright test)',
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /qa-loop\.sh:1 invokes Playwright without the e2e working directory/);
});

test('rejects root Playwright discovery without an explicit e2e config', () => {
  const violations = analyse({
    'automation/qa-loop.sh': 'npx playwright test',
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /without the e2e working directory or explicit e2e config/);
});

test('accepts root Playwright discovery with the canonical e2e config', () => {
  assert.deepEqual(
    analyse({
      'automation/qa-loop.sh': 'npx playwright test --config e2e/playwright.config.ts',
    }),
    [],
  );
});

// Regression: a bare `playwright test` at the repository root or in frontend/ discovers Angular and
// NestJS Vitest specs and fails with `ReferenceError: describe is not defined`. The e2e context must
// belong to the invocation itself, never to a neighbouring line or workflow step.
test('rejects a workflow step that omits working-directory when only the previous step sets it', () => {
  const violations = analyse({
    '.github/workflows/e2e.yml': [
      '      - name: Install E2E dependencies',
      '        run: npm ci',
      '        working-directory: e2e',
      '',
      '      - name: Run Playwright',
      '        run: npx playwright test',
    ].join('\n'),
  });

  assert.equal(violations.length, 1);
  assert.match(
    violations[0],
    /^\.github\/workflows\/e2e\.yml:6 invokes Playwright without the e2e working directory/,
  );
  assert.match(violations[0], /"working-directory: e2e" on the same workflow step$/);
});

test('rejects a workflow step whose working-directory belongs to the following step', () => {
  const violations = analyse({
    '.github/workflows/e2e.yml': [
      '      - name: Run Playwright',
      '        run: |',
      '          set -euo pipefail',
      '          npx playwright test',
      '',
      '      - name: Upload report',
      '        run: echo done',
      '        working-directory: e2e',
    ].join('\n'),
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /^\.github\/workflows\/e2e\.yml:4 invokes Playwright/);
});

test('accepts a workflow step that owns working-directory before or after its run script', () => {
  assert.deepEqual(
    analyse({
      '.github/workflows/e2e.yml': [
        '      - name: Install E2E dependencies',
        '        run: npm ci',
        '        working-directory: e2e',
        '',
        '      - name: Run Playwright',
        '        # Discovery must stay inside the e2e package.',
        '        run: |',
        '          set -euo pipefail',
        '          npx playwright test',
        '        working-directory: "./e2e"',
        '',
        '      - working-directory: e2e',
        '        run: npx playwright test --project=rtl-arabic',
        '',
        '      - run: npx playwright test --project=rtl-hebrew',
        '        working-directory: e2e',
        '',
        '      - name: Upload report',
        '        run: echo done',
      ].join('\n'),
    }),
    [],
  );
});

test('rejects Playwright run from the root after only an install subshell entered e2e', () => {
  const violations = analyse({
    'scripts/run-e2e.sh': ['#!/usr/bin/env bash', '(cd e2e && npm ci)', 'npx playwright test'].join(
      '\n',
    ),
    'scripts/run-e2e-inline.sh': '(cd e2e && npm ci) && npx playwright test',
  });

  assert.equal(violations.length, 2);
  assert.match(violations[0], /^scripts\/run-e2e\.sh:3 invokes Playwright/);
  assert.match(violations[1], /^scripts\/run-e2e-inline\.sh:1 invokes Playwright/);
});

test('rejects Playwright after a later cd leaves e2e', () => {
  const violations = analyse({
    'scripts/run-e2e.sh': 'cd e2e && npm ci && cd ../frontend && npx playwright test',
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /^scripts\/run-e2e\.sh:1 invokes Playwright/);
});

test('accepts a cd into e2e on the same command, including continuations and path prefixes', () => {
  assert.deepEqual(
    analyse({
      'scripts/run-e2e.sh': 'cd e2e && npx playwright test --project=rtl-arabic',
      'scripts/run-e2e-from-anywhere.sh': [
        'cd "$REPO_ROOT/e2e" && \\',
        '  npx playwright test',
      ].join('\n'),
      'package.json': JSON.stringify(
        { scripts: { 'test:e2e': 'cd ../e2e && npx playwright test' } },
        null,
        2,
      ),
    }),
    [],
  );
});

test('lets an explicit cd in the command override the working-directory of its step', () => {
  const violations = analyse({
    '.github/workflows/e2e.yml': [
      '      - name: Run Playwright',
      '        run: cd ../frontend && npx playwright test',
      '        working-directory: e2e',
    ].join('\n'),
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /^\.github\/workflows\/e2e\.yml:2 invokes Playwright/);
});

test('tracks which cd is still in effect through nested subshells', () => {
  assert.deepEqual(
    analyse({
      'scripts/nested.sh': 'cd e2e && (cd ../frontend && npm ci) && npx playwright test',
      '.github/workflows/e2e.yml': [
        '      - name: Run Playwright',
        '        run: (cd ../frontend && npm ci) && npx playwright test',
        '        working-directory: e2e',
      ].join('\n'),
    }),
    [],
  );
});

test('ignores commented-out invocations but not a real command after a commented backslash', () => {
  assert.deepEqual(
    analyse({
      '.github/workflows/e2e.yml': [
        '      # Never run `npx playwright test` from the repository root.',
        '      - run: (cd e2e && npm test)',
      ].join('\n'),
      'scripts/run-e2e.sh': '# npx playwright test fails with describe is not defined at the root',
      'scripts/tool.mjs': '// npx playwright test',
    }),
    [],
  );

  const violations = analyse({
    'scripts/run-e2e.sh': ['# start the suite \\', 'npx playwright test'].join('\n'),
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /^scripts\/run-e2e\.sh:2 invokes Playwright/);
});

test('detects an invocation split across a shell continuation', () => {
  const violations = analyse({
    'scripts/run-e2e.sh': ['npx playwright \\', '  test --project=rtl-arabic'].join('\n'),
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /^scripts\/run-e2e\.sh:1 invokes Playwright/);
});

test('checks every invocation on a line and scopes an explicit config to its own command', () => {
  const violations = analyse({
    'scripts/two-invocations.sh': '(cd e2e && npx playwright test) && npx playwright test',
    'scripts/config-elsewhere.sh': 'npx playwright test && lint --config e2e/playwright.config.ts',
  });

  assert.equal(violations.length, 2);
  assert.match(violations[0], /^scripts\/two-invocations\.sh:1 invokes Playwright/);
  assert.match(violations[1], /^scripts\/config-elsewhere\.sh:1 invokes Playwright/);
});

test('rejects frontend unit tests importing the Playwright runner', () => {
  const violations = analyse({
    'frontend/src/app/example.spec.ts': "import { test } from '@playwright/test';",
  });

  assert.deepEqual(violations, [
    'frontend/src/app/example.spec.ts is a frontend unit test importing the Playwright runner',
  ]);
});

test('requires the e2e config to constrain test discovery', () => {
  const violations = analyse({}, { e2eConfig: 'export default defineConfig({});' });

  assert.deepEqual(violations, [
    "e2e/playwright.config.ts must constrain discovery to testDir: './tests'",
  ]);
});

test('requires Playwright ownership to stay in e2e/package.json', () => {
  const violations = analyse(
    {},
    {
      e2ePackageJson: JSON.stringify({ scripts: { test: 'vitest' }, devDependencies: {} }),
    },
  );

  assert.deepEqual(violations, [
    'e2e/package.json must own the canonical Playwright test script',
    'e2e/package.json must own the @playwright/test dependency',
  ]);
});

test('rejects brittle conditional login helpers in non-authentication e2e specs', () => {
  const violations = analyse({
    'e2e/tests/adversarial/adversarial-chat-video.spec.ts': [
      'async function loginIfNeeded(page) {',
      '  await page.fill(\'input[name="email"]\', \'qa@example.test\');',
      '}',
      'await loginIfNeeded(page);',
    ].join('\n'),
  });

  assert.deepEqual(violations, [
    'e2e/tests/adversarial/adversarial-chat-video.spec.ts defines or calls loginIfNeeded; E2E specs must not conditionally scrape the login form',
    'e2e/tests/adversarial/adversarial-chat-video.spec.ts targets the legacy input[name="email"] login selector outside an authentication spec',
  ]);
});

test('allows login form selectors in dedicated authentication specs', () => {
  assert.deepEqual(
    analyse({
      'e2e/tests/auth.spec.ts': 'await page.fill(\'input[name="email"]\', \'e2e@example.test\');',
      'e2e/tests/auth-flows.spec.ts':
        'await page.fill(\'input[name="email"]\', \'e2e@example.test\');',
    }),
    [],
  );
});

test('rejects the legacy login selector in non-authentication specs even if the helper is renamed', () => {
  const violations = analyse({
    'e2e/tests/chat-messaging.spec.ts':
      'await page.fill(\'input[name="email"]\', \'e2e@example.test\');',
  });

  assert.deepEqual(violations, [
    'e2e/tests/chat-messaging.spec.ts targets the legacy input[name="email"] login selector outside an authentication spec',
  ]);
});

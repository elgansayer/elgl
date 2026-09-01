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

test('does not borrow an e2e working directory from another workflow step', () => {
  const violations = analyse({
    '.github/workflows/e2e.yml': [
      '- name: Install e2e dependencies',
      '  run: npm ci',
      '  working-directory: e2e',
      '- name: Incorrect root discovery',
      '  run: npx playwright test',
    ].join('\n'),
  });

  assert.deepEqual(violations, [
    '.github/workflows/e2e.yml:5 invokes Playwright without the e2e working directory or explicit e2e config',
  ]);
});

test('accepts root automation that explicitly changes into e2e', () => {
  assert.deepEqual(
    analyse({
      'automation/qa-loop.sh': '(cd e2e && npx playwright test)',
    }),
    [],
  );
});

test('does not let a later directory change legitimise an earlier invocation', () => {
  assert.deepEqual(
    analyse({
      'automation/qa-loop.sh': 'npx playwright test; cd e2e',
    }),
    [
      'automation/qa-loop.sh:1 invokes Playwright without the e2e working directory or explicit e2e config',
    ],
  );
  assert.deepEqual(
    analyse({
      'automation/qa-loop.sh': 'npx vitest run tests; cd e2e',
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

test('rejects direct generic-runtime execution of Playwright specs', () => {
  for (const command of [
    'node e2e/tests/auth.spec.ts',
    'node --test "e2e/tests/auth.spec.ts"',
    'tsx ./e2e/tests/auth.spec.ts',
    'ts-node .\\e2e\\tests\\auth.spec.ts',
    'cd e2e && bun test tests/auth.spec.ts',
  ]) {
    const violations = analyse({ '.github/workflows/qa.yml': `run: ${command}` });
    assert.equal(violations.length, 1, command);
    assert.match(violations[0], /generic JavaScript\/TypeScript runtime/, command);
  }
});

test('rejects runner invocations split across shell continuations', () => {
  for (const command of ['node \\\n  e2e/tests/auth.spec.ts', 'npx playwright \\\n  test']) {
    const violations = analyse({ '.github/workflows/qa.yml': `run: |\n  ${command}` });
    assert.equal(violations.length, 1, command);
  }
});

test('rejects runner invocations split across folded workflow commands', () => {
  for (const command of ['node\n  e2e/tests/auth.spec.ts', 'npx playwright\n  test']) {
    const violations = analyse({ '.github/workflows/qa.yml': `run: >\n  ${command}` });
    assert.equal(violations.length, 1, command);
  }
});

test('rejects Playwright files or directories passed to Vitest and Jest', () => {
  for (const command of [
    'npx vitest run e2e/tests/chat-messaging.spec.ts',
    'npm exec jest -- e2e/tests',
    'cd e2e && vitest run tests',
  ]) {
    const violations = analyse({ '.agents/automations/qa.md': command });
    assert.equal(violations.length, 1, command);
    assert.match(violations[0], /Playwright suite to Vitest or Jest/, command);
  }
});

test('rejects wrong runners in non-final package scripts', () => {
  for (const command of ['node e2e/tests/auth.spec.ts', 'jest e2e/tests']) {
    const files = {
      'package.json': JSON.stringify({ scripts: { bad: command, after: 'echo complete' } }),
    };
    assert.equal(analyse(files).length, 1, command);
  }
});

test('allows the Node test runner for repository contract tests', () => {
  assert.deepEqual(
    analyse({
      '.github/workflows/contracts.yml':
        'run: node --test scripts/verify-playwright-test-boundary.test.mjs',
      'scripts/setup-and-report.sh': 'node scripts/setup.mjs && echo e2e/tests/auth.spec.ts',
    }),
    [],
  );
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
      "  await page.fill('input[name=\"email\"]', 'qa@example.test');",
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
      'e2e/tests/auth.spec.ts': "await page.fill('input[name=\"email\"]', 'e2e@example.test');",
      'e2e/tests/auth-flows.spec.ts':
        "await page.fill('input[name=\"email\"]', 'e2e@example.test');",
    }),
    [],
  );
});

test('rejects the legacy login selector in non-authentication specs even if the helper is renamed', () => {
  const violations = analyse({
    'e2e/tests/chat-messaging.spec.ts':
      "await page.fill('input[name=\"email\"]', 'e2e@example.test');",
  });

  assert.deepEqual(violations, [
    'e2e/tests/chat-messaging.spec.ts targets the legacy input[name="email"] login selector outside an authentication spec',
  ]);
});

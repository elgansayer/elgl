import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analysePlaywrightBoundary,
  shouldReadTrackedFile,
} from './verify-playwright-test-boundary.mjs';

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

test('accepts specs that use only Playwright runner APIs', () => {
  assert.deepEqual(
    analyse({
      'e2e/tests/chat-messaging.spec.ts': [
        "import { expect, test } from '@playwright/test';",
        '',
        "test.describe('chat', () => {",
        '  test.beforeEach(async ({ page }) => {',
        "    await page.goto('/chat');",
        '  });',
        '',
        "  test('sends a message', async () => {",
        '    expect(payload).toEqual({ id: expect.any(String) });',
        '  });',
        '});',
      ].join('\n'),
    }),
    [],
  );
});

test('ignores runner names that only appear in comments or string literals', () => {
  assert.deepEqual(
    analyse({
      'e2e/tests/notes.spec.ts': [
        "import { test } from '@playwright/test';",
        '// describe(...) and it(...) belong to Vitest, not Playwright',
        '/* beforeEach(() => vi.fn()) */',
        "test('mentions runner names in text', async ({ page }) => {",
        "  await page.getByText('describe(it) and jest.fn()').click();",
        '  const note = `it (the page) loads; vi.spyOn(x)`;',
        '});',
      ].join('\n'),
    }),
    [],
  );
});

test('rejects the bare describe global that aborts the whole Playwright suite', () => {
  const violations = analyse({
    'e2e/tests/adversarial/bare-describe.spec.ts': [
      "import { expect, test } from '@playwright/test';",
      '',
      "describe('bare describe', () => {",
      "  test('valid sibling', async () => {",
      '    expect(true).toBe(true);',
      '  });',
      '});',
    ].join('\n'),
  });

  assert.deepEqual(violations, [
    'e2e/tests/adversarial/bare-describe.spec.ts:3 calls describe() as a bare runner global; Playwright does not define it and fails with "ReferenceError: describe is not defined". Use test.describe() from @playwright/test',
  ]);
});

test('reports each bare runner global once per file at its first line', () => {
  const violations = analyse({
    'e2e/tests/generated.spec.ts': [
      "import { test } from '@playwright/test';",
      "describe.only('a', () => {",
      '  beforeEach(() => {});',
      "  it('first', () => {});",
      "  it.todo('second', () => {});",
      '  afterAll(() => {});',
      '});',
      "describe('b', () => {});",
    ].join('\n'),
  });

  assert.equal(violations.length, 4);
  assert.ok(violations.every((violation) => violation.startsWith('e2e/tests/generated.spec.ts:')));
  assert.match(violations[0], /:2 calls describe\(\) .* Use test\.describe\(\) /);
  assert.match(violations[1], /:3 calls beforeEach\(\) .* Use test\.beforeEach\(\) /);
  assert.match(violations[2], /:4 calls it\(\) .* Use test\(\) /);
  assert.match(violations[3], /:6 calls afterAll\(\) .* Use test\.afterAll\(\) /);
});

test('rejects Vitest and Jest namespaces that Playwright does not define', () => {
  const violations = analyse({
    'e2e/tests/runner-namespaces.spec.ts': [
      "import { test } from '@playwright/test';",
      'const handler = vi.fn();',
      "jest.spyOn(console, 'log');",
    ].join('\n'),
  });

  assert.deepEqual(violations, [
    'e2e/tests/runner-namespaces.spec.ts:2 uses the vi test-runner namespace; Playwright does not define it and fails with "ReferenceError: vi is not defined". Use page.route() to intercept network calls and plain closures to record calls',
    'e2e/tests/runner-namespaces.spec.ts:3 uses the jest test-runner namespace; Playwright does not define it and fails with "ReferenceError: jest is not defined". Use page.route() to intercept network calls and plain closures to record calls',
  ]);
});

test('rejects Vitest, Jest and node:test imports in Playwright specs', () => {
  const violations = analyse({
    'e2e/tests/vitest-copy.spec.ts': "import { describe, expect, it } from 'vitest';",
    'e2e/tests/jest-copy.test.ts': "const { it } = require('@jest/globals');",
    'e2e/tests/node-copy.spec.ts': 'import { describe } from "node:test";',
  });

  assert.deepEqual(violations, [
    'e2e/tests/vitest-copy.spec.ts:1 imports vitest; Playwright specs must import test and expect from @playwright/test only',
    'e2e/tests/jest-copy.test.ts:1 imports @jest/globals; Playwright specs must import test and expect from @playwright/test only',
    'e2e/tests/node-copy.spec.ts:1 imports node:test; Playwright specs must import test and expect from @playwright/test only',
  ]);
});

test('accepts runner names that a spec binds locally to Playwright APIs', () => {
  assert.deepEqual(
    analyse({
      'e2e/tests/aliases.spec.ts': [
        "import { test } from '@playwright/test';",
        'const { describe } = test;',
        'const it = test;',
        "describe('aliased', () => {",
        "  it('runs', async () => {});",
        '});',
      ].join('\n'),
    }),
    [],
  );
});

test('does not mistake member access for a bare runner global', () => {
  assert.deepEqual(
    analyse({
      'e2e/tests/members.spec.ts': [
        "import { test } from '@playwright/test';",
        "test.describe.serial('serial', () => {});",
        'test',
        "  .describe('chained', () => {});",
        'test.',
        "  describe('dot then newline', () => {});",
      ].join('\n'),
    }),
    [],
  );
});

test('does not treat property access on an identifier named it as a runner call', () => {
  assert.deepEqual(
    analyse({
      'e2e/tests/labels.spec.ts': [
        "import { test } from '@playwright/test';",
        "const labels = [' a '].map((it) => it.trim());",
        'const lengths = labels.map((it) => it.name.length);',
      ].join('\n'),
    }),
    [],
  );
});

test('reports accurate line numbers after multi-line comments and template literals', () => {
  const violations = analyse({
    'e2e/tests/lines.spec.ts': [
      "import { test } from '@playwright/test';",
      '/*',
      ' * describe(',
      ' */',
      'const text = `first',
      'it (second)`;',
      "describe('real', () => {});",
    ].join('\r\n'),
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /^e2e\/tests\/lines\.spec\.ts:7 calls describe\(\) /);
});

test('leaves Vitest suites and non-test files outside e2e/tests alone', () => {
  assert.deepEqual(
    analyse({
      'frontend/src/app/app.spec.ts': "describe('app', () => { it('works', () => {}); });",
      'e2e/backend-readiness.test.mjs': [
        "import { describe, it } from 'node:test';",
        "describe('readiness', () => { it('polls', () => {}); });",
      ].join('\n'),
      'e2e/tests/helpers/session.ts': "describe('a helper is not a test file', () => {});",
    }),
    [],
  );
});

test('checks every file suffix that Playwright discovers as a test', () => {
  const suffixes = [
    'spec.ts',
    'test.ts',
    'spec.js',
    'test.mjs',
    'spec.cjs',
    'spec.tsx',
    'test.mts',
    'spec.cts',
    'spec.jsx',
  ];
  const files = Object.fromEntries(
    suffixes.map((suffix) => [`e2e/tests/generated.${suffix}`, "describe('x', () => {});"]),
  );

  assert.equal(analyse(files).length, suffixes.length);
});

test('reads tracked scripts and every Playwright test-file suffix', () => {
  for (const path of [
    'e2e/tests/generated.spec.mts',
    'e2e/tests/generated.test.tsx',
    'scripts/qa.sh',
    '.github/workflows/e2e.yml',
  ]) {
    assert.equal(shouldReadTrackedFile(path), true, path);
  }

  for (const path of ['docs/playwright-test-boundary.md', 'e2e/tests/fixtures/avatar.png']) {
    assert.equal(shouldReadTrackedFile(path), false, path);
  }
});

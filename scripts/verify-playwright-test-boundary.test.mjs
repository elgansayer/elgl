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
  const violations = analyse({}, {
    e2ePackageJson: JSON.stringify({ scripts: { test: 'vitest' }, devDependencies: {} }),
  });

  assert.deepEqual(violations, [
    'e2e/package.json must own the canonical Playwright test script',
    'e2e/package.json must own the @playwright/test dependency',
  ]);
});

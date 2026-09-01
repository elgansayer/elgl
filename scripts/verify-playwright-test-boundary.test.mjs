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

test('does not accept working-directory text printed inside a workflow command', () => {
  for (const command of ['echo working-directory: e2e', '# working-directory: e2e']) {
    const violations = analyse({
      '.github/workflows/e2e.yml': [
        '- name: Spoofed working directory',
        '  run: |',
        `    ${command}`,
        '    npx playwright test',
      ].join('\n'),
    });
    assert.equal(violations.length, 1, command);
  }
});

test('accepts root automation that explicitly changes into e2e', () => {
  for (const command of [
    '(cd e2e && npx playwright test)',
    'cd e2e/ && npx playwright test',
    "cd 'e2e/' && npx playwright test",
  ]) {
    assert.deepEqual(analyse({ 'automation/qa-loop.sh': command }), [], command);
  }
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

test('does not propagate a conditional directory change past its shell chain', () => {
  for (const command of [
    'false && cd e2e; npx playwright test',
    'true || cd e2e; npx playwright test',
    'condition || cd e2e && npx playwright test',
  ]) {
    assert.deepEqual(
      analyse({ 'automation/qa-loop.sh': command }),
      [
        'automation/qa-loop.sh:1 invokes Playwright without the e2e working directory or explicit e2e config',
      ],
      command,
    );
  }
});

test('rejects Playwright launched from the frontend working directory', () => {
  const violations = analyse({
    'automation/qa-loop.sh': '(cd frontend && npx playwright test)',
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /qa-loop\.sh:1 invokes Playwright without the e2e working directory/);
});

test('rejects root Playwright discovery without an explicit e2e config', () => {
  for (const command of ['npx playwright test', 'npm exec playwright -- test']) {
    const violations = analyse({ 'automation/qa-loop.sh': command });
    assert.equal(violations.length, 1, command);
    assert.match(
      violations[0],
      /without the e2e working directory or explicit e2e config/,
      command,
    );
  }
});

test('checks Playwright context in automation Markdown', () => {
  const violations = analyse({ '.agents/automations/qa.md': 'npx playwright test' });
  assert.deepEqual(violations, [
    '.agents/automations/qa.md:1 invokes Playwright without the e2e working directory or explicit e2e config',
  ]);
});

test('accepts root Playwright discovery with the canonical e2e config', () => {
  for (const command of [
    'npx playwright test --config e2e/playwright.config.ts',
    'npx playwright test --config "e2e/playwright.config.ts"',
    "npx playwright test --config='e2e/playwright.config.ts'",
    '(npx playwright test --config e2e/playwright.config.ts)',
  ]) {
    assert.deepEqual(analyse({ 'automation/qa-loop.sh': command }), [], command);
  }
});

test('rejects config paths that only prefix-match the canonical config', () => {
  for (const command of [
    'npx playwright test --config e2e/playwright.config.ts.backup',
    'npx playwright test --config=e2e/playwright.config.tsx',
  ]) {
    assert.equal(analyse({ 'automation/qa-loop.sh': command }).length, 1, command);
  }
});

test('preserves working directory changes in literal workflow run blocks', () => {
  assert.deepEqual(
    analyse({
      '.github/workflows/e2e.yml': ['run: |', '  cd e2e', '  npx playwright test'].join('\n'),
    }),
    [],
  );
});

test('preserves shell comments in literal workflow run blocks', () => {
  const violations = analyse({
    '.github/workflows/e2e.yml': ['run: |', '  # note; cd e2e', '  npx playwright test'].join('\n'),
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /without the e2e working directory/);
});

test('preserves a leading directory change in folded workflow run blocks', () => {
  assert.deepEqual(
    analyse({
      '.github/workflows/e2e.yml': ['run: >', '  cd e2e &&', '  npx playwright test'].join('\n'),
    }),
    [],
  );
});

test('does not treat printed cd text as a working directory change', () => {
  assert.deepEqual(
    analyse({
      'automation/qa-loop.sh': 'echo cd e2e; npx playwright test',
    }),
    [
      'automation/qa-loop.sh:1 invokes Playwright without the e2e working directory or explicit e2e config',
    ],
  );
});

test('rejects direct generic-runtime execution of Playwright specs', () => {
  for (const command of [
    'node e2e/tests/auth.spec.ts',
    'node --test "e2e/tests/auth.spec.ts"',
    'tsx ./e2e/tests/auth.spec.ts',
    'ts-node .\\e2e\\tests\\auth.spec.ts',
    'cd e2e && bun test tests/auth.spec.ts',
    'cd e2e && node ./tests/auth.spec.ts',
    'bun run e2e/tests/auth.spec.ts',
    'npx -y tsx e2e/tests/auth.spec.ts',
    'npm exec --yes tsx e2e/tests/auth.spec.ts',
    'tsx --tsconfig tsconfig.json e2e/tests/auth.spec.ts',
    'npx tsx@latest e2e/tests/auth.spec.ts',
    'ts-node --cwd . e2e/tests/auth.spec.ts',
    'tsx watch e2e/tests/auth.spec.ts',
    'tsx --tsconfig tsconfig.json watch e2e/tests/auth.spec.ts',
    'bun --cwd . test e2e/tests/auth.spec.ts',
    'bun test e2e/tests',
    'cd e2e && bun test tests',
  ]) {
    const violations = analyse({ '.github/workflows/qa.yml': `run: ${command}` });
    assert.equal(violations.length, 1, command);
    assert.match(violations[0], /generic JavaScript\/TypeScript runtime/, command);
  }
});

test('checks tracked root shell scripts and preserves their working directory', () => {
  assert.equal(analyse({ 'setup-debian.sh': 'node e2e/tests/auth.spec.ts' }).length, 1);
  assert.deepEqual(analyse({ 'setup-debian.sh': 'cd e2e\nnpx playwright test' }), []);
  assert.equal(analyse({ 'setup-debian.sh': 'cd e2e\nnode tests/auth.spec.ts' }).length, 1);
});

test('rejects version-qualified Playwright root discovery', () => {
  const violations = analyse({ 'automation/qa-loop.sh': 'npx playwright@latest test' });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /without the e2e working directory/);
});

test('rejects generic-runtime execution in an inline workflow step', () => {
  const violations = analyse({
    '.github/workflows/qa.yml': '- run: node e2e/tests/auth.spec.ts',
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /generic JavaScript\/TypeScript runtime/);
});

test('allows generic runtimes to receive Playwright paths as reporter arguments', () => {
  for (const command of [
    'node scripts/report.mjs e2e/tests/auth.spec.ts',
    'tsx scripts/report.ts e2e/tests/auth.spec.ts',
  ]) {
    assert.deepEqual(analyse({ 'automation/qa-loop.sh': command }), [], command);
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
    'cd e2e && jest ./tests',
    'vitest run tests e2e/tests',
    'npx --yes vitest run e2e/tests',
  ]) {
    const violations = analyse({ '.agents/automations/qa.md': command });
    assert.equal(violations.length, 1, command);
    assert.match(violations[0], /Playwright suite to Vitest or Jest/, command);
  }
});

test('does not treat runner option values as Playwright targets', () => {
  for (const command of [
    'vitest run --exclude e2e/tests frontend/src',
    'jest --testPathIgnorePatterns e2e/tests frontend/src',
    'jest --testPathIgnorePatterns=e2e/tests frontend/src',
  ]) {
    assert.deepEqual(analyse({ '.agents/automations/qa.md': command }), [], command);
  }
});

test('treats runner selection-option values as Playwright targets', () => {
  for (const command of [
    'vitest --dir e2e/tests',
    'vitest --include e2e/tests',
    'jest --root e2e/tests',
    'jest --testPathPattern e2e/tests',
    'vitest --dir=e2e/tests',
    'jest --testPathPattern=e2e/tests',
    'jest --roots=e2e/tests',
    'jest --testPathPatterns=e2e/tests',
  ]) {
    const violations = analyse({ '.agents/automations/qa.md': command });
    assert.equal(violations.length, 1, command);
    assert.match(violations[0], /Playwright suite to Vitest or Jest/, command);
  }
});

test('does not split shell separators inside quoted arguments', () => {
  for (const command of [
    'echo "warning; node e2e/tests/auth.spec.ts"',
    "echo 'warning && npx playwright test'",
    'node scripts/report.mjs "warning | jest e2e/tests"',
    'echo warning\\; node e2e/tests/auth.spec.ts',
  ]) {
    assert.deepEqual(analyse({ 'automation/qa-loop.sh': command }), [], command);
  }
});

test('allows reporter names containing runner words', () => {
  assert.deepEqual(
    analyse({
      'automation/qa-loop.sh': 'node scripts/jest-report.mjs e2e/tests',
    }),
    [],
  );
});

test('rejects wrong runners in non-final package scripts', () => {
  for (const command of ['node e2e/tests/auth.spec.ts', 'jest e2e/tests']) {
    const files = {
      'package.json': JSON.stringify({ scripts: { bad: command, after: 'echo complete' } }),
    };
    const violations = analyse(files);
    assert.equal(violations.length, 1, command);
    assert.match(violations[0], /package\.json#scripts\.bad/, command);
  }
});

test('rejects quoted inline workflow commands', () => {
  for (const command of ['run: "npx playwright test"', "run: 'node e2e/tests/auth.spec.ts'"]) {
    assert.equal(analyse({ '.github/workflows/qa.yml': command }).length, 1, command);
  }
});

test('scans minified package scripts independently', () => {
  const files = {
    'package.json': JSON.stringify({
      scripts: {
        report: 'node scripts/report.mjs',
        mention: 'echo e2e/tests/auth.spec.ts',
      },
    }),
  };
  assert.deepEqual(analyse(files), []);
});

test('accepts a minified package script with the canonical Playwright config', () => {
  const files = {
    'package.json': JSON.stringify({
      scripts: { e2e: 'playwright test --config e2e/playwright.config.ts' },
    }),
  };
  assert.deepEqual(analyse(files), []);
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

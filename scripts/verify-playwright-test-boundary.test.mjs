import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
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

test('does not propagate a pipeline-local directory change', () => {
  const violations = analyse({
    'automation/qa-loop.sh': 'echo x | cd e2e; npx playwright test',
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /without the e2e working directory/);
});

test('rejects Playwright launched from the frontend working directory', () => {
  const violations = analyse({
    'automation/qa-loop.sh': '(cd frontend && npx playwright test)',
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0], /qa-loop\.sh:1 invokes Playwright without the e2e working directory/);
});

test('rejects root Playwright discovery without an explicit e2e config', () => {
  for (const command of [
    'npx playwright test',
    'npm exec playwright -- test',
    'npm x playwright -- test',
  ]) {
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

test('checks Playwright context in automation prompt Markdown', () => {
  const violations = analyse({ 'automation/prompts/qa.md': 'npx playwright test' });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /without the e2e working directory/);
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

test('treats hash characters inside shell words as data', () => {
  const violations = analyse({
    '.github/workflows/e2e.yml': [
      'run: |',
      '  echo https://host/#note; node e2e/tests/auth.spec.ts',
    ].join('\n'),
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /generic JavaScript\/TypeScript runtime/);
});

test('strips shell comments from every command source form', () => {
  const files = {
    'automation/qa-loop.sh': 'echo ok # note; node e2e/tests/auth.spec.ts',
    '.github/workflows/inline.yml': 'run: echo ok # note; node e2e/tests/auth.spec.ts',
    '.github/workflows/folded.yml': [
      'run: >',
      '  echo ok # note;',
      '  node e2e/tests/auth.spec.ts',
    ].join('\n'),
  };

  assert.deepEqual(analyse(files), []);
});

test('does not interpret workflow metadata as shell commands', () => {
  assert.deepEqual(
    analyse({
      '.github/workflows/e2e.yml': [
        '- name: node e2e/tests/auth.spec.ts',
        '  uses: example/node-e2e-tests@v1',
        '  with:',
        '    description: npx playwright test',
        '  run: echo safe',
      ].join('\n'),
    }),
    [],
  );
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
    'npm x tsx e2e/tests/auth.spec.ts',
    '/usr/bin/env node e2e/tests/auth.spec.ts',
    'env -i node e2e/tests/auth.spec.ts',
    'env CI=1 node e2e/tests/auth.spec.ts',
    'tsx --tsconfig tsconfig.json e2e/tests/auth.spec.ts',
    'npx tsx@latest e2e/tests/auth.spec.ts',
    'ts-node --cwd . e2e/tests/auth.spec.ts',
    "ts-node -O '{}' e2e/tests/auth.spec.ts",
    'tsx watch e2e/tests/auth.spec.ts',
    'tsx --tsconfig tsconfig.json watch e2e/tests/auth.spec.ts',
    'bun --cwd . test e2e/tests/auth.spec.ts',
    'bun test e2e/tests',
    'cd e2e && bun test tests',
    'cd e2e/tests && node auth.spec.ts',
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

const verifier = resolve(import.meta.dirname, 'verify-playwright-test-boundary.mjs');
const bareDescribeSpec = [
  "import { expect, test } from '@playwright/test';",
  '',
  "describe('written by a QA run', () => {",
  "  test('valid sibling', async () => {",
  '    expect(true).toBe(true);',
  '  });',
  '});',
].join('\n');
const playwrightSpec = [
  "import { expect, test } from '@playwright/test';",
  '',
  "test.describe('written by a QA run', () => {",
  "  test('runs', async () => {",
  '    expect(true).toBe(true);',
  '  });',
  '});',
].join('\n');

// A real repository, because the point of these tests is which files Git lists, not how they are
// analysed. GIT_* variables are dropped so a run inside a git hook cannot reach the outer repo.
function workingTreeFixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'playwright-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );

  function git(...args) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: environment });
    assert.equal(result.status, 0, result.stderr);
  }
  function write(path, content) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), content);
  }

  git('init', '-q');
  mkdirSync(resolve(root, 'scripts'));
  copyFileSync(verifier, resolve(root, 'scripts/verify-playwright-test-boundary.mjs'));
  write('e2e/package.json', validPackage);
  write('e2e/playwright.config.ts', validConfig);
  write('e2e/tests/tracked.spec.ts', playwrightSpec);
  git('add', '.');

  function run() {
    return spawnSync(process.execPath, ['scripts/verify-playwright-test-boundary.mjs'], {
      cwd: root,
      encoding: 'utf8',
      env: environment,
    });
  }
  return { git, run, write, root };
}

test('rejects a bare describe in a spec that is not tracked yet', (t) => {
  const { run, write } = workingTreeFixture(t);
  write('e2e/tests/untracked-bare-describe.spec.ts', bareDescribeSpec);

  const result = run();

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Playwright test-boundary verification failed/);
  assert.match(
    result.stderr,
    /- e2e\/tests\/untracked-bare-describe\.spec\.ts:3 calls describe\(\) as a bare runner global; .*Use test\.describe\(\) from @playwright\/test/,
  );
});

test('accepts untracked specs that use only the Playwright runner API', (t) => {
  const { run, write } = workingTreeFixture(t);
  write('e2e/tests/untracked.spec.ts', playwrightSpec);

  const result = run();

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Playwright test boundary verified/);
});

test('checks untracked automation commands as well as untracked specs', (t) => {
  const { run, write } = workingTreeFixture(t);
  write('scripts/qa-run.sh', 'npx playwright test\n');

  const result = run();

  assert.equal(result.status, 1, result.stdout);
  assert.match(
    result.stderr,
    /scripts\/qa-run\.sh:1 invokes Playwright without the e2e working directory or explicit e2e config/,
  );
});

test('skips a tracked spec that was deleted from disk instead of crashing', (t) => {
  const { git, run, write, root } = workingTreeFixture(t);
  write('e2e/tests/broken.spec.ts', bareDescribeSpec);
  git('add', '.');
  rmSync(resolve(root, 'e2e/tests/broken.spec.ts'));

  const result = run();

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /ENOENT/);
  assert.match(result.stdout, /Playwright test boundary verified/);
});

test('does not scan dependency trees that Git ignores', (t) => {
  const { run, write } = workingTreeFixture(t);
  write('.gitignore', 'node_modules/\n');
  write(
    'node_modules/some-package/package.json',
    JSON.stringify({ scripts: { test: 'playwright test' } }),
  );

  const result = run();

  assert.equal(result.status, 0, result.stderr);
});

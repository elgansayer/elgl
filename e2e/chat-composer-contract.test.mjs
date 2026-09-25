import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const e2eRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(e2eRoot, '..');
const specsRoot = join(e2eRoot, 'tests');
const chatTemplatePath = join(
  repoRoot,
  'frontend/src/app/components/chat-room/chat-room.component.html',
);
const autocompletePath = join(
  repoRoot,
  'frontend/src/app/components/ui/autocomplete/src/lib/hlm-autocomplete-input.ts',
);
const canonicalTestId = 'chat-message-input';
const deprecatedTestId = 'message-input';
// Specs and the helpers, fixtures and page objects they import all run in the same browser session.
const e2eSourcePattern = /\.[cm]?[jt]sx?$/;

async function collectE2eSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectE2eSources(path)));
    } else if (entry.isFile() && e2eSourcePattern.test(entry.name)) {
      files.push(path);
    }
  }

  return files.sort();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches [data-testid="x"], [data-testid=x], [ data-testid = 'x' i ] and the data-testid=x
// selector engine that Playwright supports natively.
function testIdAttributePattern(testId) {
  const value = escapeRegExp(testId);
  return new RegExp(`data-testid\\s*=\\s*(?:"${value}"|'${value}'|${value}(?![\\w-]))`);
}

// Matches getByTestId() with a quoted or template-literal id and an optional trailing comma.
function getByTestIdPattern(testId) {
  const value = escapeRegExp(testId);
  return new RegExp(`getByTestId\\(\\s*(?:"${value}"|'${value}'|\`${value}\`)\\s*,?\\s*\\)`);
}

function usesTestId(source, testId) {
  return [testIdAttributePattern(testId), getByTestIdPattern(testId)].some((pattern) =>
    pattern.test(source),
  );
}

// Every way an older QA spec addressed the composer. None of them resolve in the current UI, so
// Playwright waits out the full test timeout instead of failing on the missing element.
const staleComposerLocators = [
  {
    description: `data-testid="${deprecatedTestId}" selector`,
    pattern: testIdAttributePattern(deprecatedTestId),
  },
  {
    description: `getByTestId('${deprecatedTestId}')`,
    pattern: getByTestIdPattern(deprecatedTestId),
  },
  {
    description: `.${deprecatedTestId} class selector`,
    pattern: new RegExp(`\\.${escapeRegExp(deprecatedTestId)}(?![\\w-])`),
  },
  {
    description: `#${deprecatedTestId} id selector`,
    pattern: new RegExp(`#${escapeRegExp(deprecatedTestId)}(?![\\w-])`),
  },
];

function findStaleComposerLocators(source) {
  return staleComposerLocators
    .flatMap(({ description, pattern }) =>
      [...source.matchAll(new RegExp(pattern.source, 'g'))].map((match) => ({
        description,
        line: source.slice(0, match.index).split('\n').length,
      })),
    )
    .sort((left, right) => left.line - right.line);
}

test('source discovery covers every Playwright suffix and shared helper module', () => {
  for (const file of [
    'chat.spec.ts',
    'chat.test.ts',
    'chat.spec.js',
    'chat.test.mjs',
    'chat.spec.cjs',
    'chat.test.tsx',
    'composer.ts',
    'fixtures.mts',
    'page-object.cjs',
  ]) {
    assert.match(file, e2eSourcePattern);
  }

  for (const file of ['chat.ts.map', 'chat.spec.md', 'chat.json', 'chat.png']) {
    assert.doesNotMatch(file, e2eSourcePattern);
  }
});

test('stale locator matching recognises every selector form and ignores current ones', () => {
  const staleExamples = [
    `page.locator('[data-testid="${deprecatedTestId}"]')`,
    `page.locator("[data-testid='${deprecatedTestId}']")`,
    `page.locator('[data-testid=${deprecatedTestId}]')`,
    `page.locator('[ data-testid = "${deprecatedTestId}" i ]')`,
    `page.locator('data-testid=${deprecatedTestId}')`,
    `page.getByTestId('${deprecatedTestId}')`,
    `page.getByTestId("${deprecatedTestId}")`,
    `page.getByTestId(\`${deprecatedTestId}\`)`,
    `page.getByTestId(\n  '${deprecatedTestId}',\n)`,
    `page.locator('.${deprecatedTestId}')`,
    `page.locator('input.${deprecatedTestId}')`,
    `page.fill('.${deprecatedTestId}', 'text')`,
    `page.waitForSelector('#${deprecatedTestId}')`,
  ];
  const currentExamples = [
    `page.locator('[data-testid="${canonicalTestId}"]')`,
    `page.locator('[data-testid=${canonicalTestId}]')`,
    `page.getByTestId('${canonicalTestId}')`,
    `page.locator('.${canonicalTestId}')`,
    `page.locator('#${canonicalTestId}')`,
    `page.locator('[data-testid="${deprecatedTestId}-hint"]')`,
    `page.locator('[data-testid=${deprecatedTestId}-hint]')`,
    `page.getByTestId('${deprecatedTestId}-hint')`,
    `page.locator('.${deprecatedTestId}-hint')`,
    `page.locator('#${deprecatedTestId}-hint')`,
    `import { composer } from './${deprecatedTestId}';`,
  ];

  for (const example of staleExamples) {
    assert.notDeepEqual(
      findStaleComposerLocators(example),
      [],
      `expected a stale composer locator in: ${example}`,
    );
  }
  for (const example of currentExamples) {
    assert.deepEqual(
      findStaleComposerLocators(example),
      [],
      `unexpected stale composer locator in: ${example}`,
    );
  }
});

test('canonical locator matching recognises Playwright selector forms', () => {
  for (const example of [
    `page.locator('[data-testid="${canonicalTestId}"]')`,
    `page.locator('[data-testid=${canonicalTestId}]')`,
    `page.getByTestId('${canonicalTestId}')`,
  ]) {
    assert.equal(usesTestId(example, canonicalTestId), true, example);
  }

  assert.equal(usesTestId(`page.getByTestId('${deprecatedTestId}')`, canonicalTestId), false);
});

test('stale locator findings report the offending line', () => {
  const source = [
    "test('sends a message', async ({ page }) => {",
    `  await page.locator('.${deprecatedTestId}').fill('hello');`,
    `  await page.getByTestId('${deprecatedTestId}').press('Enter');`,
    '});',
  ].join('\n');

  assert.deepEqual(
    findStaleComposerLocators(source).map(({ line }) => line),
    [2, 3],
  );
});

test('chat composer exposes the canonical Playwright locator on a native input', async () => {
  const [template, autocomplete] = await Promise.all([
    readFile(chatTemplatePath, 'utf8'),
    readFile(autocompletePath, 'utf8'),
  ]);

  assert.match(
    template,
    /<hlm-autocomplete-input[\s\S]*?testId="chat-message-input"[\s\S]*?\/>/,
    'ChatRoomComponent must expose testId="chat-message-input" on its composer.',
  );
  assert.match(
    autocomplete,
    /<input[\s\S]*?\[attr\.data-testid\]="testId\(\)"[\s\S]*?\/>/,
    'HlmAutocompleteInput must forward testId to the native input so Playwright fill() is actionable.',
  );
});

test('Playwright specs and helpers never target the removed message-input locators', async () => {
  const sources = await collectE2eSources(specsRoot);
  assert.notEqual(sources.length, 0, 'expected Playwright sources under e2e/tests');

  const offenders = [];
  for (const file of sources) {
    const source = await readFile(file, 'utf8');
    for (const { description, line } of findStaleComposerLocators(source)) {
      offenders.push(`${relative(repoRoot, file)}:${line} uses ${description}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `The removed "${deprecatedTestId}" composer locators make Playwright wait until fill() times out. Use [data-testid="${canonicalTestId}"] instead.`,
  );
});

test('the canonical chat messaging suite exercises the current composer locator', async () => {
  const chatMessagingSpec = join(specsRoot, 'chat-messaging.spec.ts');
  const source = await readFile(chatMessagingSpec, 'utf8');

  assert.equal(
    usesTestId(source, canonicalTestId),
    true,
    `chat-messaging.spec.ts must target data-testid="${canonicalTestId}".`,
  );
});

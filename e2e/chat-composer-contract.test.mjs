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
const playwrightTestFilePattern = /\.(?:spec|test)\.(?:[cm]?[jt]sx?)$/;

async function collectPlaywrightSpecs(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectPlaywrightSpecs(path)));
    } else if (entry.isFile() && playwrightTestFilePattern.test(entry.name)) {
      files.push(path);
    }
  }

  return files.sort();
}

function usesTestId(source, testId) {
  const escaped = testId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`data-testid=["']${escaped}["']`),
    new RegExp(`getByTestId\\(\\s*["']${escaped}["']\\s*\\)`),
  ].some((pattern) => pattern.test(source));
}

test('spec discovery follows Playwright test-file suffixes', () => {
  for (const file of [
    'chat.spec.ts',
    'chat.test.ts',
    'chat.spec.js',
    'chat.test.mjs',
    'chat.spec.cjs',
    'chat.test.tsx',
  ]) {
    assert.match(file, playwrightTestFilePattern);
  }

  for (const file of ['chat.ts', 'chat.test.mjs.map', 'chat.spec.md']) {
    assert.doesNotMatch(file, playwrightTestFilePattern);
  }
});

test('stale locator matching recognises Playwright selector forms', () => {
  assert.equal(
    usesTestId(
      `page.locator('[data-testid="${deprecatedTestId}"]')`,
      deprecatedTestId,
    ),
    true,
  );
  assert.equal(
    usesTestId(`page.getByTestId('${deprecatedTestId}')`, deprecatedTestId),
    true,
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

test('Playwright specs never use the removed message-input test id', async () => {
  const specs = await collectPlaywrightSpecs(specsRoot);
  const offenders = [];

  for (const spec of specs) {
    const source = await readFile(spec, 'utf8');
    if (usesTestId(source, deprecatedTestId)) {
      offenders.push(relative(repoRoot, spec));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Deprecated data-testid="${deprecatedTestId}" causes Playwright to wait until fill() times out. Use "${canonicalTestId}" instead.`,
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

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  SEARCH_REFERENCE_FILES,
  SEARCH_REFERENCE_ALIAS_GROUPS,
  REQUIRED_DOC_HEADINGS,
  validateDocument,
  validateInventory,
  validateSearchReferenceAnalysis,
} from './check-search-reference-analysis.mjs';

function buildValidDocument() {
  const inventoryRows = [
    '| Canonical capture | Exact alias | Reference area |',
    '| --- | --- | --- |',
    '| `Screenshot_20260722_012546.png` | none | Chat search shell |',
    '| `Screenshot_20260722_012551.png` | none | Chat search results |',
    '| `Screenshot_20260722_012559.png` | `Screenshot_20260722_012559-1.png` | Chat search suggestions |',
    '| `Screenshot_20260722_012610.png` | `Screenshot_20260722_012610-1.png` | Find partners initial |',
    '| `Screenshot_20260722_012615.png` | `Screenshot_20260722_012615-1.png` | Find partners language filter |',
    '| `Screenshot_20260722_012624.png` | none | Find partners results |',
    '| `Screenshot_20260722_012629.png` | none | Find partners card details |',
    '| `Screenshot_20260722_012635.png` | `Screenshot_20260722_012635-1.png` | Find partners card badges |',
    '| `Screenshot_20260722_012646.png` | none | Find partners filter interaction |',
    '| `Screenshot_20260722_012657.png` | `Screenshot_20260722_012657-1.png` | Nearby map search |',
    '| `Screenshot_20260722_012705.png` | none | Nearby map search list drawer |',
    '| `Screenshot_20260722_012715.png` | `Screenshot_20260722_012715-1.png` | Find partners filter drawer |',
    '| `Screenshot_20260722_012729.png` | none | Custom search view |',
  ];

  return `
# Search Reference Screenshot Analysis

${REQUIRED_DOC_HEADINGS.join('\n\n')}

${inventoryRows.join('\n')}
`;
}

function buildValidHashes() {
  const hashes = new Map();
  let counter = 1;
  const canonicalToHash = new Map();

  for (const group of SEARCH_REFERENCE_ALIAS_GROUPS) {
    const h = `hash_${counter++}`;
    for (const file of group) {
      canonicalToHash.set(file, h);
    }
  }

  for (const file of SEARCH_REFERENCE_FILES) {
    if (!canonicalToHash.has(file)) {
      canonicalToHash.set(file, `hash_${counter++}`);
    }
    hashes.set(file, canonicalToHash.get(file));
  }

  return hashes;
}

test('accepts the documented search reference inventory and alias groups', () => {
  const hashes = buildValidHashes();
  const document = buildValidDocument();

  assert.deepEqual(validateInventory(SEARCH_REFERENCE_FILES, hashes), []);
  assert.deepEqual(validateDocument(document), []);
});

test('fails when a referenced screenshot is missing from disk', () => {
  const hashes = buildValidHashes();
  const subset = SEARCH_REFERENCE_FILES.filter((file) => file !== 'Screenshot_20260722_012546.png');
  const errors = validateInventory(subset, hashes);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /Screenshot_20260722_012546\.png/);
});

test('fails when an alias group is not byte-identical', () => {
  const hashes = buildValidHashes();
  hashes.set('Screenshot_20260722_012559-1.png', 'mismatched_hash');
  const errors = validateInventory(SEARCH_REFERENCE_FILES, hashes);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /expected byte-identical alias group to match/);
});

test('fails when a required heading is missing from the document', () => {
  const document = buildValidDocument().replace('## Privacy, security and abuse resistance', '');
  const errors = validateDocument(document);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /Privacy, security and abuse resistance/);
});

test('fails when a referenced screenshot is missing from the document', () => {
  const document = buildValidDocument().replaceAll('`Screenshot_20260722_012729.png`', '');
  const errors = validateDocument(document);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /Screenshot_20260722_012729\.png/);
});

test('fails when duplicate aliases do not share an inventory row', () => {
  const document = buildValidDocument().replace(
    '| `Screenshot_20260722_012559.png` | `Screenshot_20260722_012559-1.png` | Chat search suggestions |',
    '| `Screenshot_20260722_012559.png` | none | Chat search suggestions |\n| `Screenshot_20260722_012559-1.png` | none | Chat search suggestions |',
  );
  const errors = validateDocument(document);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /duplicate aliases must share one inventory row/);
});

test('fails when document contains a banned em dash', () => {
  const document = buildValidDocument() + '\nInvalid em dash: \u2014 here.';
  const errors = validateDocument(document);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /em dash/);
});

test('validateSearchReferenceAnalysis verifies a complete isolated fixture', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'search-reference-'));
  const screenshotDir = join(root, 'original-hello-talk-screenshots');
  const docsDir = join(root, 'docs');
  await mkdir(screenshotDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });

  const aliasMap = new Map();
  for (const group of SEARCH_REFERENCE_ALIAS_GROUPS) {
    const canonical = group[0];
    for (const alias of group.slice(1)) {
      aliasMap.set(alias, canonical);
    }
  }

  for (const file of SEARCH_REFERENCE_FILES) {
    const content = aliasMap.has(file)
      ? `content-for-${aliasMap.get(file)}`
      : `content-for-${file}`;
    await writeFile(join(screenshotDir, file), content);
  }

  await writeFile(join(docsDir, 'search-screenshot-analysis.md'), buildValidDocument());
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await validateSearchReferenceAnalysis({ repoRoot: root });
  assert.deepEqual(result, {
    referencedScreenshotCount: 19,
    uniqueCaptureCount: 13,
    duplicateGroupCount: 6,
  });
});

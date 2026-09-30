import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { validateMomentsReferenceAnalysis } from './check-moments-reference-analysis.mjs';

async function fixture({ files, document }) {
  const root = await mkdtemp(join(tmpdir(), 'moments-reference-'));
  await mkdir(join(root, 'original-hello-talk-screenshots'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(root, 'original-hello-talk-screenshots', name), content);
  }
  await writeFile(join(root, 'docs', 'moments-feed-reference-analysis.md'), document);
  return root;
}

const first = 'Screenshot_20260722_012546.png';
const duplicate = 'Screenshot_20260722_012546-1.png';
const second = 'Screenshot_20260722_012551.png';

test('accepts a complete inventory and reports exact duplicate groups', async (t) => {
  const root = await fixture({
    files: { [first]: 'same', [duplicate]: 'same', [second]: 'different' },
    document: `| Capture | Alias |\n| --- | --- |\n| \`${first}\` | \`${duplicate}\` |\n| \`${second}\` | none |\n`,
  });
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = await validateMomentsReferenceAnalysis({ repoRoot: root });

  assert.deepEqual(result, {
    screenshotCount: 3,
    uniqueCaptureCount: 2,
    duplicateGroupCount: 1,
  });
});

test('fails when a corpus screenshot is not documented', async (t) => {
  const root = await fixture({
    files: { [first]: 'one', [second]: 'two' },
    document: `| \`${first}\` |\n`,
  });
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    validateMomentsReferenceAnalysis({ repoRoot: root }),
    new RegExp(`undocumented screenshots: ${second.replaceAll('.', '\\.')}`),
  );
});

test('fails when analysis references a removed screenshot', async (t) => {
  const root = await fixture({
    files: { [first]: 'one' },
    document: `| \`${first}\` | \`${second}\` |\n`,
  });
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    validateMomentsReferenceAnalysis({ repoRoot: root }),
    /stale screenshot references/,
  );
});

test('fails when byte-identical aliases are documented as separate captures', async (t) => {
  const root = await fixture({
    files: { [first]: 'same', [duplicate]: 'same' },
    document: `| \`${first}\` | none |\n| \`${duplicate}\` | none |\n`,
  });
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    validateMomentsReferenceAnalysis({ repoRoot: root }),
    /duplicate aliases must share one inventory row/,
  );
});

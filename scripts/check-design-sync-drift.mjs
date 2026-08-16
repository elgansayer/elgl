#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'design-sync.manifest.json'), 'utf8'));
const base = process.env.DESIGN_SYNC_BASE_SHA;

if (!base) {
  console.log('Design sync drift check skipped: DESIGN_SYNC_BASE_SHA is not set.');
  process.exit(0);
}

let changed;
try {
  changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd: root,
    encoding: 'utf8'
  })
    .split('\n')
    .map((path) => path.trim())
    .filter(Boolean);
} catch (error) {
  console.error(`Unable to calculate design-sync diff from ${base}.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const changedSet = new Set(changed);
const isWithin = (file, mappedPath) => file === mappedPath || file.startsWith(`${mappedPath}/`);
const touchedItems = manifest.items.filter((item) =>
  changed.some((file) => item.repositoryPaths.some((mappedPath) => isWithin(file, mappedPath)))
);

if (touchedItems.length === 0) {
  console.log('Design sync drift check: no mapped visual-contract paths changed.');
  process.exit(0);
}

const manifestChanged = changedSet.has('design-sync.manifest.json');
const failures = [];

for (const item of touchedItems) {
  const previewChanged = item.previewPaths.some((previewPath) =>
    changed.some((file) => isWithin(file, previewPath))
  );

  if (!previewChanged && !manifestChanged) {
    failures.push(
      `${item.id}: mapped implementation changed without a mapped preview or design-sync.manifest.json update`
    );
  }
}

if (failures.length > 0) {
  console.error('Design sync drift verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nUpdate the mapped repository preview/manifest, or split a genuinely non-visual change so its design-sync status can be reviewed explicitly.');
  process.exit(1);
}

console.log(`Design sync drift verified for ${touchedItems.length} mapped artefact(s).`);

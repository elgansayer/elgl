#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'design-sync.manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const base = process.env.DESIGN_SYNC_BASE_SHA;

if (!base) {
  console.log('Design sync drift check skipped: DESIGN_SYNC_BASE_SHA is not set.');
  process.exit(0);
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

let changed;
let baseManifest;
try {
  changed = git('diff', '--name-only', `${base}...HEAD`)
    .split('\n')
    .map((path) => path.trim())
    .filter(Boolean);

  try {
    baseManifest = JSON.parse(git('show', `${base}:design-sync.manifest.json`));
  } catch {
    baseManifest = { items: [] };
  }
} catch (error) {
  console.error(`Unable to calculate design-sync diff from ${base}.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const changedSet = new Set(changed);
const isWithin = (file, mappedPath) => file === mappedPath || file.startsWith(`${mappedPath}/`);
const touchedItems = manifest.items.filter((item) =>
  changed.some((file) => item.repositoryPaths.some((mappedPath) => isWithin(file, mappedPath))),
);

if (touchedItems.length === 0) {
  console.log('Design sync drift check: no mapped visual-contract paths changed.');
  process.exit(0);
}

const baseItems = new Map((baseManifest.items ?? []).map((item) => [item.id, item]));
const manifestChanged = changedSet.has('design-sync.manifest.json');
const failures = [];

for (const item of touchedItems) {
  const previewChanged = item.previewPaths.some((previewPath) =>
    changed.some((file) => isWithin(file, previewPath)),
  );
  const previousItem = baseItems.get(item.id);
  const itemMetadataChanged =
    manifestChanged && JSON.stringify(previousItem ?? null) !== JSON.stringify(item);

  if (!previewChanged && !itemMetadataChanged) {
    failures.push(
      `${item.id}: mapped implementation changed without its mapped preview or its own manifest metadata changing`,
    );
  }
}

if (failures.length > 0) {
  console.error('Design sync drift verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(
    '\nUpdate the affected preview or the affected manifest item. Editing an unrelated manifest item no longer satisfies this gate.',
  );
  process.exit(1);
}

console.log(`Design sync drift verified for ${touchedItems.length} mapped artefact(s).`);

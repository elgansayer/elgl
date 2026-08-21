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
const looksLikeFile = (mappedPath) => /\.[^/]+$/.test(mappedPath);

function isVisualContractSource(file) {
  return (
    /\.(?:html|css|scss|sass|less)$/.test(file) ||
    /\.component\.ts$/.test(file) ||
    file.includes('/components/ui/') ||
    file.includes('/components/primitives/')
  );
}

// Broad screen mappings intentionally provide a fallback ownership boundary, but they must not turn
// non-visual application code (services, stores, guards, data helpers, etc.) into design-sync work.
// Explicit file mappings remain authoritative regardless of extension, so theme.service.ts and other
// deliberately mapped non-template files still participate in drift verification.
function mappingOwnsFile(file, mappedPath) {
  if (!isWithin(file, mappedPath)) return false;
  return looksLikeFile(mappedPath) || isVisualContractSource(file);
}

// A file can sit below several aggregate design mappings (for example app -> components -> primitive family).
// Only the most-specific matching repository path owns that file for drift purposes. This preserves broad
// fallback mappings without forcing unrelated previews to change whenever a narrower artefact is edited.
const touchedIds = new Set();
for (const file of changed) {
  const matches = [];
  for (const item of manifest.items) {
    for (const mappedPath of item.repositoryPaths) {
      if (mappingOwnsFile(file, mappedPath)) matches.push({ item, mappedPath });
    }
  }
  if (matches.length === 0) continue;
  const maxSpecificity = Math.max(...matches.map(({ mappedPath }) => mappedPath.length));
  for (const { item, mappedPath } of matches) {
    if (mappedPath.length === maxSpecificity) touchedIds.add(item.id);
  }
}
const touchedItems = manifest.items.filter((item) => touchedIds.has(item.id));

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

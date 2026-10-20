#!/usr/bin/env node
// Design coverage gate: every runtime UI surface must be specifically mapped to a design-sync item,
// every preview file must be mapped, and feature-catalogue previews must contain exactly one
// specimen per mapped surface. Adding a component without a design specimen fails CI.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  appPrefix,
  discoverSurfaces,
  loadManifest,
  previewFiles,
  root,
  specificMappings,
  specimenPaths,
} from './lib.mjs';

const manifest = loadManifest(process.env.DESIGN_SYNC_MANIFEST_PATH);
const failures = [];
const surfaces = discoverSurfaces();

const unmapped = surfaces.filter((surface) => specificMappings(manifest, surface).length === 0);
for (const surface of unmapped) {
  failures.push(
    `unmapped runtime surface: ${appPrefix}${surface} (add it to a design-sync item and its preview)`,
  );
}

const mappedPreviews = new Set(manifest.items.flatMap((item) => item.previewPaths));
for (const preview of previewFiles()) {
  if (!mappedPreviews.has(preview))
    failures.push(`preview not mapped by any design-sync item: ${preview}`);
  const html = readFileSync(resolve(root, preview), 'utf8');
  if (!html.startsWith('<!-- @dsCard'))
    failures.push(`${preview}: first line must be an @dsCard marker`);
}

for (const item of manifest.items) {
  for (const preview of item.previewPaths) {
    if (!existsSync(resolve(root, preview))) continue;
    const specimens = specimenPaths(readFileSync(resolve(root, preview), 'utf8'));
    if (specimens.length === 0) continue; // legacy screen previews are not specimen catalogues
    const expected = item.repositoryPaths
      .filter((path) => path.startsWith(appPrefix))
      .map((path) => path.slice(appPrefix.length));
    const seen = new Map();
    for (const specimen of specimens) seen.set(specimen, (seen.get(specimen) ?? 0) + 1);
    for (const path of expected) {
      if (!seen.has(path)) failures.push(`${item.id}: ${preview} has no specimen for ${path}`);
    }
    for (const [specimen, count] of seen) {
      if (!expected.includes(specimen))
        failures.push(`${item.id}: specimen ${specimen} is not in repositoryPaths`);
      if (count > 1) failures.push(`${item.id}: specimen ${specimen} appears ${count} times`);
    }
  }
}

const mapped = surfaces.length - unmapped.length;
const percent = surfaces.length === 0 ? 100 : ((mapped / surfaces.length) * 100).toFixed(1);
console.log(
  `Design coverage: ${mapped}/${surfaces.length} runtime surfaces specifically mapped (${percent}%).`,
);

if (failures.length > 0) {
  console.error('Design coverage verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Design coverage verified: every surface and preview is mapped.');

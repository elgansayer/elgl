#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const matrix = JSON.parse(readFileSync(resolve(root, 'visual-contract.matrix.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(root, 'design-sync.manifest.json'), 'utf8'));
const failures = [];

if (matrix.schemaVersion !== 1) failures.push('visual matrix schemaVersion must be 1');
if (!Array.isArray(matrix.contracts) || matrix.contracts.length === 0) failures.push('visual matrix contracts must be non-empty');

const manifestById = new Map(manifest.items.map((item) => [item.id, item]));
const ids = new Set();

for (const contract of matrix.contracts ?? []) {
  if (!contract.designSyncId) {
    failures.push('visual contract is missing designSyncId');
    continue;
  }
  if (ids.has(contract.designSyncId)) failures.push(`duplicate visual contract: ${contract.designSyncId}`);
  ids.add(contract.designSyncId);

  const item = manifestById.get(contract.designSyncId);
  if (!item) {
    failures.push(`${contract.designSyncId}: no matching design-sync manifest item`);
    continue;
  }

  if (!item.previewPaths.includes(contract.previewPath)) {
    failures.push(`${contract.designSyncId}: previewPath is not mapped by design-sync manifest: ${contract.previewPath}`);
  }
  if (!existsSync(resolve(root, contract.previewPath))) {
    failures.push(`${contract.designSyncId}: preview file does not exist: ${contract.previewPath}`);
  }

  if (!Array.isArray(contract.states) || contract.states.length === 0) {
    failures.push(`${contract.designSyncId}: states must be non-empty`);
    continue;
  }

  for (const state of item.requiredStates) {
    if (!contract.states.includes(state)) {
      failures.push(`${contract.designSyncId}: visual matrix is missing required design-sync state: ${state}`);
    }
  }
}

const requiredRepresentatives = [
  'relay.primitives.buttons',
  'relay.primitives.card-inputs',
  'spartan.overlays-menus',
  'screen.discovery',
  'screen.chat',
  'screen.vocabulary',
  'screen.moderation',
];
for (const id of requiredRepresentatives) {
  if (!ids.has(id)) failures.push(`required representative visual contract is missing: ${id}`);
}

if (failures.length > 0) {
  console.error('Visual contract matrix verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Visual contract matrix verified: ${matrix.contracts.length} design-sync-linked representatives.`);

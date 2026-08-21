#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'design-sync.manifest.json'), 'utf8'));
const pending = manifest.items.filter((item) => item.lastReconciledCommit === null);

const payload = {
  project: manifest.project,
  policy: manifest.policy,
  total: manifest.items.length,
  reconciled: manifest.items.length - pending.length,
  pending: pending.length,
  completionPercent: Number((((manifest.items.length - pending.length) / manifest.items.length) * 100).toFixed(1)),
  items: pending.map((item) => ({
    id: item.id,
    kind: item.kind,
    ownerLayer: item.ownerLayer,
    repositoryPaths: item.repositoryPaths,
    previewPaths: item.previewPaths,
    claudeDesignPath: item.claudeDesignPath,
    syncDirection: item.syncDirection,
    requiredStates: item.requiredStates,
  })),
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

console.log('# Claude Design reconciliation queue');
console.log('');
console.log(`Project: ${payload.project.name} (${payload.project.projectId})`);
console.log(`Completion: ${payload.reconciled}/${payload.total} (${payload.completionPercent}%)`);
console.log('');
if (pending.length === 0) {
  console.log('No pending reconciliation items.');
  process.exit(0);
}
for (const item of payload.items) {
  console.log(`## ${item.id}`);
  console.log(`- Claude Design path: ${item.claudeDesignPath}`);
  console.log(`- Repository: ${item.repositoryPaths.join(', ')}`);
  console.log(`- Preview: ${item.previewPaths.join(', ')}`);
  console.log(`- Required states: ${item.requiredStates.join(', ')}`);
  console.log('');
}

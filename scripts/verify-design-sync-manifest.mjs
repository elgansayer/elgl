#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'design-sync.manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const failures = [];
const allowedKinds = new Set(['foundation', 'primitive', 'helm', 'screen', 'modal', 'flow']);
const allowedOwners = new Set(['relay', 'spartan-helm', 'spartan-brain', 'feature']);
const allowedDirections = new Set(['code-first', 'design-first', 'reconcile']);

if (manifest.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (!manifest.project?.name) failures.push('project.name is required');
if (!manifest.project?.projectId) failures.push('project.projectId is required');
if (!manifest.policy || !existsSync(resolve(root, manifest.policy))) {
  failures.push(`policy path does not exist: ${manifest.policy ?? '<missing>'}`);
}
if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
  failures.push('items must be a non-empty array');
}

const ids = new Set();
const designPaths = new Set();

for (const [index, item] of (manifest.items ?? []).entries()) {
  const label = item.id || `items[${index}]`;

  if (!item.id) {
    failures.push(`items[${index}].id is required`);
  } else if (ids.has(item.id)) {
    failures.push(`duplicate id: ${item.id}`);
  } else {
    ids.add(item.id);
  }

  if (!allowedKinds.has(item.kind)) failures.push(`${label}: invalid kind ${item.kind}`);
  if (!allowedOwners.has(item.ownerLayer)) failures.push(`${label}: invalid ownerLayer ${item.ownerLayer}`);
  if (!allowedDirections.has(item.syncDirection)) failures.push(`${label}: invalid syncDirection ${item.syncDirection}`);

  if (!Array.isArray(item.repositoryPaths) || item.repositoryPaths.length === 0) {
    failures.push(`${label}: repositoryPaths must be non-empty`);
  } else {
    for (const path of item.repositoryPaths) {
      if (!existsSync(resolve(root, path))) failures.push(`${label}: repository path does not exist: ${path}`);
    }
  }

  if (!Array.isArray(item.previewPaths) || item.previewPaths.length === 0) {
    failures.push(`${label}: previewPaths must be non-empty`);
  } else {
    for (const path of item.previewPaths) {
      if (!existsSync(resolve(root, path))) failures.push(`${label}: preview path does not exist: ${path}`);
    }
  }

  if (!item.claudeDesignPath) {
    failures.push(`${label}: claudeDesignPath is required`);
  } else if (designPaths.has(item.claudeDesignPath)) {
    failures.push(`${label}: duplicate claudeDesignPath ${item.claudeDesignPath}`);
  } else {
    designPaths.add(item.claudeDesignPath);
  }

  if (!Array.isArray(item.requiredStates) || item.requiredStates.length === 0) {
    failures.push(`${label}: requiredStates must be non-empty`);
  }
}

if (failures.length > 0) {
  console.error('Design sync manifest verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Design sync manifest verified: ${manifest.items.length} mapped artefacts.`);

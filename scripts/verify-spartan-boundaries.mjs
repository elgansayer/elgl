#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appRoot = resolve(root, 'frontend/src/app');
const generatedHelmRoot = 'frontend/src/app/components/ui/';

// Temporary migration exceptions. Remove each entry when its numbered Spartan
// migration issue lands. New feature-level Brain imports are not allowed.
const temporaryExceptions = new Map([
  [
    'frontend/src/app/components/report-user-modal/report-user-modal.component.ts',
    '#6501/#6502 Spartan report-user-modal migration'
  ],
  [
    'frontend/src/app/components/long-press-context-menu/long-press-context-menu.component.ts',
    '#6334 Spartan long-press-context-menu migration'
  ]
]);

function files(path) {
  const result = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) result.push(...files(full));
    else if (entry.isFile() && entry.name.endsWith('.ts')) result.push(full);
  }
  return result;
}

const violations = [];
const exceptionsSeen = new Set();
const brainImportPattern = /from\s+['"]@spartan-ng\/brain(?:\/[^'"]*)?['"]/;

for (const absolutePath of files(appRoot)) {
  const path = relative(root, absolutePath).replaceAll('\\', '/');
  const source = readFileSync(absolutePath, 'utf8');
  if (!brainImportPattern.test(source)) continue;

  if (path.startsWith(generatedHelmRoot)) continue;

  if (temporaryExceptions.has(path)) {
    exceptionsSeen.add(path);
    continue;
  }

  violations.push(`${path}: direct @spartan-ng/brain import outside the owned Helm layer`);
}

for (const [path, issue] of temporaryExceptions) {
  if (!exceptionsSeen.has(path)) {
    violations.push(`${path}: stale Spartan boundary exception (${issue}); remove it from the allow-list`);
  }
}

if (violations.length > 0) {
  console.error('Spartan ownership boundary verification failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('\nFeature code should use Relay/Helm abstractions. See docs/spartan-relay-architecture.md.');
  process.exit(1);
}

console.log(`Spartan ownership boundary verified. Temporary exceptions: ${temporaryExceptions.size}.`);

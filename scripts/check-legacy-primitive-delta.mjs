#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const base = process.env.LEGACY_PRIMITIVE_BASE_SHA;

if (!base) {
  console.log('Legacy primitive delta check skipped: LEGACY_PRIMITIVE_BASE_SHA is not set.');
  process.exit(0);
}

const retiredSelectors = [
  'app-card',
  'app-button-primary',
  'app-button-secondary',
  'app-input',
  'app-textarea',
  'app-chip',
  'app-pill',
  'app-empty-state',
];

const retiredImportFragments = [
  '/components/primitives/card',
  '/components/primitives/button-primary',
  '/components/primitives/button-secondary',
  '/components/primitives/input',
  '/components/primitives/textarea',
  '/components/primitives/chip',
  '/components/primitives/pill',
  '/components/primitives/empty-state',
  '../primitives/card',
  '../primitives/button-primary',
  '../primitives/button-secondary',
  '../primitives/input',
  '../primitives/textarea',
  '../primitives/chip',
  '../primitives/pill',
  '../primitives/empty-state',
];

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function countUsage(source) {
  let count = 0;
  for (const selector of retiredSelectors) {
    count += source.split(`<${selector}`).length - 1;
  }
  for (const fragment of retiredImportFragments) {
    count += source.split(fragment).length - 1;
  }
  return count;
}

function baseSource(path) {
  try {
    return git(['show', `${base}:${path}`]);
  } catch {
    return '';
  }
}

let changed;
try {
  changed = git(['diff', '--name-only', `${base}...HEAD`])
    .split('\n')
    .map((path) => path.trim())
    .filter(Boolean);
} catch (error) {
  console.error(`Unable to calculate legacy primitive delta from ${base}.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const candidates = changed.filter(
  (path) =>
    path.startsWith('frontend/src/app/') &&
    (path.endsWith('.ts') || path.endsWith('.html')) &&
    !path.startsWith('frontend/src/app/components/primitives/'),
);

const failures = [];
for (const path of candidates) {
  const absolute = resolve(root, path);
  const current = existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
  const before = baseSource(path);
  const currentCount = countUsage(current);
  const baseCount = countUsage(before);

  if (currentCount > baseCount) {
    failures.push(`${path}: retired primitive usage increased from ${baseCount} to ${currentCount}`);
  }
}

if (failures.length > 0) {
  console.error('Legacy primitive adoption check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nDo not add new call sites for the retired app-* primitive family. Use approved Relay/Helm APIs.');
  console.error('See DESIGN.md and docs/spartan-relay-architecture.md.');
  process.exit(1);
}

console.log(`Legacy primitive adoption verified across ${candidates.length} changed frontend feature file(s): no increases.`);

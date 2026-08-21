#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'design-sync.manifest.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const failures = [];

const requiredFiles = [
  'DESIGN.md',
  'docs/spartan-relay-architecture.md',
  'docs/claude-design-two-way-sync.md',
  'docs/ux-ui-100-percent-contract.md',
  'design-sync.manifest.json',
  'scripts/verify-design-sync-manifest.mjs',
  'scripts/check-design-sync-drift.mjs',
  'scripts/verify-spartan-boundaries.mjs',
  'scripts/verify-component-system-convergence.mjs',
  'scripts/verify-visual-contract-matrix.mjs',
  'scripts/verify-rtl-logical-contract.mjs',
  'scripts/verify-focus-ring-contract.mjs',
  'scripts/verify-reduced-motion-contract.mjs',
  'scripts/verify-ux-platform-contract.mjs',
  'scripts/report-ux-system-health.mjs',
  'frontend/components.json',
  'frontend/AGENTS.md',
  '.claude/CLAUDE.md',
  '.claude/skills/spartan/SKILL.md',
];

for (const path of requiredFiles) {
  if (!existsSync(resolve(root, path))) failures.push(`missing required UX governance file: ${path}`);
}

const requiredScripts = [
  'check:design-sync',
  'check:spartan-boundaries',
  'check:component-system',
  'check:visual-contract-matrix',
  'check:rtl-logical-contract',
  'check:focus-ring-contract',
  'check:reduced-motion-contract',
  'check:ux-platform-contract',
  'report:ux-system-health',
];
for (const script of requiredScripts) {
  if (!packageJson.scripts?.[script]) failures.push(`missing package script: ${script}`);
}

const pending = manifest.items.filter((item) => item.lastReconciledCommit === null);
if (pending.length > 0) {
  failures.push(
    `Claude Design reconciliation incomplete for ${pending.length}/${manifest.items.length} item(s): ${pending.map((item) => item.id).join(', ')}`,
  );
}

for (const item of manifest.items) {
  for (const previewPath of item.previewPaths ?? []) {
    if (!existsSync(resolve(root, previewPath))) {
      failures.push(`${item.id}: missing mapped preview ${previewPath}`);
    }
  }
}

const checks = [
  ['scripts/verify-design-sync-manifest.mjs'],
  ['scripts/verify-spartan-boundaries.mjs'],
  ['scripts/verify-component-system-convergence.mjs'],
  ['scripts/verify-visual-contract-matrix.mjs'],
  ['scripts/verify-rtl-logical-contract.mjs'],
  ['scripts/verify-focus-ring-contract.mjs'],
  ['scripts/verify-reduced-motion-contract.mjs'],
  ['scripts/verify-ux-platform-contract.mjs'],
];

for (const args of checks) {
  try {
    execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  } catch {
    failures.push(`specialised UX gate failed: node ${args.join(' ')}`);
  }
}

if (failures.length > 0) {
  console.error('\nUX/UI + Spartan + Claude Design is NOT 100% complete.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`UX/UI + Spartan + Claude Design completion verified across ${manifest.items.length} design-sync artefacts.`);

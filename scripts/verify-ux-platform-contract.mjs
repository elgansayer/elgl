#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const frontendRoot = resolve(root, 'frontend');
const frontendPackage = JSON.parse(readFileSync(resolve(frontendRoot, 'package.json'), 'utf8'));
const angular = JSON.parse(readFileSync(resolve(frontendRoot, 'angular.json'), 'utf8'));
const failures = [];

const requiredFrontendChecks = [
  'check:control-flow',
  'check:template-bindings',
  'check:rtl-logical',
  'check:relay-token-ownership',
  'check:multilingual-typography',
  'check:semantic-colour-roles',
  'check:surface-elevation',
  'check:radius-hierarchy',
  'check:spacing-density',
  'check:motion-contract',
  'check:icon-contract',
  'check:density-modes',
  'check:forced-colors',
  'check:spartan-health',
];

for (const script of requiredFrontendChecks) {
  if (!frontendPackage.scripts?.[script]) failures.push(`missing frontend UX verification script: ${script}`);
}

const build = angular.projects?.frontend?.architect?.build;
if (!build) failures.push('Angular frontend build configuration is missing');

const options = build?.options ?? {};
if (!options.server) failures.push('Angular SSR server entry is missing');
if (options.outputMode !== 'server') failures.push('Angular outputMode must remain server for SSR coverage');
if (!options.ssr?.entry) failures.push('Angular SSR entry is missing');

const production = build?.configurations?.production ?? {};
const budgets = production.budgets ?? [];
const initialBudget = budgets.find((budget) => budget.type === 'initial');
const styleBudget = budgets.find((budget) => budget.type === 'anyComponentStyle');
if (!initialBudget?.maximumError) failures.push('production initial bundle maximumError budget is missing');
if (!styleBudget?.maximumError) failures.push('component style maximumError budget is missing');

const requiredStyleContracts = ['src/forced-colors.scss', 'src/reduced-motion.scss'];
for (const path of requiredStyleContracts) {
  if (!(options.styles ?? []).includes(path)) failures.push(`global UX style contract is not registered: ${path}`);
  if (!existsSync(resolve(frontendRoot, path))) failures.push(`global UX style contract file is missing: ${path}`);
}

const requiredDocs = [
  'DESIGN.md',
  'docs/spartan-relay-architecture.md',
  'docs/ux-ui-100-percent-contract.md',
];
for (const path of requiredDocs) {
  if (!existsSync(resolve(root, path))) failures.push(`required UX architecture document is missing: ${path}`);
}

if (failures.length > 0) {
  console.error('UX platform contract verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('UX platform contract verified: responsive/i18n tooling, SSR, budgets, forced colours, reduced motion and Spartan health are structurally enforced.');

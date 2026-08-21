#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const componentsPath = resolve(root, 'components.json');
const failures = [];

if (!existsSync(componentsPath)) {
  failures.push('frontend/components.json is missing');
} else {
  const config = JSON.parse(readFileSync(componentsPath, 'utf8'));
  if (config.componentsPath !== 'src/app/components/ui') {
    failures.push(`componentsPath must remain src/app/components/ui; found ${config.componentsPath}`);
  }
  if (config.importAlias !== '@spartan-ng/helm') {
    failures.push(`importAlias must remain @spartan-ng/helm; found ${config.importAlias}`);
  }
  if (!config.style) failures.push('components.json style is required');
}

const brain = packageJson.dependencies?.['@spartan-ng/brain'];
const cli = packageJson.devDependencies?.['@spartan-ng/cli'];
if (!brain) failures.push('@spartan-ng/brain dependency is missing');
if (!cli) failures.push('@spartan-ng/cli devDependency is missing');

function releaseLine(range) {
  const match = String(range ?? '').match(/(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}` : null;
}

if (brain && cli && releaseLine(brain) !== releaseLine(cli)) {
  failures.push(`Brain and CLI must share a major/minor release line: brain=${brain}, cli=${cli}`);
}

const helmRoot = resolve(root, 'src/app/components/ui');
if (!existsSync(helmRoot)) {
  failures.push('owned Helm directory src/app/components/ui is missing');
} else {
  const componentDirs = readdirSync(helmRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (componentDirs.length === 0) failures.push('owned Helm directory contains no generated component directories');
}

if (failures.length > 0) {
  console.error('Spartan repository health verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('See docs/spartan-upgrade-runbook.md before changing Spartan packages or Helm configuration.');
  process.exit(1);
}

console.log(`Spartan repository health verified: Brain ${brain}, CLI ${cli}.`);

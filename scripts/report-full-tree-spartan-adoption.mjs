#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appRoot = resolve(root, 'frontend/src/app');
const helmRoot = resolve(appRoot, 'components/ui');
const primitiveRoot = resolve(appRoot, 'components/primitives');
const strict = process.argv.includes('--strict');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function repoPath(path) {
  return relative(root, path).replaceAll('\\', '/');
}

function openingTags(source, tag) {
  return source.match(new RegExp(`<${tag}\\b[\\s\\S]*?>`, 'g')) ?? [];
}

const sourceFiles = walk(appRoot).filter((path) => /\.(?:ts|html)$/.test(path) && !/\.spec\.ts$/.test(path));
const featureFiles = sourceFiles.filter((path) => !path.startsWith(`${helmRoot}/`));
const helmFamilies = existsSync(helmRoot)
  ? readdirSync(helmRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  : [];
const relayPrimitiveFamilies = existsSync(primitiveRoot)
  ? readdirSync(primitiveRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  : [];

const findings = {
  directBrainImports: [],
  rawButtons: [],
  rawTextInputs: [],
  rawTextareas: [],
  rawSelects: [],
  rawCheckboxes: [],
  rawRadios: [],
  roleButtons: [],
};

const brainImportPattern = /from\s+['"]@spartan-ng\/brain(?:\/[^'"]*)?['"]/;
const nonTextInputTypes = new Set(['hidden', 'file', 'checkbox', 'radio', 'range', 'color']);

for (const path of featureFiles) {
  const file = repoPath(path);
  const source = readFileSync(path, 'utf8');

  if (path.endsWith('.ts') && brainImportPattern.test(source)) findings.directBrainImports.push(file);

  for (const tag of openingTags(source, 'button')) {
    if (!/\bhlmBtn\b/.test(tag)) findings.rawButtons.push(file);
  }

  for (const tag of openingTags(source, 'input')) {
    const type = /\btype\s*=\s*["']([^"']+)["']/.exec(tag)?.[1]?.toLowerCase() ?? 'text';
    if (type === 'checkbox') {
      findings.rawCheckboxes.push(file);
      continue;
    }
    if (type === 'radio') {
      findings.rawRadios.push(file);
      continue;
    }
    if (!nonTextInputTypes.has(type) && !/\bhlmInput\b/.test(tag)) findings.rawTextInputs.push(file);
  }

  for (const tag of openingTags(source, 'textarea')) {
    if (!/\bhlmTextarea\b/.test(tag)) findings.rawTextareas.push(file);
  }

  if (openingTags(source, 'select').length > 0) findings.rawSelects.push(file);

  if (/role\s*=\s*["']button["']/.test(source) && !file.endsWith('a11y-clickable.ts')) findings.roleButtons.push(file);
}

for (const key of Object.keys(findings)) findings[key] = [...new Set(findings[key])].sort();

const summary = {
  sourceFiles: sourceFiles.length,
  featureFiles: featureFiles.length,
  helmFamilies: helmFamilies.length,
  relayPrimitiveFamilies: relayPrimitiveFamilies.length,
  ...Object.fromEntries(Object.entries(findings).map(([key, values]) => [key, values.length])),
};

console.log('# Full-tree Spartan adoption audit');
console.log('');
console.log(`- Angular source files inspected: ${summary.sourceFiles}`);
console.log(`- Feature/Relay source files inspected: ${summary.featureFiles}`);
console.log(`- Owned Helm families: ${summary.helmFamilies} (${helmFamilies.join(', ') || 'none'})`);
console.log(`- Relay primitive families: ${summary.relayPrimitiveFamilies}`);
console.log('');

for (const [key, values] of Object.entries(findings)) {
  console.log(`## ${key} (${values.length})`);
  if (values.length === 0) console.log('- None');
  else for (const value of values) console.log(`- ${value}`);
  console.log('');
}

const strictFailures = [
  ...findings.directBrainImports.map((file) => `${file}: direct Spartan Brain import outside owned Helm`),
  ...findings.rawButtons.map((file) => `${file}: native button bypasses hlmBtn`),
  ...findings.rawTextInputs.map((file) => `${file}: text-like input bypasses hlmInput`),
  ...findings.rawTextareas.map((file) => `${file}: textarea bypasses hlmTextarea`),
  ...findings.rawSelects.map((file) => `${file}: native select bypasses owned Spartan Native Select`),
  ...findings.rawCheckboxes.map((file) => `${file}: native checkbox bypasses owned Spartan Checkbox`),
  ...findings.rawRadios.map((file) => `${file}: native radio bypasses owned Spartan Radio Group`),
];

if (strict && strictFailures.length > 0) {
  console.error('Full-tree Spartan adoption verification failed:');
  for (const failure of strictFailures) console.error(`- ${failure}`);
  process.exit(1);
}

if (strict) console.log('Full-tree Spartan adoption verified for all currently used native control families.');

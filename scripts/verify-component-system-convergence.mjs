#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const primitiveRoot = resolve(root, 'frontend/src/app/components/primitives');
const uiRoot = resolve(root, 'frontend/src/app/components/ui');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sourceFiles = walk(primitiveRoot).filter((path) => /\.(?:ts|html)$/.test(path) && !/\.spec\.ts$/.test(path));
const failures = [];

for (const path of sourceFiles) {
  const source = readFileSync(path, 'utf8');
  const file = relative(root, path);
  const checks = [
    [/<button\b(?![^>]*\bhlmBtn\b)[^>]*>/g, 'native <button> must delegate to hlmBtn'],
    [/<input\b(?![^>]*\bhlmInput\b)[^>]*>/g, 'native <input> must delegate to hlmInput'],
    [/<textarea\b(?![^>]*\bhlmTextarea\b)[^>]*>/g, 'native <textarea> must delegate to hlmTextarea'],
  ];
  for (const [pattern, message] of checks) {
    if (pattern.test(source)) failures.push(`${file}: ${message}`);
  }

  if (/focus:(?:ring|outline|border)/.test(source)) {
    failures.push(`${file}: shared primitives must use the canonical focus-visible Helm contract`);
  }
}

for (const required of ['button', 'dialog', 'input', 'textarea', 'utils']) {
  const path = resolve(uiRoot, required);
  try {
    if (!statSync(path).isDirectory()) throw new Error('not a directory');
  } catch {
    failures.push(`missing owned Spartan Helm primitive: ${required}`);
  }
}

if (failures.length) {
  console.error('Component-system convergence verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Component-system convergence verified across ${sourceFiles.length} shared primitive source files.`);

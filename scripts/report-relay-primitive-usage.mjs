#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appRoot = resolve(root, 'frontend/src/app');
const primitiveRoot = resolve(appRoot, 'components/primitives');

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

const allSource = walk(appRoot).filter((path) => ['.ts', '.html'].includes(extname(path)) && !/\.spec\.ts$/.test(path));
const primitiveDirs = existsSync(primitiveRoot)
  ? readdirSync(primitiveRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(primitiveRoot, entry.name)).sort()
  : [];

const rows = [];

for (const dir of primitiveDirs) {
  const files = walk(dir).filter((path) => ['.ts', '.html'].includes(extname(path)) && !/\.spec\.ts$/.test(path));
  const tsFiles = files.filter((path) => path.endsWith('.ts'));
  const selectors = [];
  const exportedSymbols = [];

  for (const path of tsFiles) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/selector\s*:\s*['"]([^'"]+)['"]/g)) selectors.push(match[1]);
    for (const match of source.matchAll(/export\s+(?:abstract\s+)?(?:class|const|function|enum|type|interface)\s+([A-Za-z_$][\w$]*)/g)) {
      exportedSymbols.push(match[1]);
    }
  }

  const consumers = new Set();
  for (const path of allSource) {
    if (path.startsWith(`${dir}/`) || dirname(path) === dir) continue;
    const source = readFileSync(path, 'utf8');
    const selectorHit = selectors.some((selector) => {
      if (/^[a-z][\w-]*$/.test(selector)) return new RegExp(`<${selector}(?:\\s|>|/)`).test(source);
      if (/^\[[^\]]+\]$/.test(selector)) return source.includes(selector.slice(1, -1));
      return source.includes(selector);
    });
    const symbolHit = exportedSymbols.some((symbol) => new RegExp(`\\b${symbol}\\b`).test(source));
    if (selectorHit || symbolHit) consumers.add(repoPath(path));
  }

  rows.push({
    primitive: repoPath(dir).split('/').at(-1),
    selectors: [...new Set(selectors)].sort(),
    exportedSymbols: [...new Set(exportedSymbols)].sort(),
    sourceFiles: files.length,
    externalConsumers: [...consumers].sort(),
  });
}

console.log('# Relay primitive usage audit');
console.log('');
console.log(`Primitive families: ${rows.length}`);
console.log(`Families with external consumers: ${rows.filter((row) => row.externalConsumers.length > 0).length}`);
console.log(`Families with no detected external consumer: ${rows.filter((row) => row.externalConsumers.length === 0).length}`);
console.log('');
console.log('| Primitive | Selectors | Source files | External consumers |');
console.log('| --- | --- | ---: | ---: |');
for (const row of rows) {
  console.log(`| ${row.primitive} | ${row.selectors.join(', ') || 'n/a'} | ${row.sourceFiles} | ${row.externalConsumers.length} |`);
}

const unused = rows.filter((row) => row.externalConsumers.length === 0);
if (unused.length > 0) {
  console.log('');
  console.log('## No detected external consumer');
  console.log('');
  for (const row of unused) {
    console.log(`- ${row.primitive}${row.selectors.length ? ` (${row.selectors.join(', ')})` : ''}`);
  }
  console.log('');
  console.log('These are review candidates, not automatic deletion candidates. Dynamic rendering, barrel exports, tests and future/public API use can make a static zero-consumer result legitimate.');
}

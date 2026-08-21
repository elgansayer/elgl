#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appRoot = resolve(root, 'frontend/src/app');
const uiRoot = resolve(appRoot, 'components/ui');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const tsFiles = walk(appRoot).filter(
  (path) => path.endsWith('.ts') && !path.endsWith('.spec.ts') && !path.startsWith(`${uiRoot}/`),
);
const htmlFiles = walk(appRoot).filter((path) => path.endsWith('.html') && !path.startsWith(`${uiRoot}/`));
const owners = new Map();
const required = new Set();

for (const path of tsFiles) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/templateUrl\s*:\s*['"]([^'"]+)['"]/g)) {
    owners.set(resolve(dirname(path), match[1]), path);
  }
}

function safeToMigrate(tag) {
  const classValue = /\bclass\s*=\s*["']([^"']*)["']/.exec(tag)?.[1] ?? '';
  return !/(?:^|\s)(?:sr-only|peer)(?:\s|$)/.test(classValue);
}

function migrateTag(tag) {
  let next = tag.replace(/^<input\b/, '<hlm-checkbox');
  next = next.replace(/\s+type\s*=\s*["']checkbox["']/i, '');
  next = next.replace(/\[id\]\s*=\s*("[^"]*"|'[^']*')/g, '[inputId]=$1');
  next = next.replace(/(?<![\w-])id\s*=\s*("[^"]*"|'[^']*')/g, 'inputId=$1');
  next = next.replace(/\[attr\.aria-label\]\s*=/g, '[aria-label]=');
  next = next.replace(/\[attr\.aria-labelledby\]\s*=/g, '[aria-labelledby]=');
  next = next.replace(/\[attr\.aria-describedby\]\s*=/g, '[aria-describedby]=');
  return next;
}

function transformTemplate(source, ownerPath) {
  let changed = false;
  const next = source.replace(/<input\b[\s\S]*?>/g, (tag) => {
    const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (type !== 'checkbox' || !safeToMigrate(tag)) return tag;
    changed = true;
    return migrateTag(tag);
  });
  if (changed && ownerPath) required.add(ownerPath);
  return next;
}

for (const path of htmlFiles) {
  const owner = owners.get(path);
  if (!owner) continue;
  const source = readFileSync(path, 'utf8');
  const next = transformTemplate(source, owner);
  if (next !== source) writeFileSync(path, next);
}

for (const path of tsFiles) {
  const source = readFileSync(path, 'utf8');
  const next = transformTemplate(source, path);
  if (next !== source) writeFileSync(path, next);
}

function ensureNamedImport(source) {
  const moduleImport = /import\s*\{([^}]*)\}\s*from\s*['"]@spartan-ng\/helm\/checkbox['"];?/;
  const match = moduleImport.exec(source);
  if (match) {
    const names = match[1].split(',').map((name) => name.trim()).filter(Boolean);
    if (names.some((name) => name.split(/\s+as\s+/)[0] === 'HlmCheckbox')) return source;
    const replacement = match[0].replace('{', '{ HlmCheckbox,');
    return source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length);
  }
  return `import { HlmCheckbox } from '@spartan-ng/helm/checkbox';\n${source}`;
}

function ensureComponentImport(source) {
  if (!source.includes('@Component')) return source;
  const imports = /imports\s*:\s*\[/;
  const match = imports.exec(source);
  if (match) {
    const start = match.index + match[0].length;
    const close = source.indexOf(']', start);
    if (close !== -1 && /\bHlmCheckbox\b/.test(source.slice(start, close))) return source;
    return source.slice(0, start) + 'HlmCheckbox, ' + source.slice(start);
  }
  return source.replace('@Component({', '@Component({\n  imports: [HlmCheckbox],');
}

for (const path of required) {
  let source = readFileSync(path, 'utf8');
  source = ensureNamedImport(source);
  source = ensureComponentImport(source);
  writeFileSync(path, source);
}

console.log(`Migrated safe native checkboxes to owned Spartan Checkbox across ${required.size} Angular component source file(s).`);

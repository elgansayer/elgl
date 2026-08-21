#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

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

const tsFiles = walk(appRoot).filter((path) => path.endsWith('.ts') && !path.endsWith('.spec.ts') && !path.startsWith(`${uiRoot}/`));
const htmlFiles = walk(appRoot).filter((path) => path.endsWith('.html') && !path.startsWith(`${uiRoot}/`));
const owners = new Map();
const required = new Map();

for (const path of tsFiles) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/templateUrl\s*:\s*['"]([^'"]+)['"]/g)) {
    owners.set(resolve(dirname(path), match[1]), path);
  }
}

function need(path, symbol) {
  if (!path) return;
  const set = required.get(path) ?? new Set();
  set.add(symbol);
  required.set(path, set);
}

function transformTemplate(source, ownerPath) {
  let next = source;

  next = next.replace(/<button\b[\s\S]*?>/g, (tag) => {
    if (/\bhlmBtn\b/.test(tag)) return tag;
    need(ownerPath, 'HlmButton');
    return tag.replace(/^<button\b/, '<button hlmBtn');
  });

  next = next.replace(/<input\b[\s\S]*?>/g, (tag) => {
    if (/\bhlmInput\b/.test(tag)) return tag;
    const type = /\btype\s*=\s*["']([^"']+)["']/.exec(tag)?.[1]?.toLowerCase() ?? 'text';
    if (['hidden', 'file', 'checkbox', 'radio', 'range', 'color'].includes(type)) return tag;
    need(ownerPath, 'HlmInput');
    return tag.replace(/^<input\b/, '<input hlmInput');
  });

  next = next.replace(/<textarea\b[\s\S]*?>/g, (tag) => {
    if (/\bhlmTextarea\b/.test(tag)) return tag;
    need(ownerPath, 'HlmTextarea');
    return tag.replace(/^<textarea\b/, '<textarea hlmTextarea');
  });

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

const moduleFor = {
  HlmButton: '@spartan-ng/helm/button',
  HlmInput: '@spartan-ng/helm/input',
  HlmTextarea: '@spartan-ng/helm/textarea',
};

function ensureNamedImport(source, symbol, moduleName) {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const moduleImport = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escaped}['"];?`);
  const match = moduleImport.exec(source);
  if (match) {
    const names = match[1].split(',').map((name) => name.trim()).filter(Boolean);
    if (names.some((name) => name.split(/\s+as\s+/)[0] === symbol)) return source;
    const replacement = match[0].replace('{', `{ ${symbol},`);
    return source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length);
  }
  return `import { ${symbol} } from '${moduleName}';\n${source}`;
}

function ensureComponentImport(source, symbol) {
  if (!source.includes('@Component')) return source;
  const importArray = /imports\s*:\s*\[/;
  if (importArray.test(source)) {
    const match = importArray.exec(source);
    const arrayStart = match.index + match[0].length;
    const close = source.indexOf(']', arrayStart);
    if (close !== -1 && new RegExp(`\\b${symbol}\\b`).test(source.slice(arrayStart, close))) return source;
    return source.slice(0, arrayStart) + `${symbol}, ` + source.slice(arrayStart);
  }
  return source.replace('@Component({', `@Component({\n  imports: [${symbol}],`);
}

for (const [path, symbols] of required) {
  let source = readFileSync(path, 'utf8');
  for (const symbol of symbols) {
    source = ensureNamedImport(source, symbol, moduleFor[symbol]);
    source = ensureComponentImport(source, symbol);
  }
  writeFileSync(path, source);
}

console.log(`Migrated owned Spartan controls across ${required.size} Angular component source file(s).`);

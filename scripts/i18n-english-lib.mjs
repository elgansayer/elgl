import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const i18nServicePath = 'frontend/src/app/services/i18n.service.ts';
export const enGbJsonPath = 'frontend/public/assets/i18n/en-GB.json';

const BASE_DICTIONARY_START = 'private readonly baseDictionary';
const BASE_DICTIONARY_END = 'readonly translations = signal';

const GENERIC_FALLBACKS = new Set(['Title', 'Description', 'Empty', 'Scheduled', 'Button']);
const GENERATED_LOGIN_PATTERN = /^Login (google|apple|facebook)$/i;
const GENERATED_SUFFIX_PATTERN =
  /\b(Title|Description|Empty|Button|Label|Btn|Aria|Alert|Status|Header|Subtitle)$/;

const UNTRANSLATED_SURFACE_PATTERNS = [
  /['"]([A-Za-z][A-Za-z0-9_.-]*)['"]\s*\|\s*t\b/g,
  /\.translate\(\s*'([^']+)'/g,
  /(?<![.\w])t\(\s*'([A-Za-z][A-Za-z0-9_.-]*)'/g,
];

function humaniseSegment(segment) {
  return segment
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function humaniseKeyTail(key) {
  return humaniseSegment(key.split('.').pop());
}

export function isKeyDerivedCopy(key, value) {
  if (typeof value !== 'string' || value.trim() === '') return true;
  if (value === key) return true;
  if (GENERIC_FALLBACKS.has(value)) return true;
  if (GENERATED_LOGIN_PATTERN.test(value)) return true;

  const generated = humaniseKeyTail(key);
  if (value === generated && value.includes(' ') && GENERATED_SUFFIX_PATTERN.test(value)) {
    return true;
  }

  const moduleName = key.split('.')[0].replace(/s$/, '');
  const modulePrefixed = `${humaniseSegment(moduleName)} ${generated}`;
  return value === modulePrefixed;
}

function decodeStringLiteral(literal) {
  return literal.replace(/\\(['"\\])/g, '$1');
}

export function parseDictionarySource(source) {
  const start = source.indexOf(BASE_DICTIONARY_START);
  const end = source.indexOf(BASE_DICTIONARY_END);
  if (start < 0 || end <= start) {
    throw new Error('baseDictionary must stay locatable in i18n.service.ts');
  }

  const body = source.slice(start, end);
  const entryPattern =
    /^\s{4,}(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*)):\s*((?:'(?:[^'\\]|\\.)*'(?:\s*\+\s*'(?:[^'\\]|\\.)*')*)|(?:"(?:[^"\\]|\\.)*"))/gm;
  const dictionary = new Map();
  for (const match of body.matchAll(entryPattern)) {
    const key = match[1] ?? match[2];
    const expression = match[3];
    const value = expression.startsWith('"')
      ? decodeStringLiteral(expression.slice(1, -1))
      : [...expression.matchAll(/'((?:[^'\\]|\\.)*)'/g)]
          .map((part) => decodeStringLiteral(part[1]))
          .join('');
    dictionary.set(key, value);
  }
  return dictionary;
}

export function readBaseDictionary() {
  return parseDictionarySource(readFileSync(resolve(root, i18nServicePath), 'utf8'));
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function isScannedSource(path) {
  return (
    /\.(ts|html)$/.test(path) &&
    !/\.(spec|e2e)\./.test(path) &&
    !/i18n\.service|translate\.pipe/.test(path)
  );
}

export function extractUsedKeys(source) {
  const keys = new Set();
  for (const pattern of UNTRANSLATED_SURFACE_PATTERNS) {
    for (const match of source.matchAll(pattern)) keys.add(match[1]);
  }
  return keys;
}

export function collectUsedKeys() {
  const usage = new Map();
  const files = walk(resolve(root, 'frontend/src/app')).filter(isScannedSource);
  for (const file of files) {
    const relative = file.replace(`${root}/`, '');
    for (const key of extractUsedKeys(readFileSync(file, 'utf8'))) {
      if (!usage.has(key)) usage.set(key, new Set());
      usage.get(key).add(relative);
    }
  }
  return usage;
}

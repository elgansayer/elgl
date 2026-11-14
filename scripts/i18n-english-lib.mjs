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

const LITERAL_ATTRIBUTE_NAMES = ['aria-label', 'aria-description', 'placeholder', 'title', 'alt'];
const COMPONENT_ARIA_LABEL = 'ariaLabel';
const STATIC_ATTRIBUTE_PATTERN = new RegExp(
  `(?<![.\\w\\[])(?:${LITERAL_ATTRIBUTE_NAMES.join('|')})\\s*=\\s*"([^"]*)"`,
  'g',
);
const STATIC_COMPONENT_LABEL_PATTERN = new RegExp(
  `(?<![.\\w\\[])${COMPONENT_ARIA_LABEL}\\s*=\\s*"([^"]*)"`,
  'g',
);
const BOUND_ATTRIBUTE_PATTERN = new RegExp(
  `\\[(?:attr\\.)?(?:${LITERAL_ATTRIBUTE_NAMES.join('|')}|${COMPONENT_ARIA_LABEL})\\]\\s*=\\s*"([^"]*)"`,
  'g',
);
const DOTTED_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const TRANSLATION_EXPRESSION_PATTERN = /\|\s*t\b|\.translate\(|(?<![.\w])t\(/;
const STATIC_ESCAPE_COMMENT = 'translation-static-ok';

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

export function findDuplicateDictionaryKeys(source) {
  const start = source.indexOf(BASE_DICTIONARY_START);
  const end = source.indexOf(BASE_DICTIONARY_END);
  if (start < 0 || end <= start) {
    throw new Error('baseDictionary must stay locatable in i18n.service.ts');
  }

  const body = source.slice(start, end);
  const keyPattern = /^\s{4,}(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*)):\s*/gm;
  const seen = new Set();
  const duplicates = new Set();
  for (const match of body.matchAll(keyPattern)) {
    const key = match[1] ?? match[2];
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
}

/**
 * Finds template attributes that carry user-facing copy but never reach the
 * translation pipe. Static values must use `| t`; bound expressions may pass a
 * dotted translation key to a primitive that pipes it itself.
 */
export function findUntranslatedAttributes(source) {
  const text = String(source);
  const violations = [];

  for (const match of text.matchAll(STATIC_ATTRIBUTE_PATTERN)) {
    const value = match[1];
    if (!value.trim() || value.includes('{{')) continue;
    const line = lineNumberAt(text, match.index);
    if (text.split('\n')[line - 1].includes(STATIC_ESCAPE_COMMENT)) continue;
    violations.push({ line, attribute: match[0].split('=')[0].trim(), value });
  }

  for (const match of text.matchAll(STATIC_COMPONENT_LABEL_PATTERN)) {
    const value = match[1];
    if (!value.trim()) continue;
    const line = lineNumberAt(text, match.index);
    if (text.split('\n')[line - 1].includes(STATIC_ESCAPE_COMMENT)) continue;
    if (DOTTED_KEY_PATTERN.test(value)) continue;
    violations.push({ line, attribute: COMPONENT_ARIA_LABEL, value });
  }

  for (const match of text.matchAll(BOUND_ATTRIBUTE_PATTERN)) {
    const expression = match[1];
    if (TRANSLATION_EXPRESSION_PATTERN.test(expression)) continue;
    const line = lineNumberAt(text, match.index);
    if (text.split('\n')[line - 1].includes(STATIC_ESCAPE_COMMENT)) continue;
    const literals = [...expression.matchAll(/'([^']*)'/g)]
      .map((literal) => literal[1])
      .filter((literal) => /[A-Za-z]{2}/.test(literal))
      .filter((literal) => !DOTTED_KEY_PATTERN.test(literal));
    if (literals.length === 0) continue;
    violations.push({
      line,
      attribute: match[0]
        .split('=')[0]
        .replace(/^\[|\]$/g, '')
        .trim(),
      value: expression.trim(),
    });
  }

  return violations.sort((left, right) => left.line - right.line);
}

export function collectUntranslatedAttributes() {
  const violations = [];
  const files = walk(resolve(root, 'frontend/src/app')).filter(
    (file) => isScannedSource(file) && !file.includes('/components/ui/'),
  );
  for (const file of files) {
    const relative = file.replace(`${root}/`, '');
    for (const violation of findUntranslatedAttributes(readFileSync(file, 'utf8'))) {
      violations.push({ file: relative, ...violation });
    }
  }
  return violations;
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

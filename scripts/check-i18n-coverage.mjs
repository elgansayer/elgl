#!/usr/bin/env node
// Fails when any translation key used by a template or t() call has no English
// value, resolves to copy generated from the key name, when a template carries
// literal accessible-name/placeholder copy outside the translation pipe, or when
// the English JSON mirror drifts from I18nService.baseDictionary (the single
// source of truth).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  collectUntranslatedAttributes,
  collectUsedKeys,
  findDuplicateDictionaryKeys,
  enGbJsonPath,
  isKeyDerivedCopy,
  readBaseDictionary,
  root,
} from './i18n-english-lib.mjs';

const dictionary = readBaseDictionary();
const duplicateKeys = findDuplicateDictionaryKeys(
  readFileSync(resolve(root, 'frontend/src/app/services/i18n.service.ts'), 'utf8'),
);
const usage = collectUsedKeys();
const untranslatedAttributes = collectUntranslatedAttributes();

const missing = [];
for (const [key] of usage) {
  if (!dictionary.has(key)) missing.push(key);
}

const derivedCopy = [];
for (const [key, value] of dictionary) {
  if (isKeyDerivedCopy(key, value)) derivedCopy.push(key);
}

const mirrors = [enGbJsonPath].map((path) => ({
  path,
  source: JSON.parse(readFileSync(resolve(root, path), 'utf8')),
}));
const drift = [];
for (const { path, source } of mirrors) {
  const mirror = new Map(Object.entries(source));
  for (const [key, value] of dictionary) {
    if (mirror.get(key) !== value) drift.push(`${path}: ${key}`);
  }
  for (const key of mirror.keys()) {
    if (!dictionary.has(key)) drift.push(`${path}: ${key} (not in baseDictionary)`);
  }
}

const fail = (label, keys) => {
  console.error(`\n${label} (${keys.length}):`);
  for (const key of keys.slice(0, 100)) console.error(`  - ${key}`);
  if (keys.length > 100) console.error(`  ...and ${keys.length - 100} more`);
};

if (missing.length) fail('Keys used without an English value', missing);
if (derivedCopy.length) fail('Keys with copy generated from the key name', derivedCopy);
if (drift.length) {
  fail('English JSON mirror out of sync; run npm run generate:i18n-english', drift);
}
if (duplicateKeys.length) {
  fail('Duplicate dictionary keys (last value silently wins)', duplicateKeys);
}
if (untranslatedAttributes.length) {
  fail(
    'Template attributes with untranslated copy',
    untranslatedAttributes.map(
      (violation) =>
        `${violation.file}:${violation.line} ${violation.attribute}: ${violation.value}`,
    ),
  );
}

const failures = missing.length + derivedCopy.length + drift.length + untranslatedAttributes.length;
if (failures > 0) process.exit(1);

console.log(
  `English i18n coverage verified: ${usage.size} used keys, ${dictionary.size} dictionary entries, no literal template attributes.`,
);

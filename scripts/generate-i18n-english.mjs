#!/usr/bin/env node
// Regenerates the English JSON mirror from the single source of truth,
// I18nService.baseDictionary. Run after changing English copy:
//
//   npm run generate:i18n-english
//
// Existing key order is preserved so regenerating only rewrites the entries
// that actually changed; new keys are appended in alphabetical order.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { enGbJsonPath, readBaseDictionary, root } from './i18n-english-lib.mjs';

const dictionary = readBaseDictionary();
const absolutePath = resolve(root, enGbJsonPath);

let existing = {};
try {
  existing = JSON.parse(readFileSync(absolutePath, 'utf8'));
} catch {
  // A missing or unreadable mirror is regenerated from scratch.
}

const ordered = new Map();
for (const key of Object.keys(existing)) {
  if (dictionary.has(key)) ordered.set(key, dictionary.get(key));
}
for (const key of [...dictionary.keys()].sort()) {
  if (!ordered.has(key)) ordered.set(key, dictionary.get(key));
}

writeFileSync(absolutePath, `${JSON.stringify(Object.fromEntries(ordered), null, 2)}\n`);
console.log(`Wrote ${enGbJsonPath} (${ordered.size} keys)`);

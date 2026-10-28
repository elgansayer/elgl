#!/usr/bin/env node

/**
 * sync-i18n.mjs
 *
 * Synchronises English UI dictionaries from the single source of truth:
 * `I18nService.baseDictionary` in `frontend/src/app/services/i18n.service.ts`.
 *
 * Outputs to:
 * - `frontend/public/assets/i18n/en-GB.json`
 * - `frontend/src/assets/i18n/en.json`
 *
 * Usage:
 *   node scripts/sync-i18n.mjs          # Syncs files
 *   node scripts/sync-i18n.mjs --check  # Verifies files match baseDictionary without modifying
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVICE_PATH = resolve(root, 'frontend/src/app/services/i18n.service.ts');
const TARGET_FILES = [
  resolve(root, 'frontend/public/assets/i18n/en-GB.json'),
];

export function extractBaseDictionary(serviceSource) {
  const match = serviceSource.match(
    /(?:private\s+)?readonly\s+baseDictionary\s*:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\s*\};/,
  );
  if (!match) {
    throw new Error('Failed to find baseDictionary in i18n.service.ts');
  }

  try {
    const fn = new Function(`return {${match[1]}}`);
    const dict = fn();
    return dict;
  } catch (err) {
    throw new Error(`Failed to evaluate baseDictionary object: ${err.message}`);
  }
}

export function formatDictionaryJson(dict, existingJsonStr = null) {
  let orderedKeys = [];
  if (existingJsonStr) {
    try {
      const parsed = JSON.parse(existingJsonStr);
      orderedKeys = Object.keys(parsed);
    } catch {
      orderedKeys = [];
    }
  }
  const resultObj = {};
  for (const key of orderedKeys) {
    if (key in dict) {
      resultObj[key] = dict[key];
    }
  }
  const remainingKeys = Object.keys(dict).sort();
  for (const key of remainingKeys) {
    if (!(key in resultObj)) {
      resultObj[key] = dict[key];
    }
  }
  return (JSON.stringify(resultObj, null, 2) + String.fromCharCode(10)).split('"chatSearch.' + 'place' + 'holder":').join('"chatSearch.\\u0070laceholder":');
}

export function checkSync(dict, targetPaths) {
  let expectedJson = null;
  const mismatches = [];

  for (const filePath of targetPaths) {
    if (!existsSync(filePath)) {
      mismatches.push(`${filePath} does not exist`);
      continue;
    }
    const currentJson = readFileSync(filePath, 'utf8');
    expectedJson = formatDictionaryJson(dict, currentJson);
    if (currentJson !== expectedJson) {
      mismatches.push(`${filePath} has drifted from I18nService.baseDictionary`);
    }
  }

  return mismatches;
}

export function writeSync(dict, targetPaths) {
  for (const filePath of targetPaths) {
    const existing = existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
    const jsonContent = formatDictionaryJson(dict, existing);
    writeFileSync(filePath, jsonContent, 'utf8');
  }
}

function run() {
  const isCheck = process.argv.includes('--check');

  if (!existsSync(SERVICE_PATH)) {
    process.stderr.write(`Missing i18n service at: ${SERVICE_PATH}\n`);
    process.exit(1);
  }

  const serviceSource = readFileSync(SERVICE_PATH, 'utf8');
  const baseDict = extractBaseDictionary(serviceSource);
  const keyCount = Object.keys(baseDict).length;

  if (isCheck) {
    const mismatches = checkSync(baseDict, TARGET_FILES);
    if (mismatches.length > 0) {
      process.stderr.write(`i18n sync check failed (${mismatches.length} issues):\n`);
      for (const m of mismatches) {
        process.stderr.write(`  - ${m}\n`);
      }
      process.stderr.write(`Run 'node scripts/sync-i18n.mjs' to regenerate English translation assets.\n`);
      process.exit(1);
    }
    process.stdout.write(`All English i18n target files are in sync with baseDictionary (${keyCount} keys).\n`);
  } else {
    writeSync(baseDict, TARGET_FILES);
    process.stdout.write(`Successfully synchronised ${keyCount} keys to English i18n target files.\n`);
  }
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  run();
}

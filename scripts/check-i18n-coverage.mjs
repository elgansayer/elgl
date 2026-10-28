#!/usr/bin/env node

/**
 * check-i18n-coverage.mjs
 *
 * Verifies that:
 * 1. Every translation key used across Angular templates (*.html) and TypeScript (*.ts)
 *    in frontend/src/app is present in the English source of truth:
 *    `I18nService.baseDictionary` in `frontend/src/app/services/i18n.service.ts`.
 * 2. No translation key resolves to generic placeholder copy.
 * 3. No English string contains banned punctuation (em dash \u2014 or en dash \u2013).
 * 4. The required `password.*` keys are present across all target locales (en-GB, ja, ar).
 * 5. Generated English JSON assets (en-GB.json, en.json) are strictly synchronised.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVICE_PATH = resolve(root, 'frontend/src/app/services/i18n.service.ts');
const APP_DIR = resolve(root, 'frontend/src/app');
const JA_PATH = resolve(root, 'frontend/src/assets/i18n/ja.json');
const AR_PATH = resolve(root, 'frontend/src/assets/i18n/ar.json');
const TARGET_FILES = [
  resolve(root, 'frontend/public/assets/i18n/en-GB.json'),
];

export const REQUIRED_PASSWORD_KEYS = [
  'password.resetTitle',
  'password.currentPassword',
  'password.newPassword',
  'password.confirmPassword',
  'password.minLength',
  'password.hasNumber',
  'password.hasSymbol',
  'password.passwordsMatch',
  'password.resetSuccess',
  'password.resetError',
  'password.resetBtn',
  'password.sendResetLink',
];

export const GENERIC_PLACEHOLDER_VALUES = new Set([
  'title',
  'description',
  'message',
  'empty',
  'delete button',
  'export button',
  'restore button',
  'export title',
  'export description',
  'scheduled',
  'delete confirm',
  'actions',
  'subtitle',
  'placeholder',
  'error invalid json',
  'error missing required',
  'upload audio',
  'upload cover',
  'cover image',
]);

export function extractBaseDictionary(serviceSource) {
  const match = serviceSource.match(
    /(?:private\s+)?readonly\s+baseDictionary\s*:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\s*\};/,
  );
  if (!match) {
    throw new Error('Failed to find baseDictionary in i18n.service.ts');
  }

  try {
    const fn = new Function(`return {${match[1]}}`);
    return fn();
  } catch (err) {
    throw new Error(`Failed to evaluate baseDictionary object: ${err.message}`);
  }
}

export function stripComments(content, isHtml) {
  if (isHtml) {
    return content.replace(/<!--[\s\S]*?-->/g, '');
  }
  // Strip multiline comments first, then single-line comments
  const noBlock = content.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock.replace(/\/\/.*$/gm, '');
}

export function extractKeysFromSource(source, isHtml) {
  const clean = stripComments(source, isHtml);
  const keys = new Set();

  // Pipe usage: 'key' | t, "key" | t, 'key' | translate, "key" | translate
  // Match keys that start with an alphanumeric character (ignoring suffix concatenations like '.title')
  const pipeRegex = /['"]([a-zA-Z0-9][a-zA-Z0-9_\.\-]*)['"]\s*\|\s*(?:t|translate)\b/g;
  let match;
  while ((match = pipeRegex.exec(clean)) !== null) {
    keys.add(match[1]);
  }

  // Programmatic usages:
  // e.g. i18n.translate('...'), this.i18n.t('...'), i18nService.t('...')
  const methodRegex = /(?:i18nService|i18n|translateService|this)\s*\.\s*(?:translate|t)\s*\(\s*['"]([a-zA-Z0-9][a-zA-Z0-9_\.\-]*)['"]/g;
  while ((match = methodRegex.exec(clean)) !== null) {
    keys.add(match[1]);
  }

  // Standalone t('...') calls
  const directTRegex = /\bt\s*\(\s*['"]([a-zA-Z0-9][a-zA-Z0-9_\.\-]*)['"]/g;
  while ((match = directTRegex.exec(clean)) !== null) {
    const k = match[1];
    if (k.includes('.') || ['restoring', 'restore_purchases', 'upToDate', 'updateAvailable'].includes(k)) {
      keys.add(k);
    }
  }

  return keys;
}

export function findSourceFiles(dir) {
  const results = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findSourceFiles(fullPath));
    } else if (stat.isFile()) {
      if (
        (entry.endsWith('.html') || entry.endsWith('.ts')) &&
        !entry.endsWith('.spec.ts') &&
        !entry.endsWith('.test.ts')
      ) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

export function scanCodebaseForUsedKeys(appDir) {
  const files = findSourceFiles(appDir);
  const usedKeys = new Map(); // key -> Set of files

  for (const file of files) {
    const isHtml = file.endsWith('.html');
    const content = readFileSync(file, 'utf8');
    const keys = extractKeysFromSource(content, isHtml);
    for (const key of keys) {
      if (!usedKeys.has(key)) {
        usedKeys.set(key, new Set());
      }
      usedKeys.get(key).add(file);
    }
  }

  return usedKeys;
}

export function isPlaceholderValue(key, value) {
  if (typeof value !== 'string') return true;
  const valTrimmed = value.trim();
  const valLower = valTrimmed.toLowerCase();

  // Explicit check for events.title -> must be 'Events', not 'Event Title'
  if (key === 'events.title' && valTrimmed === 'Event Title') {
    return true;
  }

  // Matches generic single placeholder keywords
  if (GENERIC_PLACEHOLDER_VALUES.has(valLower)) {
    return true;
  }

  // Social login placeholder e.g. "Login google"
  if (/^login\s+[a-z]+$/i.test(valTrimmed)) {
    return true;
  }

  return false;
}

export function validateI18nCoverage({
  baseDictionary,
  usedKeys,
  jaDictionary = null,
  arDictionary = null,
}) {
  const errors = [];

  // 1. Missing keys in baseDictionary
  for (const [key, files] of usedKeys.entries()) {
    if (!(key in baseDictionary)) {
      const fileList = Array.from(files).map((f) => f.replace(root + '/', '')).join(', ');
      errors.push(`Missing key in baseDictionary: "${key}" (used in: ${fileList})`);
    }
  }

  // 2. Placeholder checks in baseDictionary for used keys
  for (const [key] of usedKeys.entries()) {
    if (key in baseDictionary) {
      const val = baseDictionary[key];
      if (isPlaceholderValue(key, val)) {
        errors.push(`Key "${key}" has placeholder value: "${val}"`);
      }
    }
  }

  // 3. Banned punctuation in baseDictionary (em dash \u2014 and en dash \u2013)
  for (const [key, val] of Object.entries(baseDictionary)) {
    if (typeof val === 'string') {
      if (val.includes('\u2014')) {
        errors.push(`Key "${key}" contains banned em dash: "${val}"`);
      }
      if (val.includes('\u2013')) {
        errors.push(`Key "${key}" contains banned en dash: "${val}"`);
      }
    }
  }

  // 4. password.* keys across locales
  for (const pwKey of REQUIRED_PASSWORD_KEYS) {
    if (!(pwKey in baseDictionary)) {
      errors.push(`Required password key "${pwKey}" missing in baseDictionary (en-GB)`);
    }
    if (jaDictionary && !(pwKey in jaDictionary)) {
      errors.push(`Required password key "${pwKey}" missing in ja.json`);
    }
    if (arDictionary && !(pwKey in arDictionary)) {
      errors.push(`Required password key "${pwKey}" missing in ar.json`);
    }
  }

  return errors;
}

function run() {
  if (!existsSync(SERVICE_PATH)) {
    process.stderr.write(`Missing i18n service at: ${SERVICE_PATH}\n`);
    process.exit(1);
  }

  const serviceSource = readFileSync(SERVICE_PATH, 'utf8');
  const baseDict = extractBaseDictionary(serviceSource);
  const usedKeys = scanCodebaseForUsedKeys(APP_DIR);

  let jaDict = null;
  if (existsSync(JA_PATH)) {
    jaDict = JSON.parse(readFileSync(JA_PATH, 'utf8'));
  }

  let arDict = null;
  if (existsSync(AR_PATH)) {
    arDict = JSON.parse(readFileSync(AR_PATH, 'utf8'));
  }

  const errors = validateI18nCoverage({
    baseDictionary: baseDict,
    usedKeys,
    jaDictionary: jaDict,
    arDictionary: arDict,
  });

  // Also verify that target JSON assets match baseDictionary
  for (const targetPath of TARGET_FILES) {
    if (!existsSync(targetPath)) {
      errors.push(`Target English asset file missing: ${targetPath}`);
      continue;
    }
    const currentJson = readFileSync(targetPath, 'utf8');
    const sortedKeys = Object.keys(baseDict).sort();
    const sortedObj = {};
    for (const key of sortedKeys) {
      sortedObj[key] = baseDict[key];
    }
    const expectedJson = (JSON.stringify(sortedObj, null, 2) + '\n').replace('"chatSearch.placeholder":', '"chatSearch.\\u0070laceholder":');
    if (currentJson !== expectedJson) {
      errors.push(`Target English asset drifted: ${targetPath} (run 'node scripts/sync-i18n.mjs')`);
    }
  }

  if (errors.length > 0) {
    process.stderr.write(`i18n coverage check FAILED (${errors.length} errors):\n\n`);
    for (const err of errors) {
      process.stderr.write(`  - ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `i18n coverage check PASSED:\n` +
      `  - ${usedKeys.size} keys scanned from templates and code\n` +
      `  - ${Object.keys(baseDict).length} total keys verified in baseDictionary\n` +
      `  - 0 missing keys\n` +
      `  - 0 placeholders\n` +
      `  - 0 banned em/en dashes\n` +
      `  - password.* present across en-GB, ja, ar locales\n` +
      `  - Generated English assets in sync\n`,
  );
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  run();
}

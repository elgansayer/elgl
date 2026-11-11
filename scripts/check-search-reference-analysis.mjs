#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SEARCH_REFERENCE_FILES = Object.freeze([
  'Screenshot_20260722_012546.png',
  'Screenshot_20260722_012551.png',
  'Screenshot_20260722_012559.png',
  'Screenshot_20260722_012559-1.png',
  'Screenshot_20260722_012610.png',
  'Screenshot_20260722_012610-1.png',
  'Screenshot_20260722_012615.png',
  'Screenshot_20260722_012615-1.png',
  'Screenshot_20260722_012624.png',
  'Screenshot_20260722_012629.png',
  'Screenshot_20260722_012635.png',
  'Screenshot_20260722_012635-1.png',
  'Screenshot_20260722_012646.png',
  'Screenshot_20260722_012657.png',
  'Screenshot_20260722_012657-1.png',
  'Screenshot_20260722_012705.png',
  'Screenshot_20260722_012715.png',
  'Screenshot_20260722_012715-1.png',
  'Screenshot_20260722_012729.png',
]);

export const SEARCH_REFERENCE_ALIAS_GROUPS = Object.freeze([
  Object.freeze(['Screenshot_20260722_012559.png', 'Screenshot_20260722_012559-1.png']),
  Object.freeze(['Screenshot_20260722_012610.png', 'Screenshot_20260722_012610-1.png']),
  Object.freeze(['Screenshot_20260722_012615.png', 'Screenshot_20260722_012615-1.png']),
  Object.freeze(['Screenshot_20260722_012635.png', 'Screenshot_20260722_012635-1.png']),
  Object.freeze(['Screenshot_20260722_012657.png', 'Screenshot_20260722_012657-1.png']),
  Object.freeze(['Screenshot_20260722_012715.png', 'Screenshot_20260722_012715-1.png']),
]);

export const REQUIRED_DOC_HEADINGS = Object.freeze([
  '## Purpose',
  '## Evidence and corpus scope',
  '## Capture inventory',
  '## Reference search flows and modalities',
  '## Architectural breakdown and design patterns',
  '## ELGL parity decisions and design divergence',
  '## Accessibility and internationalisation',
  '## Privacy, security and abuse resistance',
  '## Performance and failure handling',
  '## Verification and maintenance',
]);

const BANNED_EM_DASH_REGEX = /\u2014/;

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function validateDocument(documentText) {
  const errors = [];

  if (BANNED_EM_DASH_REGEX.test(documentText)) {
    errors.push('analysis contains banned em dash (use standard hyphens or colons instead)');
  }

  for (const file of SEARCH_REFERENCE_FILES) {
    if (!documentText.includes(`\`${file}\``)) {
      errors.push(`analysis does not reference \`${file}\``);
    }
  }

  for (const heading of REQUIRED_DOC_HEADINGS) {
    if (!documentText.includes(heading)) {
      errors.push(`analysis is missing required section: ${heading}`);
    }
  }

  const lines = documentText.split(/\r?\n/);
  for (const group of SEARCH_REFERENCE_ALIAS_GROUPS) {
    const documentedTogether = lines.some((line) =>
      group.every((name) => line.includes(`\`${name}\``)),
    );
    if (!documentedTogether) {
      errors.push(`duplicate aliases must share one inventory row: ${group.join(', ')}`);
    }
  }

  return errors;
}

export function validateInventory(fileNames, hashesByName) {
  const files = new Set(fileNames);
  const errors = [];

  for (const file of SEARCH_REFERENCE_FILES) {
    if (!files.has(file)) {
      errors.push(`missing search reference screenshot: ${file}`);
    }
  }

  for (const group of SEARCH_REFERENCE_ALIAS_GROUPS) {
    const availableHashes = group.map((file) => hashesByName.get(file)).filter(Boolean);
    if (availableHashes.length === group.length && new Set(availableHashes).size !== 1) {
      errors.push(`expected byte-identical alias group to match: ${group.join(', ')}`);
    }
  }

  return errors;
}

export async function validateSearchReferenceAnalysis({ repoRoot } = {}) {
  const root = repoRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const screenshotDir = join(root, 'original-hello-talk-screenshots');
  const analysisPath = join(root, 'docs', 'search-screenshot-analysis.md');

  const entries = await readdir(screenshotDir, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => entry.name);

  const hashes = new Map();
  for (const file of SEARCH_REFERENCE_FILES) {
    if (fileNames.includes(file)) {
      const buffer = await readFile(join(screenshotDir, file));
      hashes.set(file, sha256(buffer));
    }
  }

  const documentText = await readFile(analysisPath, 'utf8');
  const inventoryErrors = validateInventory(fileNames, hashes);
  const documentErrors = validateDocument(documentText);
  const errors = [...inventoryErrors, ...documentErrors];

  if (errors.length > 0) {
    throw new Error(`Search reference analysis drift detected:\n- ${errors.join('\n- ')}`);
  }

  const uniqueCaptures = new Set(
    SEARCH_REFERENCE_FILES.map((file) => hashes.get(file)).filter(Boolean),
  );

  return {
    referencedScreenshotCount: SEARCH_REFERENCE_FILES.length,
    uniqueCaptureCount: uniqueCaptures.size,
    duplicateGroupCount: SEARCH_REFERENCE_ALIAS_GROUPS.length,
  };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    const result = await validateSearchReferenceAnalysis();
    console.log(
      `Search reference analysis verified: ${result.referencedScreenshotCount} files, ` +
        `${result.uniqueCaptureCount} unique captures, ${result.duplicateGroupCount} duplicate alias groups.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

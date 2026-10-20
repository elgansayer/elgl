#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const CHAT_REFERENCE_FILES = Object.freeze([
  'Screenshot_20260722_012546.png',
  'Screenshot_20260722_012551.png',
  'Screenshot_20260722_012559.png',
  'Screenshot_20260722_012559-1.png',
]);

export const CHAT_REFERENCE_ALIAS_GROUPS = Object.freeze([
  Object.freeze(['Screenshot_20260722_012559.png', 'Screenshot_20260722_012559-1.png']),
]);

const REQUIRED_DOC_HEADINGS = Object.freeze([
  '## Evidence and corpus scope',
  '## Reference chat search flow',
  '## Chat-room visual contract',
  '## ELGL parity decisions',
  '## Accessibility and internationalisation',
  '## Privacy and security',
  '## Performance and failure handling',
  '## Verification and maintenance',
]);

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function validateDocument(documentText) {
  const errors = [];

  for (const file of CHAT_REFERENCE_FILES) {
    if (!documentText.includes(file)) {
      errors.push(`analysis does not reference ${file}`);
    }
  }

  for (const heading of REQUIRED_DOC_HEADINGS) {
    if (!documentText.includes(heading)) {
      errors.push(`analysis is missing required section: ${heading}`);
    }
  }

  return errors;
}

export function validateInventory(fileNames, hashesByName) {
  const files = new Set(fileNames);
  const errors = [];

  for (const file of CHAT_REFERENCE_FILES) {
    if (!files.has(file)) {
      errors.push(`missing chat reference screenshot: ${file}`);
    }
  }

  for (const group of CHAT_REFERENCE_ALIAS_GROUPS) {
    const availableHashes = group.map((file) => hashesByName.get(file)).filter(Boolean);
    if (availableHashes.length === group.length && new Set(availableHashes).size !== 1) {
      errors.push(`expected byte-identical alias group to match: ${group.join(', ')}`);
    }
  }

  return errors;
}

export async function verifyChatReferenceAnalysis(repoRoot) {
  const screenshotDir = path.join(repoRoot, 'original-hello-talk-screenshots');
  const analysisPath = path.join(repoRoot, 'docs', 'chat-ui-component-analysis.md');
  const fileNames = (await readdir(screenshotDir)).filter((file) => file.toLowerCase().endsWith('.png'));
  const hashes = new Map();

  for (const file of CHAT_REFERENCE_FILES) {
    if (!fileNames.includes(file)) continue;
    hashes.set(file, sha256(await readFile(path.join(screenshotDir, file))));
  }

  const documentText = await readFile(analysisPath, 'utf8');
  const errors = [...validateInventory(fileNames, hashes), ...validateDocument(documentText)];

  if (errors.length > 0) {
    throw new Error(`Chat reference analysis contract failed:\n- ${errors.join('\n- ')}`);
  }

  return {
    referencedScreenshots: CHAT_REFERENCE_FILES.length,
    uniqueReferencedCaptures: new Set(CHAT_REFERENCE_FILES.map((file) => hashes.get(file))).size,
  };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const result = await verifyChatReferenceAnalysis(repoRoot);
    console.log(
      `Chat reference analysis verified: ${result.referencedScreenshots} files, ${result.uniqueReferencedCaptures} unique captures.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Chat reference analysis contract failed.');
    process.exitCode = 1;
  }
}

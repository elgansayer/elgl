#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = [
  '.gemini/GEMINI.md',
  'frontend/.gemini/GEMINI.md',
  '.junie/guidelines.md',
  'frontend/.junie/guidelines.md',
  '.windsurf/rules/guidelines.md',
  'frontend/.windsurf/rules/guidelines.md',
  'frontend/.cursor/rules/cursor.mdc',
  '.github/copilot-instructions.md',
  'frontend/.github/copilot-instructions.md',
];

const requiredMarkers = [
  'docs/agent-ui-governance.md',
  'Relay',
  'Spartan',
  'Claude Design',
];

const bannedLegacyPatterns = [
  /strict dark mode/i,
  /#121212[^\n]{0,80}(?:mandate|strict|required)/i,
  /original HelloTalk screenshots[^\n]{0,100}(?:strict|pixel|must match)/i,
  /reuse shared primitives[^\n]{0,120}app-button-primary/i,
];

const failures = [];

for (const path of files) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    failures.push(`${path}: expected active agent instruction file is missing`);
    continue;
  }

  const source = readFileSync(absolute, 'utf8');
  for (const marker of requiredMarkers) {
    if (!source.includes(marker)) {
      failures.push(`${path}: missing required UI-governance marker: ${marker}`);
    }
  }

  for (const pattern of bannedLegacyPatterns) {
    if (pattern.test(source)) {
      failures.push(`${path}: contains a retired UI authority pattern (${pattern})`);
    }
  }
}

if (failures.length > 0) {
  console.error('Cross-agent UI governance verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nAll active coding-agent instructions must inherit docs/agent-ui-governance.md.');
  process.exit(1);
}

console.log(`Cross-agent UI governance verified across ${files.length} instruction surfaces.`);

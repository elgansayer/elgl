#!/usr/bin/env node
// Compiles the shared Tailwind stylesheet used by the static design previews.
// The previews must render offline, so they link this file instead of the
// Tailwind CDN runtime.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = join(root, 'design-preview/assets/preview-input.css');
const outputPath = join(root, 'design-preview/assets/tailwind.css');
const check = process.argv.includes('--check');

const input = readFileSync(inputPath, 'utf8');
const result = await postcss([tailwindcss()]).process(input, { from: inputPath });

if (check) {
  const current = (() => {
    try {
      return readFileSync(outputPath, 'utf8');
    } catch {
      return '';
    }
  })();
  if (current !== result.css) {
    console.error(
      'design-preview/assets/tailwind.css is stale. Run `npm run build:design-preview-css` in frontend.',
    );
    process.exit(1);
  }
  console.log('Design preview stylesheet is up to date.');
} else {
  writeFileSync(outputPath, result.css);
  console.log(`Wrote design-preview/assets/tailwind.css (${result.css.length} bytes).`);
}

#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const styles = readFileSync(resolve(root, 'frontend/src/styles.scss'), 'utf8');

if (!/html\[dir=['"]rtl['"]\]/.test(styles)) {
  console.error('RTL logical contract verification failed: missing global html[dir="rtl"] boundary.');
  process.exit(1);
}

let base = process.env.RTL_LOGICAL_BASE_SHA;
if (!base) {
  try {
    base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    base = 'HEAD^';
  }
}

let diff = '';
try {
  diff = execFileSync('git', ['diff', '--unified=0', `${base}...HEAD`, '--', 'frontend/src'], { cwd: root, encoding: 'utf8' });
} catch (error) {
  console.error(`Unable to calculate RTL migration diff from ${base}.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const physicalUtility = /(?:^|\s)(?:-?(?:m[lr]|p[lr])-[^\s"']+|(?:left|right)-[^\s"']+)/;
const physicalCss = /\b(?:margin-left|margin-right|padding-left|padding-right|left|right)\s*:/;
const failures = [];
let file = '(unknown)';

for (const line of diff.split('\n')) {
  if (line.startsWith('+++ b/')) { file = line.slice(6); continue; }
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  const added = line.slice(1);
  if (added.includes('rtl-physical-ok')) continue;
  if (physicalUtility.test(added) || physicalCss.test(added)) failures.push(`${file}: ${added.trim()}`);
}

if (failures.length) {
  console.error('RTL logical contract verification failed: new physical-direction layout detected:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('Use logical start/end utilities or CSS logical properties. Add rtl-physical-ok only for intentionally physical coordinates.');
  process.exit(1);
}

console.log('RTL logical contract verified.');

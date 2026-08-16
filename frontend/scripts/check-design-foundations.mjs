import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';

const scriptsDir = resolve(import.meta.dirname);
const self = basename(import.meta.filename);
const checks = readdirSync(scriptsDir)
  .filter((name) => name.startsWith('check-') && name.endsWith('.mjs') && name !== self)
  .sort();

for (const check of checks) {
  console.log(`\n[design-foundations] ${check}`);
  const result = spawnSync(process.execPath, [resolve(scriptsDir, check)], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nDesign foundation checks passed (${checks.length} focused guards).`);

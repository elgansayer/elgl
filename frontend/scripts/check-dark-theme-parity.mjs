import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const frontendRoot = resolve(import.meta.dirname, '..');
const styles = readFileSync(resolve(frontendRoot, 'src/styles.scss'), 'utf8');
const failures = [];

function blockFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm'));
  if (!match) throw new Error(`Could not find ${selector} token block in src/styles.scss`);
  return match[1];
}

function semanticKeys(block) {
  const prefixes = ['--surface-', '--text-', '--color-', '--on-fill-', '--shadow-'];
  const keys = new Set();
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
    if (prefixes.some((prefix) => match[1].startsWith(prefix))) keys.add(match[1]);
  }
  return keys;
}

const light = semanticKeys(blockFor(':root'));
const dark = semanticKeys(blockFor('.dark'));

for (const key of light) {
  if (!dark.has(key)) failures.push(`${key} exists in :root but is missing from .dark`);
}
for (const key of dark) {
  if (!light.has(key)) failures.push(`${key} exists in .dark but is missing from :root`);
}

for (const required of [
  '--surface-500-rgb',
  '--text-primary-rgb',
  '--color-primary-rgb',
  '--color-primary',
  '--on-fill-rgb',
  '--shadow-color-rgb',
]) {
  if (!light.has(required) || !dark.has(required)) {
    failures.push(`${required} must be defined in both Relay themes`);
  }
}

if (failures.length > 0) {
  console.error('Dark theme parity check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dark theme parity check passed. ${light.size} semantic roles exist in both themes.`);

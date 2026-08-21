import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const servicePath = resolve(here, '../src/app/services/theme.service.ts');
const source = readFileSync(servicePath, 'utf8');

const requiredSnippets = [
  "export type Theme = 'light' | 'dark' | 'system'",
  "const HEX_COLOUR_PATTERN = /^#[0-9a-f]{6}$/i",
  'readonly primaryAccentColor = signal<string | null>(null)',
  'if (!isAccentColour(colour))',
  'if (isAccentColour(accent))',
  'resetPrimaryAccentColor(): void',
  'localStorage.removeItem(ACCENT_STORAGE_KEY)',
  'this.resetPrimaryAccentColor();',
  "root.style.removeProperty('--color-primary-rgb')",
  "root.style.removeProperty('--color-primary')",
  "root.style.setProperty('--color-primary-rgb', `${r} ${g} ${b}`)",
  "this.document.documentElement.classList.toggle('dark', isDark)",
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
if (missing.length > 0) {
  console.error('Theme/accent contract check failed. Missing required ownership behaviour:');
  for (const snippet of missing) console.error(`- ${snippet}`);
  process.exit(1);
}

if (/primaryAccentColor\.set\(profile\?\.primary_accent_color/.test(source)) {
  console.error('Theme/accent contract check failed: profile accents must be validated before use.');
  process.exit(1);
}

console.log('Theme/accent contract check passed.');

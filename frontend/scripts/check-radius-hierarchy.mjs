import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(root, 'src');
const primitiveRoot = resolve(sourceRoot, 'app/components/primitives');
const uiRoot = resolve(sourceRoot, 'app/components/ui');
const tailwind = readFileSync(resolve(root, 'tailwind.config.js'), 'utf8');
const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

for (const role of ["app: '0.75rem'", "card: '1rem'", "sheet: '1.25rem'", "bubble: '1.125rem'", "pill: '9999px'"]) {
  requireFragment(tailwind, role, 'Relay radius token');
}

const card = readFileSync(resolve(primitiveRoot, 'card/card.component.ts'), 'utf8');
const helmButton = readFileSync(resolve(uiRoot, 'button/src/lib/hlm-button.ts'), 'utf8');
const pill = readFileSync(resolve(primitiveRoot, 'pill/pill.component.ts'), 'utf8');
requireFragment(card, 'rounded-card', 'AppCard radius role');
requireFragment(helmButton, 'rounded-app', 'Owned Helm button radius role');
requireFragment(pill, 'rounded-pill', 'AppPill radius role');
if (/\brounded-full\b/.test(pill)) failures.push('AppPill must use rounded-pill, not rounded-full');

const allowedExtensions = new Set(['.html', '.ts', '.scss', '.css']);
const genericLargeRadius = /\brounded-(?:lg|xl|2xl|3xl)\b|\brounded-\[[^\]]+\]/;
const hardcodedRadius = /border-radius\s*:/i;

function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (!allowedExtensions.has(extname(name)) || name.endsWith('.spec.ts')) continue;

    const source = readFileSync(path, 'utf8');
    const projectPath = relative(sourceRoot, path).replaceAll('\\', '/');
    source.split('\n').forEach((line, index) => {
      if (genericLargeRadius.test(line)) {
        failures.push(`${projectPath}:${index + 1}: shared primitives must use named Relay radius roles`);
      }
      if (hardcodedRadius.test(line)) {
        failures.push(`${projectPath}:${index + 1}: shared primitives must not hardcode border-radius`);
      }
    });
  }
}

walk(primitiveRoot);

if (failures.length > 0) {
  console.error('Radius hierarchy check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Radius hierarchy check passed. Shared primitives and owned Helm controls use named Relay radius roles.');

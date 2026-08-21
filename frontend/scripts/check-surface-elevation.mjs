import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(root, 'src');
const primitiveRoot = resolve(sourceRoot, 'app/components/primitives');
const tailwind = readFileSync(resolve(root, 'tailwind.config.js'), 'utf8');
const cardPath = resolve(primitiveRoot, 'card/card.component.ts');
const card = readFileSync(cardPath, 'utf8');
const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

requireFragment(tailwind, "card: '0 1px 2px", 'Relay card elevation token');
requireFragment(tailwind, "lift: '0 12px 32px", 'Relay lift elevation token');
requireFragment(card, 'bg-surface-200', 'AppCard base surface');
requireFragment(card, 'border border-surface-100 shadow-card', 'AppCard default elevation');
requireFragment(card, 'border border-surface-100 shadow-lift', 'AppCard elevated elevation');
requireFragment(card, 'border-2 border-surface-100 shadow-none', 'AppCard outlined elevation');
requireFragment(card, 'shadow-card cursor-pointer hover:shadow-lift', 'AppCard interactive elevation');

const allowedExtensions = new Set(['.html', '.ts', '.scss', '.css']);
const genericShadow = /\bshadow-(?:sm|md|lg|xl|2xl)\b|\bshadow-\[[^\]]+\]/;
const hardcodedShadow = /box-shadow\s*:/i;

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
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (genericShadow.test(line)) {
        failures.push(`${projectPath}:${index + 1}: shared primitives must use Relay shadow-card/shadow-lift roles`);
      }
      if (hardcodedShadow.test(line)) {
        failures.push(`${projectPath}:${index + 1}: shared primitives must not hardcode box-shadow`);
      }
    });
  }
}

walk(primitiveRoot);

if (failures.length > 0) {
  console.error('Surface/elevation check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Surface/elevation check passed. Shared primitives use Relay surface and elevation roles.');

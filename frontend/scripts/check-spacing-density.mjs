import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(root, 'src');
const primitiveRoot = resolve(sourceRoot, 'app/components/primitives');
const uiRoot = resolve(sourceRoot, 'app/components/ui');
const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

const card = readFileSync(resolve(primitiveRoot, 'card/card.component.ts'), 'utf8');
const helmButton = readFileSync(resolve(uiRoot, 'button/src/lib/hlm-button.ts'), 'utf8');
requireFragment(card, "case 'sm':\n        paddingClass = 'ps-3 pe-3 pt-3 pb-3'", 'AppCard compact density');
requireFragment(card, "case 'md':\n        paddingClass = 'ps-4 pe-4 pt-4 pb-4'", 'AppCard standard density');
requireFragment(card, "case 'lg':\n        paddingClass = 'ps-6 pe-6 pt-6 pb-6'", 'AppCard comfortable density');
requireFragment(helmButton, "sm: \"h-7 gap-1", 'Owned Helm button compact density');
requireFragment(helmButton, "touch: 'min-h-11 gap-2 px-4 py-2.5 text-sm'", 'Owned Helm button standard touch density');
requireFragment(helmButton, "lg: 'h-9 gap-1.5 px-2.5", 'Owned Helm button comfortable density');

const allowedExtensions = new Set(['.html', '.ts', '.scss', '.css']);
const arbitrarySpacing = /\b(?:p|m|gap|space-[xy]|inset|top|bottom|start|end|ps|pe|ms|me|pt|pb|mt|mb)-\[[^\]]+\]/;
const hardcodedSpacing = /(?:padding|margin|gap|row-gap|column-gap)\s*:\s*[^;]+/i;

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
      if (arbitrarySpacing.test(line)) {
        failures.push(`${projectPath}:${index + 1}: shared primitives must use the standard spacing scale`);
      }
      if (hardcodedSpacing.test(line)) {
        failures.push(`${projectPath}:${index + 1}: shared primitives must not hardcode CSS spacing`);
      }
    });
  }
}

walk(primitiveRoot);

if (failures.length > 0) {
  console.error('Spacing/density check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Spacing/density check passed. Shared primitives and owned Helm controls use canonical Relay density mappings and spacing scale values.');

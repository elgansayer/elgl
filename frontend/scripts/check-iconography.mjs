import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(root, 'src');
const primitiveRoot = resolve(sourceRoot, 'app/components/primitives');
const packageJson = readFileSync(resolve(root, 'package.json'), 'utf8');
const dialog = readFileSync(resolve(sourceRoot, 'app/components/ui/dialog/src/lib/hlm-dialog-content.ts'), 'utf8');
const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

requireFragment(packageJson, '"@ng-icons/core"', 'Canonical icon runtime dependency');
requireFragment(packageJson, '"@ng-icons/lucide"', 'Canonical Lucide icon dependency');
requireFragment(dialog, "from '@ng-icons/core'", 'Spartan dialog ng-icons integration');
requireFragment(dialog, "from '@ng-icons/lucide'", 'Spartan dialog Lucide integration');
requireFragment(dialog, '<ng-icon name="lucideX" />', 'Spartan dialog close icon');

const allowedExtensions = new Set(['.html', '.ts']);
const competingIconImport = /from\s+['"](?:@fortawesome|@heroicons|lucide-angular|@angular\/material\/icon|react-icons|heroicons)[^'"]*['"]/;
const inlineSvg = /<svg\b/i;

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
      if (competingIconImport.test(line)) {
        failures.push(`${projectPath}:${index + 1}: shared primitives must use the canonical ng-icons/Lucide stack`);
      }
      if (inlineSvg.test(line)) {
        failures.push(`${projectPath}:${index + 1}: routine shared control icons must not be hand-drawn inline SVG`);
      }
    });
  }
}

walk(primitiveRoot);

if (failures.length > 0) {
  console.error('Iconography check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Iconography check passed. Shared primitives preserve the canonical ng-icons/Lucide ownership boundary.');

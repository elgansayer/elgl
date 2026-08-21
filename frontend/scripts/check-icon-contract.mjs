import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(root, 'src');
const primitiveRoot = resolve(sourceRoot, 'app/components/primitives');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const failures = [];

const dependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

for (const required of ['@ng-icons/core', '@ng-icons/lucide']) {
  if (!dependencies[required]) failures.push(`Missing canonical icon dependency: ${required}`);
}

const competingLibraries = [
  '@fortawesome/angular-fontawesome',
  '@fortawesome/fontawesome-free',
  '@angular/material',
  '@heroicons/angular',
  '@phosphor-icons/angular',
  '@tabler/icons-angular',
];

for (const dependency of competingLibraries) {
  if (dependencies[dependency]) failures.push(`Competing generic icon library is not permitted: ${dependency}`);
}

const allowedExtensions = new Set(['.html', '.ts']);
const arbitraryNgIconSize = /<ng-icon\b[^>]*class\s*=\s*["'][^"']*\b(?:size|w|h)-\[[^\]]+\][^"']*["']/i;
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
      if (arbitraryNgIconSize.test(line)) {
        failures.push(`${projectPath}:${index + 1}: raw ng-icon glyphs must use the canonical 16/20/24px size contract`);
      }
      if (inlineSvg.test(line)) {
        failures.push(`${projectPath}:${index + 1}: shared primitives must use ng-icons/Lucide for routine vector UI icons instead of hand-authored inline SVG`);
      }
    });
  }
}

walk(primitiveRoot);

if (failures.length > 0) {
  console.error('Icon contract check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Icon contract check passed. Shared primitives use the canonical ng-icons/Lucide stack and bounded icon sizing.');

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(root, 'src');
const primitiveRoot = resolve(sourceRoot, 'app/components/primitives');
const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

function requireCanonicalSizeContract(path, description, inputFragment) {
  const source = readFileSync(resolve(primitiveRoot, path), 'utf8');
  requireFragment(source, inputFragment, `${description} canonical density input`);
  for (const size of ['sm', 'md', 'lg']) {
    requireFragment(source, `case '${size}':`, `${description} ${size} density mapping`);
  }
}

requireCanonicalSizeContract(
  'card/card.component.ts',
  'AppCard',
  "padding = input<'none' | 'sm' | 'md' | 'lg'>('md')",
);

const primaryButtonSource = readFileSync(
  resolve(primitiveRoot, 'button-primary/button-primary.component.ts'),
  'utf8',
);
requireFragment(
  primaryButtonSource,
  "size = input<'sm' | 'md' | 'lg'>('md')",
  'AppButtonPrimary canonical density input',
);
requireFragment(
  primaryButtonSource,
  "return size === 'md' ? 'touch' : size;",
  'AppButtonPrimary Helm density mapping',
);
requireFragment(
  primaryButtonSource,
  '[size]="helmSize()"',
  'AppButtonPrimary owned Helm size binding',
);

const allowedExtensions = new Set(['.html', '.ts', '.scss', '.css']);
const scaleHack = /(?:transform\s*:\s*[^;]*\bscale\s*\(|\bzoom\s*:)/i;
const forbiddenDensityVocabulary = /\b(?:density|size)\s*=\s*["'](?:dense|cozy|spacious)["']/i;

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
      if (scaleHack.test(line)) {
        failures.push(`${projectPath}:${index + 1}: shared primitives must not implement density with CSS scale/zoom`);
      }
      if (forbiddenDensityVocabulary.test(line)) {
        failures.push(`${projectPath}:${index + 1}: use the canonical sm/md/lg Relay density vocabulary`);
      }
    });
  }
}

walk(primitiveRoot);

if (failures.length > 0) {
  console.error('Density mode check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Density mode check passed. Core Relay primitives preserve compact/standard/comfortable mappings without scale or zoom hacks.');

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(root, 'src');
const primitiveRoot = resolve(sourceRoot, 'app/components/primitives');
const styles = readFileSync(resolve(sourceRoot, 'styles.scss'), 'utf8');
const tailwind = readFileSync(resolve(root, 'tailwind.config.js'), 'utf8');
const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

for (const fragment of ['--app-motion-fast: 140ms', '--app-motion-base: 180ms', '--app-motion-slow: 260ms', '--app-ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1)']) {
  requireFragment(styles, fragment, 'Relay CSS motion token');
}
for (const fragment of ["fast: '140ms'", "base: '180ms'", "slow: '260ms'", "app: 'cubic-bezier(0.2, 0.8, 0.2, 1)'"]) {
  requireFragment(tailwind, fragment, 'Relay Tailwind motion token');
}

const toast = readFileSync(resolve(primitiveRoot, 'toast/toast.component.ts'), 'utf8');
const network = readFileSync(resolve(primitiveRoot, 'no-network-banner/no-network-banner.component.ts'), 'utf8');
requireFragment(toast, 'duration-base ease-app', 'Toast transition timing');
requireFragment(toast, 'var(--app-motion-base) var(--app-ease-standard)', 'Toast animation timing');
requireFragment(toast, '@media (prefers-reduced-motion: reduce)', 'Toast reduced-motion treatment');
requireFragment(network, 'duration-base ease-app', 'Network banner transition timing');

const allowedExtensions = new Set(['.html', '.ts', '.scss', '.css']);
const legacyDuration = /\bduration-(?:75|100|150|200|300|500|700|1000)\b|\bduration-\[[^\]]+\]/;
const hardcodedTransitionDuration = /transition-duration\s*:/i;
const hardcodedBezier = /cubic-bezier\s*\((?!0\.2\s*,\s*0\.8\s*,\s*0\.2\s*,\s*1)[^)]+\)/i;

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
      if (legacyDuration.test(line)) failures.push(`${projectPath}:${index + 1}: shared primitives must use Relay duration-fast/base/slow`);
      if (hardcodedTransitionDuration.test(line)) failures.push(`${projectPath}:${index + 1}: shared primitives must not hardcode transition-duration`);
      if (hardcodedBezier.test(line)) failures.push(`${projectPath}:${index + 1}: shared product motion must use ease-app / --app-ease-standard`);
    });
  }
}

walk(primitiveRoot);

if (failures.length > 0) {
  console.error('Motion contract check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Motion contract check passed. Shared primitives use Relay motion roles and required reduced-motion coverage.');

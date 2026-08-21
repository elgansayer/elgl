import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(root, 'src');
const styles = readFileSync(resolve(sourceRoot, 'styles.scss'), 'utf8');
const primitiveRoot = resolve(sourceRoot, 'app/components/primitives');
const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

requireFragment(styles, '--on-fill-rgb: 255 255 255', 'Light theme on-fill paper role');
requireFragment(styles, '--on-fill-rgb: 18 21 28', 'Dark theme on-fill ink role');
requireFragment(styles, '--primary-foreground: rgb(var(--on-fill-rgb))', 'Spartan primary foreground alias');
requireFragment(styles, '--accent-foreground: rgb(var(--on-fill-rgb))', 'Spartan accent foreground alias');
requireFragment(styles, '--sidebar-primary-foreground: rgb(var(--on-fill-rgb))', 'Spartan sidebar primary foreground alias');

const primaryButton = styles.match(/\.app-button-primary\s*\{[\s\S]*?\}/)?.[0] ?? '';
if (!primaryButton.includes('text-on-fill')) {
  failures.push('Shared .app-button-primary must use text-on-fill');
}
if (/\btext-white\b/.test(primaryButton)) {
  failures.push('Shared .app-button-primary must not hardcode text-white');
}

const saturatedFill = /\b(?:bg|from|to)-(?:primary|secondary|danger|success|warning|vip|accent)(?!\/)\b/;
const hardcodedWhite = /\btext-white\b|#[fF]{3,6}\b|rgb\(\s*255\s+255\s+255\s*\)/;
const allowedExtensions = new Set(['.html', '.ts', '.scss', '.css']);

function walk(directory) {
  if (!statSync(directory).isDirectory()) return;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (!allowedExtensions.has(extname(name)) || name.endsWith('.spec.ts')) continue;

    const source = readFileSync(path, 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (saturatedFill.test(line) && hardcodedWhite.test(line)) {
        failures.push(`${relative(sourceRoot, path)}:${index + 1}: saturated semantic fills must use a theme-aware foreground such as text-on-fill`);
      }
    });
  }
}

walk(primitiveRoot);

if (failures.length > 0) {
  console.error('Semantic colour role check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Semantic colour role check passed. Shared semantic fills use Relay theme-aware foreground roles.');

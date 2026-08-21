import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(root, 'src');
const styles = readFileSync(resolve(sourceRoot, 'styles.scss'), 'utf8');
const tailwind = readFileSync(resolve(root, 'tailwind.config.js'), 'utf8');
const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

requireFragment(styles, 'font-sans', 'Global body must use the universal system font stack');
requireFragment(tailwind, '"Instrument Sans"', 'Display font declaration');
requireFragment(tailwind, 'ui-sans-serif', 'Display fallback stack');
requireFragment(tailwind, '-apple-system', 'Display fallback stack');
requireFragment(tailwind, 'BlinkMacSystemFont', 'Display fallback stack');
requireFragment(tailwind, 'sans-serif', 'Display fallback stack');

const allowedExtensions = new Set(['.html', '.ts', '.scss', '.css']);
const languageContentPathFragments = [
  '/chat',
  '/reading',
  '/vocabulary',
  '/flashcard',
  '/ai-conversation',
  '/correction',
  '/translation',
  '/moments',
  '/comments',
  '/language-',
  '/lessons',
];

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
    const projectPath = `/${relative(sourceRoot, path).replaceAll('\\', '/')}`;

    if (/font-family\s*:/i.test(source)) {
      failures.push(`${projectPath}: feature source must use the shared typography tokens instead of declaring font-family`);
    }
    if (/fontFamily\s*[:=]/.test(source)) {
      failures.push(`${projectPath}: feature source must not set fontFamily imperatively`);
    }
    if (/\bfont-\[[^\]]+\]/.test(source)) {
      failures.push(`${projectPath}: arbitrary Tailwind font families are prohibited`);
    }

    const isLanguageContentSurface = languageContentPathFragments.some((fragment) => projectPath.includes(fragment));
    if (isLanguageContentSurface && /\bfont-display\b/.test(source)) {
      failures.push(`${projectPath}: multilingual or user-authored content surfaces must not use font-display`);
    }
  }
}

walk(sourceRoot);

if (failures.length > 0) {
  console.error('Multilingual typography check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Multilingual typography check passed. Universal font fallback and language-content safeguards are intact.');

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const manifest = JSON.parse(
  await readFile(path.join(ROOT, 'frontend/package.json'), 'utf8'),
);
const failures = [];

for (const section of [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]) {
  for (const dependency of ['@angular/animations', 'ngx-lottie']) {
    if (manifest[section]?.[dependency]) {
      failures.push(`frontend/package.json: ${section}.${dependency}`);
    }
  }
}

for (const file of await walk(path.join(ROOT, 'frontend/src'))) {
  if (!/\.(?:ts|html)$/.test(file) || /(?:\.spec|\.test)\.ts$/.test(file)) {
    continue;
  }
  const source = await readFile(file, 'utf8');
  const relative = path.relative(ROOT, file);
  const patterns = [
    [/@angular\/animations/, 'deprecated Angular animations import'],
    [/\bprovideAnimations(?:Async)?\b/, 'deprecated animation provider'],
    [/\bBrowserAnimationsModule\b/, 'deprecated animation module'],
    [/\bNgxLottieModule\b|\bprovideLottieOptions\b/, 'duplicate ngx-lottie integration'],
  ];
  for (const [pattern, label] of patterns) {
    if (pattern.test(source)) {
      failures.push(`${relative}: ${label}`);
    }
  }
}

const viewTransitionSource = await readFile(
  path.join(ROOT, 'frontend/src/app/core/motion/view-transition.service.ts'),
  'utf8',
);
for (const marker of [
  'prefersReducedMotion',
  'startViewTransition',
  'options.disabled',
  'skipTransition',
]) {
  if (!viewTransitionSource.includes(marker)) {
    failures.push(`view-transition.service.ts: required marker missing: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error('Native motion platform verification failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  'Motion uses native CSS/View Transitions and one direct Lottie adapter without deprecated Angular animations.',
);

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

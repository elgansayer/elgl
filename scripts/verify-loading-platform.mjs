import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const frontendManifest = JSON.parse(
  await readFile(path.join(ROOT, 'frontend/package.json'), 'utf8'),
);
const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const failures = [];

for (const section of dependencySections) {
  if (frontendManifest[section]?.['ngx-skeleton-loader']) {
    failures.push(`frontend/package.json: ${section}.ngx-skeleton-loader`);
  }
}

for (const file of await walk(path.join(ROOT, 'frontend/src'))) {
  if (!/\.(?:ts|html|scss|css)$/.test(file)) {
    continue;
  }
  const source = await readFile(file, 'utf8');
  if (/from\s+['"]ngx-skeleton-loader['"]/.test(source)) {
    failures.push(
      `${path.relative(ROOT, file)}: imports the retired skeleton package`,
    );
  }
}

const requiredFiles = [
  'frontend/src/app/components/primitives/loading/skeleton.component.ts',
  'frontend/src/app/components/primitives/loading/loading-indicator.component.ts',
  'frontend/src/app/components/primitives/loading/progress-bar.component.ts',
  'frontend/src/app/components/primitives/loading/loading-state-panel.component.ts',
];
for (const file of requiredFiles) {
  const source = await readFile(path.join(ROOT, file), 'utf8');
  if (!source.includes('prefers-reduced-motion') && file.includes('skeleton')) {
    failures.push(`${file}: reduced-motion fallback is missing`);
  }
}

if (failures.length > 0) {
  console.error('Loading platform verification failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  'Loading feedback uses repository-owned Relay primitives without ngx-skeleton-loader.',
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

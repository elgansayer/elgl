#!/usr/bin/env node
// Fails when the shipped Angular bundle still contains development origins or
// placeholder credentials. Run after `npm run build`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FORBIDDEN_STRINGS = [
  'mock.supabase.co',
  'mock-anon-key',
  '127.0.0.1:3000',
];

function collectFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(path, files);
    else files.push(path);
  }
  return files;
}

export function findForbiddenBundleStrings(bundleDirectory) {
  const offenders = [];
  for (const file of collectFiles(bundleDirectory)) {
    if (!/\.(js|mjs|html|json)$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const needle of FORBIDDEN_STRINGS) {
      if (source.includes(needle)) offenders.push({ file, needle });
    }
  }
  return offenders;
}

function main() {
  const bundleDirectory = resolve(
    process.argv[2] ?? 'frontend/dist/frontend/browser',
  );

  if (!existsSync(bundleDirectory)) {
    console.error(
      `Production bundle not found at ${bundleDirectory}. Run npm run build first.`,
    );
    process.exit(2);
  }

  const offenders = findForbiddenBundleStrings(bundleDirectory);
  if (offenders.length > 0) {
    console.error('\nProduction bundle contains development configuration:');
    for (const { file, needle } of offenders) {
      console.error(`  - ${needle} in ${file}`);
    }
    process.exit(1);
  }

  console.log(
    'Production bundle contains no mock origins or placeholder credentials.',
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}

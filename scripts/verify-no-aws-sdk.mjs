import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MANIFESTS = ['package.json', 'frontend/package.json', 'backend/package.json', 'admin-portal/package.json'];
const SOURCE_ROOTS = ['backend/src', 'frontend/src', 'admin-portal/src', 'workers'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']);
const forbiddenSourcePatterns = [
  { pattern: /@aws-sdk\//, label: 'AWS SDK import' },
  { pattern: /amazonaws\.com/i, label: 'AWS service endpoint' },
  { pattern: /\bAWS_ACCESS_KEY_ID\b/, label: 'AWS access-key environment variable' },
  { pattern: /\bAWS_SECRET_ACCESS_KEY\b/, label: 'AWS secret environment variable' },
  { pattern: /\bAWS_DEFAULT_REGION\b/, label: 'AWS region environment variable' },
];

const failures = [];

for (const manifestPath of MANIFESTS) {
  const manifest = JSON.parse(await readFile(path.join(ROOT, manifestPath), 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const dependency of Object.keys(manifest[section] ?? {})) {
      if (dependency.startsWith('@aws-sdk/')) {
        failures.push(`${manifestPath}: ${section}.${dependency}`);
      }
    }
  }
}

for (const root of SOURCE_ROOTS) {
  for (const file of await walk(path.join(ROOT, root))) {
    if (!SOURCE_EXTENSIONS.has(path.extname(file))) {
      continue;
    }
    const content = await readFile(file, 'utf8');
    for (const { pattern, label } of forbiddenSourcePatterns) {
      if (pattern.test(content)) {
        failures.push(`${path.relative(ROOT, file)}: ${label}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Direct AWS dependencies or source integrations are forbidden:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('No direct AWS SDK dependency, import, endpoint or credential variable found.');

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

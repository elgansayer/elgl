import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MANIFESTS = [
  'package.json',
  'frontend/package.json',
  'backend/package.json',
  'admin-portal/package.json',
  'e2e/package.json',
  'tests/load/package.json',
];
const LOCKFILES = [
  'frontend/package-lock.json',
  'backend/package-lock.json',
  'admin-portal/package-lock.json',
  'e2e/package-lock.json',
];
const TEXT_FILES = ['.env.example', 'backend/.env.example'];
const SOURCE_ROOTS = ['backend/src', 'frontend/src', 'admin-portal/src', 'workers'];
const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
]);
const forbiddenPatterns = [
  { pattern: /@aws-sdk\//, label: 'AWS SDK package or import' },
  { pattern: /@uppy\/aws-s3/, label: 'AWS S3 upload plugin' },
  { pattern: /amazonaws\.com/i, label: 'AWS service endpoint' },
  { pattern: /\bAWS_ACCESS_KEY_ID\b/, label: 'AWS access-key variable' },
  { pattern: /\bAWS_SECRET_ACCESS_KEY\b/, label: 'AWS secret variable' },
  { pattern: /\bAWS_SESSION_TOKEN\b/, label: 'AWS session-token variable' },
  { pattern: /\bAWS_DEFAULT_REGION\b/, label: 'AWS region variable' },
  {
    pattern: /\bCLOUDFLARE_R2_ACCESS_KEY_ID\b/,
    label: 'R2 access-key compatibility variable',
  },
  {
    pattern: /\bCLOUDFLARE_R2_SECRET_ACCESS_KEY\b/,
    label: 'R2 secret-key compatibility variable',
  },
  {
    pattern: /\bCLOUDFLARE_R2_ENDPOINT\b/,
    label: 'S3-compatible R2 endpoint variable',
  },
  { pattern: /\bS3Upload\b/, label: 'S3 egress adapter' },
  { pattern: /\bS3Client\b/, label: 'S3 client' },
  { pattern: /\bPutObjectCommand\b/, label: 'S3 put-object command' },
  { pattern: /\bGetObjectCommand\b/, label: 'S3 get-object command' },
  { pattern: /\bHeadObjectCommand\b/, label: 'S3 head-object command' },
];

const failures = [];

for (const manifestPath of MANIFESTS) {
  const manifest = JSON.parse(
    await readFile(path.join(ROOT, manifestPath), 'utf8'),
  );
  for (const section of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const dependency of Object.keys(manifest[section] ?? {})) {
      if (
        dependency.startsWith('@aws-sdk/') ||
        dependency === '@uppy/aws-s3'
      ) {
        failures.push(`${manifestPath}: ${section}.${dependency}`);
      }
    }
  }
}

for (const file of [...LOCKFILES, ...TEXT_FILES]) {
  let content;
  try {
    content = await readFile(path.join(ROOT, file), 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      continue;
    }
    throw error;
  }
  for (const { pattern, label } of forbiddenPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file}: ${label}`);
    }
  }
}

for (const root of SOURCE_ROOTS) {
  for (const file of await walk(path.join(ROOT, root))) {
    if (!SOURCE_EXTENSIONS.has(path.extname(file))) {
      continue;
    }
    const content = await readFile(file, 'utf8');
    for (const { pattern, label } of forbiddenPatterns) {
      if (pattern.test(content)) {
        failures.push(`${path.relative(ROOT, file)}: ${label}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('AWS or S3-specific application integration is forbidden:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  'No AWS SDK, S3-specific adapter, AWS endpoint or access-key variable found.',
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

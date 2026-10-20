import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_ROOTS = ['backend/src', 'frontend/src', 'admin-portal/src'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs']);
const TEST_FILE_PATTERN = /(?:\.spec|\.test|\.e2e|\.cy)\.[cm]?[jt]s$/;
const EXCLUDED_DIRECTORIES = new Set([
  '__fixtures__',
  '__mocks__',
  'fixtures',
  'test-fixtures',
]);

const forbiddenPatterns = [
  { pattern: /\/uploads\/mock-/i, label: 'synthetic uploaded media URL' },
  { pattern: /r2\.hellotalk\.mock/i, label: 'synthetic object-storage URL' },
  { pattern: /i\.pravatar\.cc/i, label: 'fictional avatar service' },
  { pattern: /\bgetMockNotifications\b/, label: 'runtime mock notifications' },
  { pattern: /\bgetMockUsers\b/, label: 'runtime mock users' },
  { pattern: /\bgetMockUserProfile\b/, label: 'runtime mock user profile' },
  { pattern: /\bgetMockNearbyUsers\b/, label: 'runtime mock nearby users' },
  { pattern: /\bgetMockPartnerOfWeek\b/, label: 'runtime mock recommended partner' },
  { pattern: /\bgetMockAroundWorldUsers\b/, label: 'runtime mock global users' },
  { pattern: /\bgetMockMoodUsers\b/, label: 'runtime mock mood users' },
  {
    pattern: /return\s+\{\s*unreadCount\s*:\s*2\s*\}/,
    label: 'fabricated unread count',
  },
  {
    pattern: /import\s+\{\s*MOCK_CURRENT_USER\s*\}\s+from\s+['"]\.\/mock-data['"]/,
    label: 'runtime mock authentication identity',
  },
  { pattern: /mock-jwt-token/, label: 'synthetic authentication access token' },
  { pattern: /mock-refresh-token/, label: 'synthetic authentication refresh token' },
];

const failures = [];
for (const root of SOURCE_ROOTS) {
  for (const file of await walk(path.join(ROOT, root))) {
    if (!SOURCE_EXTENSIONS.has(path.extname(file))) {
      continue;
    }
    if (TEST_FILE_PATTERN.test(file)) {
      continue;
    }
    const relative = path.relative(ROOT, file);
    const content = await readFile(file, 'utf8');
    for (const { pattern, label } of forbiddenPatterns) {
      if (pattern.test(content)) {
        failures.push(`${relative}: ${label}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Fictional production fallback behaviour is forbidden:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('No known fictional production fallback data or success URL found.');

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
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

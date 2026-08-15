import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const migrationPrefix = 'supabase/migrations/';
const suppliedBase = process.env.MIGRATION_BASE_SHA?.trim();
const unusableBase = !suppliedBase || /^0+$/.test(suppliedBase);
const base = unusableBase ? 'HEAD^' : suppliedBase;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function migrationId(path) {
  const file = basename(path);
  const match = file.match(/^(\d{3}|\d{8}|\d{14})_(.+)\.sql$/);
  if (!match || !match[2].trim()) {
    throw new Error(
      `${file}: expected NNN_description.sql, YYYYMMDD_description.sql, or YYYYMMDDHHMMSS_description.sql`,
    );
  }
  return match[1];
}

const baseFiles = git(['ls-tree', '-r', '--name-only', base, '--', migrationPrefix])
  .split('\n')
  .filter(Boolean)
  .filter((path) => path.endsWith('.sql'));
const baseIds = new Map();
for (const path of baseFiles) {
  const id = migrationId(path);
  const paths = baseIds.get(id) ?? [];
  paths.push(path);
  baseIds.set(id, paths);
}

const diff = git([
  'diff',
  '--name-status',
  '--find-renames',
  `${base}...HEAD`,
  '--',
  migrationPrefix,
]);
const rows = diff ? diff.split('\n') : [];
const added = [];
const violations = [];

for (const row of rows) {
  const columns = row.split('\t');
  const status = columns[0];

  if (status === 'A') {
    added.push(columns[1]);
    continue;
  }

  if (status.startsWith('R')) {
    violations.push(
      `existing migration history must not be renamed: ${columns[1]} -> ${columns[2]}`,
    );
    continue;
  }

  if (status === 'M' || status === 'D') {
    violations.push(
      `existing migration history must be append-only: ${status} ${columns[1]}`,
    );
  }
}

const newIds = new Map();
for (const path of added) {
  try {
    const id = migrationId(path);
    const samePr = newIds.get(id) ?? [];
    samePr.push(path);
    newIds.set(id, samePr);

    const existing = baseIds.get(id);
    if (existing?.length) {
      violations.push(
        `new migration ${path} reuses existing id ${id}: ${existing.join(', ')}`,
      );
    }
  } catch (error) {
    violations.push(error instanceof Error ? error.message : String(error));
  }
}

for (const [id, paths] of newIds) {
  if (paths.length > 1) {
    violations.push(`new migration id ${id} is duplicated by: ${paths.join(', ')}`);
  }
}

console.log(
  `Compared migration history against ${base}; ${added.length} new migration file(s) detected.`,
);

if (violations.length) {
  for (const violation of violations) console.error(`ERROR: ${violation}`);
  process.exit(1);
}

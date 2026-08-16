import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const migrationPrefix = 'supabase/migrations/';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function resolveBase() {
  const suppliedBase = process.env.MIGRATION_BASE_SHA?.trim();
  if (suppliedBase && !/^0+$/.test(suppliedBase)) return suppliedBase;

  // Local/Factory verification should compare the whole feature branch, not
  // merely HEAD^. Worktrees keep the repository's main ref available, so use
  // the merge-base when possible. HEAD^ remains a defensive fallback for
  // detached/minimal repositories without a main ref.
  try {
    const mergeBase = git(['merge-base', 'HEAD', 'main']);
    if (mergeBase) return mergeBase;
  } catch {
    // Fall through to the historical single-commit fallback.
  }
  return 'HEAD^';
}

const base = resolveBase();

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

function stripSqlComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ');
}

function authenticatedAdminPolicies(path) {
  const source = stripSqlComments(readFileSync(path, 'utf8'));
  const policies = source.match(/create\s+policy[\s\S]*?;/gi) ?? [];
  return policies.filter(
    (policy) =>
      /\bto\s+authenticated\b/i.test(policy) &&
      /\bis_admin\b/i.test(policy) &&
      /(?:=\s*true\b|\bis\s+true\b)/i.test(policy),
  );
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

    if (authenticatedAdminPolicies(path).length > 0) {
      violations.push(
        `new migration ${path} creates authenticated users.is_admin RLS authority; privileged admin access must use the capability-gated backend/service-role path`,
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

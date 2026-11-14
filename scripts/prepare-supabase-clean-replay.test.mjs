import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compatibilityShims } from '../supabase/clean-replay-compat.mjs';
import { schemaCompatibilityShims } from '../supabase/clean-replay-compat-schema.mjs';
import {
  createdTableNames,
  missingRequiredReplayTables,
  requiredReplayTables,
} from '../supabase/required-replay-tables.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const prepareScript = join(repoRoot, 'scripts/prepare-supabase-clean-replay.mjs');
const migrationsDirectory = join(repoRoot, 'supabase/migrations');
const shims = [...compatibilityShims, ...schemaCompatibilityShims];
const shimSql = shims.map(({ sql }) => sql);

function tempDirectory() {
  return mkdtempSync(join(tmpdir(), 'supabase-replay-'));
}

function writeFixtureSource(directory, fixtureSql) {
  for (const { beforeSourceFile } of shims) {
    writeFileSync(join(directory, beforeSourceFile), '');
  }
  writeFileSync(join(directory, '20261114120000_fixture_schema.sql'), fixtureSql);
}

function runPrepare(sourceDirectory) {
  const outputDirectory = join(tempDirectory(), 'replay');
  const manifestPath = join(tempDirectory(), 'manifest.json');
  const result = spawnSync(
    process.execPath,
    [prepareScript, sourceDirectory, outputDirectory, manifestPath],
    { encoding: 'utf8' },
  );
  return { result, outputDirectory, manifestPath };
}

const createRequiredTablesSql = requiredReplayTables
  .map((table) => `CREATE TABLE IF NOT EXISTS public.${table} (id uuid PRIMARY KEY);`)
  .join('\n');

test('required replay table list covers the groups and communities services', () => {
  assert.deepEqual([...requiredReplayTables].sort(), [
    'communities',
    'group_announcements',
    'group_members',
    'group_resources',
    'groups',
  ]);
});

test('createdTableNames ignores commented-out and unrelated statements', () => {
  const names = createdTableNames([
    '-- CREATE TABLE public.groups (id uuid);\n/* CREATE TABLE public.communities */',
    'CREATE TABLE IF NOT EXISTS "communities" (id uuid);',
    'create table public.group_members (id uuid);',
  ]);

  assert.deepEqual([...names].sort(), ['communities', 'group_members']);
});

test('the committed migration corpus creates every required table', () => {
  const sources = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => readFileSync(join(migrationsDirectory, file), 'utf8'));

  assert.deepEqual(missingRequiredReplayTables([...sources, ...shimSql]), []);
});

test('the replay assertion fails when the groups schema migration is absent', () => {
  const sources = readdirSync(migrationsDirectory)
    .filter(
      (file) =>
        file.endsWith('.sql') && file !== '20261114120000_create_groups_and_communities_schema.sql',
    )
    .map((file) => readFileSync(join(migrationsDirectory, file), 'utf8'));

  assert.deepEqual(missingRequiredReplayTables([...sources, ...shimSql]), requiredReplayTables);
});

test('the replay command rejects a corpus that omits a required table', () => {
  const sourceDirectory = tempDirectory();
  writeFixtureSource(
    sourceDirectory,
    'CREATE TABLE IF NOT EXISTS public.communities (id uuid PRIMARY KEY);',
  );

  const { result, outputDirectory } = runPrepare(sourceDirectory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Clean replay is missing required table\(s\)/);
  assert.match(result.stderr, /groups/);
  assert.match(result.stderr, /group_announcements/);
  assert.equal(existsSync(outputDirectory), false);
});

test('the replay command accepts a corpus that creates every required table', () => {
  const sourceDirectory = tempDirectory();
  writeFixtureSource(sourceDirectory, createRequiredTablesSql);

  const { result, outputDirectory, manifestPath } = runPrepare(sourceDirectory);

  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const uniqueShimTargets = new Set(shims.map(({ beforeSourceFile }) => beforeSourceFile)).size;
  assert.equal(manifest.sourceMigrationCount, uniqueShimTargets + 1);
  assert.equal(manifest.replayMigrationCount, manifest.sourceMigrationCount + shims.length);
  assert.equal(manifest.compatibilityShims.length, shims.length);
  assert.equal(manifest.migrations.length, manifest.sourceMigrationCount);
  assert.ok(existsSync(outputDirectory));
});

import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { compatibilityShims } from '../supabase/clean-replay-compat.mjs';
import { schemaCompatibilityShims } from '../supabase/clean-replay-compat-schema.mjs';

const replayCompatibilityShims = [
  ...compatibilityShims,
  ...schemaCompatibilityShims,
];

const [sourceDirectory, outputDirectory, manifestPath] = process.argv.slice(2);

if (!sourceDirectory || !outputDirectory || !manifestPath) {
  console.error(
    'Usage: node scripts/prepare-supabase-clean-replay.mjs <source-dir> <output-dir> <manifest-path>',
  );
  process.exit(2);
}

const migrationPattern = /^(\d{3}|\d{8}|\d{14})_(.+)\.sql$/;
const files = readdirSync(sourceDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  throw new Error(`No SQL migrations found in ${sourceDirectory}`);
}

// Deployed migration files are append-only, but the historical corpus contains
// a small number of ordering/schema assumptions that make a clean replay
// impossible. CI keeps every source migration byte-for-byte and inserts only
// explicit, narrowly-scoped compatibility shims from the canonical compatibility
// modules. Every shim is hashed and listed in the replay manifest so normalized
// history remains reviewable rather than silently rewritten.
const shimNames = new Set();
for (const shim of replayCompatibilityShims) {
  if (!shim.beforeSourceFile || !shim.name || !shim.reason || !shim.sql) {
    throw new Error('Every clean-replay compatibility shim must define target, name, reason, and SQL');
  }
  if (shimNames.has(shim.name)) {
    throw new Error(`Duplicate clean-replay compatibility shim name: ${shim.name}`);
  }
  shimNames.add(shim.name);
}

const sourceIds = new Map();
const sourceEntries = files.map((file) => {
  const match = file.match(migrationPattern);
  if (!match) {
    throw new Error(
      `${file}: expected NNN_description.sql, YYYYMMDD_description.sql, or YYYYMMDDHHMMSS_description.sql`,
    );
  }

  const [, sourceId] = match;
  const sameId = sourceIds.get(sourceId) ?? [];
  sameId.push(file);
  sourceIds.set(sourceId, sameId);

  const source = readFileSync(join(sourceDirectory, file));
  const sha256 = createHash('sha256').update(source).digest('hex');

  return {
    sourceId,
    sourceFile: file,
    sha256,
    source,
  };
});

const missingShimTargets = replayCompatibilityShims.filter(
  ({ beforeSourceFile }) =>
    !sourceEntries.some(({ sourceFile }) => sourceFile === beforeSourceFile),
);
if (missingShimTargets.length > 0) {
  throw new Error(
    `Compatibility shim target(s) missing: ${missingShimTargets
      .map(({ beforeSourceFile }) => beforeSourceFile)
      .join(', ')}`,
  );
}

const replayEntries = [];
const shimEntries = [];
let replayOrder = 0;

const nextReplayIdentity = (suffix) => {
  replayOrder += 1;
  const replayId = String(replayOrder).padStart(14, '0');
  return {
    order: replayOrder,
    replayId,
    replayFile: `${replayId}_${suffix}.sql`,
  };
};

for (const sourceEntry of sourceEntries) {
  for (const shim of replayCompatibilityShims.filter(
    ({ beforeSourceFile }) => beforeSourceFile === sourceEntry.sourceFile,
  )) {
    const identity = nextReplayIdentity(`compat_${shim.name}`);
    const source = Buffer.from(shim.sql, 'utf8');
    shimEntries.push({
      ...identity,
      beforeSourceFile: shim.beforeSourceFile,
      name: shim.name,
      reason: shim.reason,
      sha256: createHash('sha256').update(source).digest('hex'),
      source,
    });
  }

  replayEntries.push({
    ...nextReplayIdentity(basename(sourceEntry.sourceFile, '.sql')),
    ...sourceEntry,
  });
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const outputEntries = [...replayEntries, ...shimEntries].sort(
  (left, right) => left.order - right.order,
);
for (const entry of outputEntries) {
  writeFileSync(join(outputDirectory, entry.replayFile), entry.source);
}

const duplicates = [...sourceIds.entries()]
  .filter(([, paths]) => paths.length > 1)
  .map(([id, paths]) => ({ id, paths }));

mkdirSync(join(manifestPath, '..'), { recursive: true });
writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      sourceMigrationCount: replayEntries.length,
      replayMigrationCount: outputEntries.length,
      duplicateSourceIds: duplicates,
      compatibilityShims: shimEntries.map(({ source, ...entry }) => entry),
      migrations: replayEntries.map(({ source, ...entry }) => entry),
    },
    null,
    2,
  )}\n`,
);

console.log(
  `Prepared ${replayEntries.length} source migration(s) as ${outputEntries.length} deterministic replay step(s).`,
);
if (duplicates.length > 0) {
  console.log(`Legacy duplicate source IDs normalized for CI replay: ${duplicates.length}`);
  for (const duplicate of duplicates) {
    console.log(`- ${duplicate.id}: ${duplicate.paths.join(', ')}`);
  }
}
if (shimEntries.length > 0) {
  console.log(`Historical clean-replay compatibility shims: ${shimEntries.length}`);
  for (const shim of shimEntries) {
    console.log(`- before ${shim.beforeSourceFile}: ${shim.name}`);
  }
}

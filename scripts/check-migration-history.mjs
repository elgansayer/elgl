import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const migrationDir = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(migrationDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const allowedLegacyDuplicate = new Map([
  [
    '013',
    new Set([
      '013_chat_message_enhancements.sql',
      '013_multiple_native_languages.sql',
    ]),
  ],
]);

const byId = new Map();
const errors = [];

for (const file of files) {
  const match = file.match(/^(\d{3}|\d{14})_([a-z0-9_]+)\.sql$/);
  if (!match) {
    errors.push(
      `${file}: expected NNN_name.sql or YYYYMMDDHHMMSS_name.sql`,
    );
    continue;
  }

  const [, id] = match;
  const rows = byId.get(id) ?? [];
  rows.push(file);
  byId.set(id, rows);
}

for (const [id, rows] of [...byId.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  if (rows.length <= 1) continue;

  const allowed = allowedLegacyDuplicate.get(id);
  const actual = new Set(rows);
  const isExactLegacySet =
    allowed &&
    allowed.size === actual.size &&
    [...allowed].every((file) => actual.has(file));

  if (!isExactLegacySet) {
    errors.push(`migration id ${id} is duplicated by: ${rows.join(', ')}`);
  } else {
    console.warn(`legacy duplicate migration id ${id}: ${rows.join(', ')}`);
  }
}

console.log(`Validated ${files.length} SQL migration filenames.`);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

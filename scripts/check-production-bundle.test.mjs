import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findForbiddenBundleStrings } from '../scripts/check-production-bundle.mjs';

const script = fileURLToPath(
  new URL('../scripts/check-production-bundle.mjs', import.meta.url),
);

function bundleWith(contents) {
  const directory = mkdtempSync(join(tmpdir(), 'production-bundle-'));
  mkdirSync(join(directory, 'nested'));
  writeFileSync(join(directory, 'nested', 'main.js'), contents);
  return directory;
}

test('accepts a bundle without development origins', () => {
  const directory = bundleWith('const apiUrl = "/api";');
  assert.deepEqual(findForbiddenBundleStrings(directory), []);

  const result = spawnSync(process.execPath, [script, directory], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('flags every development origin and placeholder credential', () => {
  const directory = bundleWith(
    'const a="https://mock.supabase.co";const b="mock-anon-key";const c="http://127.0.0.1:3000/api";',
  );
  const offenders = findForbiddenBundleStrings(directory);

  assert.deepEqual(
    offenders.map(({ needle }) => needle).sort(),
    ['127.0.0.1:3000', 'mock-anon-key', 'mock.supabase.co'],
  );

  const result = spawnSync(process.execPath, [script, directory], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Production bundle contains development configuration/);
});

test('fails when the bundle directory is missing', () => {
  const result = spawnSync(
    process.execPath,
    [script, join(tmpdir(), 'does-not-exist-bundle')],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Run npm run build first/);
});

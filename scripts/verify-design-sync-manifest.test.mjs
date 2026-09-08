import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const verifier = resolve(root, 'scripts/verify-design-sync-manifest.mjs');
const sourceManifest = JSON.parse(readFileSync(resolve(root, 'design-sync.manifest.json'), 'utf8'));

function verify(manifest) {
  const dir = mkdtempSync(resolve(tmpdir(), 'design-sync-manifest-'));
  const manifestPath = resolve(dir, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = spawnSync(process.execPath, [verifier], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, DESIGN_SYNC_MANIFEST_PATH: manifestPath },
  });
  rmSync(dir, { recursive: true, force: true });
  return result;
}

test('accepts the repository design-sync manifest', () => {
  const result = verify(sourceManifest);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Design sync manifest verified:/);
});

test('rejects duplicate stable IDs', () => {
  const manifest = structuredClone(sourceManifest);
  manifest.items.push({ ...structuredClone(manifest.items[0]) });
  const result = verify(manifest);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate id:/);
});

test('rejects duplicate preview mappings', () => {
  const manifest = structuredClone(sourceManifest);
  const duplicate = structuredClone(manifest.items[0]);
  duplicate.id = `${duplicate.id}.duplicate-preview`;
  duplicate.claudeDesignPath = `${duplicate.claudeDesignPath}.duplicate`;
  manifest.items.push(duplicate);
  const result = verify(manifest);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /duplicate previewPath/);
});

test('rejects mappings missing repository provenance', () => {
  const manifest = structuredClone(sourceManifest);
  manifest.items[0].repositoryPaths = [];
  const result = verify(manifest);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /repositoryPaths must be non-empty/);
});

test('rejects an unsupported schema version', () => {
  const manifest = structuredClone(sourceManifest);
  manifest.schemaVersion = 2;
  const result = verify(manifest);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /schemaVersion must be 1/);
});

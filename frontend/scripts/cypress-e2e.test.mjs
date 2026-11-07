import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { resolveCypressCacheEnvironment } from './cypress-e2e.mjs';

function fakeFs({ existing = [], unwritable = [] }) {
  const copies = [];
  return {
    copies,
    constants: { W_OK: 2 },
    existsSync: (target) => existing.includes(target),
    accessSync: (target) => {
      if (unwritable.includes(target)) {
        throw Object.assign(new Error(`EROFS: read-only file system, open '${target}'`), {
          code: 'EROFS',
        });
      }
    },
    cpSync: (from, to) => copies.push([from, to]),
  };
}

const tmpdir = '/tmp';
const mirror = path.join(tmpdir, 'cypress-e2e-cache');
const source = '/tmp/cypress-cache';

test('leaves the environment untouched when no cache folder is configured', () => {
  const env = { HOME: '/tmp/home' };
  const fsImpl = fakeFs({ existing: [] });

  assert.equal(
    resolveCypressCacheEnvironment({ env, fsImpl, tmpdir, cypressVersion: '15.21.0' }),
    env,
  );
  assert.deepEqual(fsImpl.copies, []);
});

test('leaves the environment untouched when the configured cache folder is missing', () => {
  const env = { CYPRESS_CACHE_FOLDER: source };
  const fsImpl = fakeFs({ existing: [] });

  assert.equal(
    resolveCypressCacheEnvironment({ env, fsImpl, tmpdir, cypressVersion: '15.21.0' }),
    env,
  );
  assert.deepEqual(fsImpl.copies, []);
});

test('leaves the environment untouched when the cache folder is writable', () => {
  const env = { CYPRESS_CACHE_FOLDER: source };
  const fsImpl = fakeFs({ existing: [source] });

  assert.equal(
    resolveCypressCacheEnvironment({ env, fsImpl, tmpdir, cypressVersion: '15.21.0' }),
    env,
  );
  assert.deepEqual(fsImpl.copies, []);
});

test('mirrors a read-only cache folder so binary_state.json stays writable', () => {
  const env = { CYPRESS_CACHE_FOLDER: source };
  const fsImpl = fakeFs({ existing: [source], unwritable: [source] });

  const resolved = resolveCypressCacheEnvironment({
    env,
    fsImpl,
    tmpdir,
    cypressVersion: '15.21.0',
  });

  assert.equal(resolved.CYPRESS_CACHE_FOLDER, mirror);
  assert.equal(env.CYPRESS_CACHE_FOLDER, source);
  assert.deepEqual(fsImpl.copies, [[source, mirror]]);
});

test('reuses an already seeded mirror without re-copying the binary', () => {
  const env = { CYPRESS_CACHE_FOLDER: source };
  const fsImpl = fakeFs({
    existing: [source, path.join(mirror, '15.21.0')],
    unwritable: [source, mirror],
  });

  const resolved = resolveCypressCacheEnvironment({
    env,
    fsImpl,
    tmpdir,
    cypressVersion: '15.21.0',
  });

  assert.equal(resolved.CYPRESS_CACHE_FOLDER, mirror);
  assert.deepEqual(fsImpl.copies, []);
});

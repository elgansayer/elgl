import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const checker = resolve(import.meta.dirname, 'check-design-sync-drift.mjs');

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'design-sync-head-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function git(...args) {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  function write(path, value) {
    writeFileSync(resolve(root, path), value);
  }
  function commit(message) {
    git('add', '.');
    git('commit', '-qm', message);
    return git('rev-parse', 'HEAD');
  }
  mkdirSync(resolve(root, 'scripts'));
  mkdirSync(resolve(root, 'frontend/src/app'), { recursive: true });
  copyFileSync(checker, resolve(root, 'scripts/check-design-sync-drift.mjs'));
  write('design-sync.manifest.json', JSON.stringify({ items: [{
    id: 'screen.shell', repositoryPaths: ['frontend/src/app'], previewPaths: ['preview.html'],
  }] }));
  write('frontend/src/app/shell.component.ts', 'export class Shell {}\n');
  git('init', '-qb', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  const base = commit('base');
  write('backend.ts', 'export const changed = true;\n');
  const prHead = commit('non-visual PR');
  write('frontend/src/app/shell.component.ts', 'export class Shell { changed = true; }\n');
  const integrationHead = commit('unrelated newer main visual change');
  function run(head = prHead, eventName = 'pull_request') {
    write('event.json', JSON.stringify({ pull_request: { head: { sha: head } } }));
    return spawnSync(process.execPath, ['scripts/check-design-sync-drift.mjs'], {
      cwd: root, encoding: 'utf8', env: {
        ...process.env, DESIGN_SYNC_BASE_SHA: base, GITHUB_EVENT_NAME: eventName,
        GITHUB_EVENT_PATH: resolve(root, 'event.json'),
      },
    });
  }
  return { run, git, write, commit, base, prHead, integrationHead };
}

test('does not attribute newer main visual changes to a non-visual PR', (t) => {
  const { run } = fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no mapped visual-contract paths changed/);
});

test('still rejects a visual change actually owned by the PR', (t) => {
  const { run, integrationHead } = fixture(t);
  const result = run(integrationHead);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /screen.shell: mapped implementation changed/);
  assert.match(result.stderr, /changed: frontend\/src\/app\/shell\.component\.ts\n/);
  assert.match(result.stderr, /update the preview to match: preview\.html\n/);
});

test('non-PR invocation continues to inspect the actual checkout', (t) => {
  const { run } = fixture(t);
  const result = run(undefined, 'push');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /screen.shell: mapped implementation changed/);
});

test('fails closed on malformed event head identity', (t) => {
  const { run } = fixture(t);
  const result = run('not-a-commit');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing valid pull-request head identity/);
});

test('fails closed when the claimed PR head is outside the integration checkout', (t) => {
  const { run, git, write, commit, base } = fixture(t);
  git('switch', '-qc', 'unrelated', base);
  write('other.ts', 'export const unrelated = true;\n');
  const unrelated = commit('unrelated branch');
  git('switch', '-q', 'main');
  const result = run(unrelated);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unable to calculate design-sync diff/);
});

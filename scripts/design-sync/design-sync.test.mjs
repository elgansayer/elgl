import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import {
  classify,
  contrast,
  discoverSurfaces,
  loadManifest,
  relayTokens,
  root,
  specimenPaths,
} from './lib.mjs';

test('classify never overwrites a side that changed alongside the other', () => {
  assert.equal(classify({ local: 'a', remote: 'a', baseline: 'x' }).action, 'inSync');
  assert.equal(classify({ local: 'a', remote: null, baseline: null }).action, 'push');
  assert.equal(classify({ local: 'b', remote: 'a', baseline: 'a' }).action, 'push');
  assert.equal(classify({ local: 'a', remote: 'b', baseline: 'a' }).action, 'pull');
  assert.equal(classify({ local: 'b', remote: 'c', baseline: 'a' }).action, 'conflict');
  assert.equal(classify({ local: 'b', remote: 'c', baseline: null }).action, 'conflict');
});

test('specimenPaths reads data-component sections only', () => {
  const html = `<!-- data-component="ignored" -->
    <section class="specimen" data-component="components/a"></section>
    <section class="specimen wide" data-component="pages/b" style="x"></section>
    <div data-component="components/not-a-section"></div>`;
  assert.deepEqual(specimenPaths(html), ['components/a', 'pages/b']);
});

test('contrast matches WCAG reference values', () => {
  assert.equal(contrast([0, 0, 0], [255, 255, 255]).toFixed(1), '21.0');
  assert.equal(contrast([118, 118, 118], [255, 255, 255]).toFixed(2), '4.54');
});

test('relay tokens parse from styles.scss for both themes', () => {
  const tokens = relayTokens();
  for (const theme of ['light', 'dark']) {
    for (const name of [
      'surface-500',
      'text-primary',
      'primary',
      'primary-text',
      'secondary',
      'secondary-text',
      'danger-text',
      'on-fill',
      'accent',
    ]) {
      assert.equal(tokens[theme][name]?.length, 3, `${theme} ${name}`);
    }
  }
});

test('surface discovery finds pages, components, helm and nested feature folders', () => {
  const surfaces = discoverSurfaces();
  assert.ok(surfaces.includes('pages/home'));
  assert.ok(surfaces.includes('components/ui/button'));
  assert.ok(surfaces.includes('chat/threaded-reply'));
  assert.ok(!surfaces.includes('components/ui/utils'));
});

test('coverage gate fails when a surface is unmapped', () => {
  const manifest = loadManifest();
  manifest.items = manifest.items.filter((item) => item.id !== 'feature.commerce');
  const dir = mkdtempSync(join(tmpdir(), 'design-coverage-'));
  const path = join(dir, 'manifest.json');
  writeFileSync(path, JSON.stringify(manifest));
  assert.throws(
    () =>
      execFileSync('node', [resolve(root, 'scripts/design-sync/check-full-coverage.mjs')], {
        env: { ...process.env, DESIGN_SYNC_MANIFEST_PATH: path },
        stdio: 'pipe',
      }),
    (error) =>
      /unmapped runtime surface: frontend\/src\/app\/components\/shop/.test(String(error.stderr)),
  );
});

test('every feature catalogue preview carries the shared Relay token block', () => {
  const template = readFileSync(
    resolve(root, 'scripts/design-sync/feature-preview.template.html'),
    'utf8',
  );
  const tokenBlock = template.slice(
    template.indexOf(':root {'),
    template.indexOf('/* ===== Shared catalogue'),
  );
  for (const item of loadManifest().items.filter((i) => i.previewPaths[0].includes('/features/'))) {
    const html = readFileSync(resolve(root, item.previewPaths[0]), 'utf8');
    assert.ok(
      html.includes(tokenBlock.trim()),
      `${item.previewPaths[0]} drifted from the template tokens`,
    );
  }
});

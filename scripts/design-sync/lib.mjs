// Shared helpers for design-sync automation: runtime-surface discovery, manifest access,
// preview specimen parsing, and Relay token extraction. Pure Node, no dependencies.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '../..');
export const appRoot = resolve(root, 'frontend/src/app');
export const appPrefix = 'frontend/src/app/';
export const previewRoot = resolve(root, 'frontend/design-preview');
export const manifestPath = resolve(root, 'design-sync.manifest.json');
export const statePath = resolve(root, 'design-sync.state.json');

export const toRepoPath = (abs) => relative(root, abs).replaceAll('\\', '/');
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

export function loadManifest(path = manifestPath) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadState() {
  if (!existsSync(statePath)) return { schemaVersion: 1, remote: {} };
  return JSON.parse(readFileSync(statePath, 'utf8'));
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const isComponentSource = (file) =>
  /\.component\.ts$/.test(file) || (/\.ts$/.test(file) && !/\.spec\.ts$/.test(file));

function hasUi(dir, helm = false) {
  return walk(dir).some((file) =>
    helm ? isComponentSource(file) && !/\.spec\.ts$/.test(file) : /\.component\.ts$/.test(file),
  );
}

function childDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// Shared non-visual helpers that live beside UI but are not runtime surfaces themselves.
const ignoredSurfaces = new Set(['components/ui/utils', 'generated', 'i18n', 'animations']);

/**
 * Every runtime UI surface in the Angular app, as paths relative to frontend/src/app.
 * - components/<x> and pages/<x>: one surface per directory containing a *.component.ts
 * - components/ui/<x>: one surface per Spartan Helm directory
 * - any other top-level app directory containing UI: one surface per directory that directly
 *   holds a *.component.ts, so nested features (chat/threaded-reply) are tracked individually
 */
export function discoverSurfaces() {
  const surfaces = new Set();
  for (const top of childDirs(appRoot)) {
    const topAbs = resolve(appRoot, top);
    if (top === 'components' || top === 'pages') {
      for (const child of childDirs(topAbs)) {
        if (top === 'components' && child === 'ui') {
          for (const helm of childDirs(resolve(topAbs, 'ui'))) {
            if (hasUi(resolve(topAbs, 'ui', helm), true)) surfaces.add(`components/ui/${helm}`);
          }
          continue;
        }
        if (hasUi(resolve(topAbs, child))) surfaces.add(`${top}/${child}`);
      }
      continue;
    }
    if (!statSync(topAbs).isDirectory()) continue;
    for (const file of walk(topAbs)) {
      if (!/\.component\.ts$/.test(file) || /\.spec\.ts$/.test(file)) continue;
      const dir = relative(appRoot, resolve(file, '..')).replaceAll('\\', '/');
      // features/<area>/components/<x> collapses to the feature area.
      const featureArea = dir.match(/^(features\/[^/]+)/);
      surfaces.add(featureArea ? featureArea[1] : dir);
    }
  }
  return [...surfaces].filter((surface) => !ignoredSurfaces.has(surface)).sort();
}

/** Manifest items that name the surface (or a child of it) explicitly. */
export function specificMappings(manifest, surface) {
  const full = `${appPrefix}${surface}`;
  return manifest.items.filter((item) =>
    item.repositoryPaths.some((path) => path === full || path.startsWith(`${full}/`)),
  );
}

/** data-component specimen paths declared in a feature-catalogue preview. */
export function specimenPaths(html) {
  return [...html.matchAll(/<section\b[^>]*\bdata-component="([^"]+)"/g)].map((match) => match[1]);
}

export function previewFiles() {
  return walk(previewRoot)
    .filter((file) => file.endsWith('.html'))
    .map(toRepoPath)
    .sort();
}

/** Relay RGB tokens from frontend/src/styles.scss, keyed by theme. */
export function relayTokens() {
  const scss = readFileSync(resolve(root, 'frontend/src/styles.scss'), 'utf8');
  const block = (selector) => {
    const start = scss.search(new RegExp(`^\\s*${selector}\\s*\\{`, 'm'));
    if (start < 0) return {};
    const body = scss.slice(start, scss.indexOf('}', start));
    const tokens = {};
    for (const match of body.matchAll(/--(?:color-)?([a-z0-9-]+)-rgb:\s*(\d+)\s+(\d+)\s+(\d+)/g)) {
      tokens[match[1].replace(/^shadow-color$/, 'shadow')] = [match[2], match[3], match[4]].map(
        Number,
      );
    }
    return tokens;
  };
  return { light: block(':root'), dark: block('\\.dark') };
}

/** Preview-local tokens from a preview's inline :root / html.dark blocks. */
export function previewTokens(html) {
  const block = (selector) => {
    const match = html.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
    const tokens = {};
    if (!match) return tokens;
    for (const t of match[1].matchAll(/--([a-z0-9-]+):\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/g)) {
      tokens[t[1]] = [t[2], t[3], t[4]].map(Number);
    }
    return tokens;
  };
  return { light: block(':root'), dark: block('html\\.dark') };
}

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function contrast(a, b) {
  const lum = ([r, g, bl]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Three-way sync decision for one artefact. `baseline` is the content hash both sides last agreed on.
 * Returns in-sync | push | pull | conflict, plus a reason.
 */
export function classify({ local, remote, baseline }) {
  if (remote === local) return { action: 'inSync', reason: 'identical' };
  if (remote === null) return { action: 'push', reason: 'missing in Claude Design' };
  if (baseline === null)
    return { action: 'conflict', reason: 'no reconciliation baseline and contents differ' };
  if (remote === baseline) return { action: 'push', reason: 'repository changed since last sync' };
  if (local === baseline)
    return { action: 'pull', reason: 'Claude Design changed since last sync' };
  return {
    action: 'conflict',
    reason: 'both repository and Claude Design changed since last sync',
  };
}

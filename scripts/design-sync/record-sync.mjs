#!/usr/bin/env node
// Records the outcome of a Claude Design sync after DesignSync writes succeed.
//
//   node scripts/design-sync/record-sync.mjs --plan <plan.json> --remote-dir <dir> [--pushed-ok]
//
// - in-sync and (with --pushed-ok) pushed items: state hash = local hash, lastReconciledCommit = plan head
// - pulled items: the Claude Design file is copied over the repository preview (design-first intent)
//   and recorded as the new baseline; implementation follow-up is filed separately
// - conflicts: both versions are written to reports/design-sync-conflicts/ for an explicit
//   reconciliation issue; nothing is overwritten
// Prints a JSON summary for the PR/issue body.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadManifest, loadState, manifestPath, root, sha256, statePath } from './lib.mjs';

const value = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? null : process.argv[index + 1];
};
const plan = JSON.parse(readFileSync(resolve(value('plan')), 'utf8'));
const remoteDir = resolve(value('remote-dir'));
const pushedOk = process.argv.includes('--pushed-ok');

const manifest = loadManifest();
const state = loadState();
state.schemaVersion = 1;
state.remote ??= {};
const now = plan.generated;
const byId = new Map(manifest.items.map((item) => [item.id, item]));

function reconcile(entry, hash) {
  state.remote[entry.designPath] = { hash, commit: plan.head, syncedAt: now };
  const item = byId.get(entry.id);
  if (item) item.lastReconciledCommit = plan.head;
}

for (const entry of plan.inSync) reconcile(entry, entry.local);
if (pushedOk) for (const entry of plan.push) reconcile(entry, entry.local);

for (const entry of plan.pull) {
  copyFileSync(resolve(remoteDir, entry.designPath), resolve(root, entry.previewPath));
  reconcile(entry, sha256(readFileSync(resolve(root, entry.previewPath))));
}

for (const entry of plan.conflict) {
  const dir = resolve(root, 'reports/design-sync-conflicts', entry.id);
  mkdirSync(dir, { recursive: true });
  copyFileSync(resolve(root, entry.previewPath), resolve(dir, 'repository.html'));
  copyFileSync(resolve(remoteDir, entry.designPath), resolve(dir, 'claude-design.html'));
}

state.remote = Object.fromEntries(
  Object.entries(state.remote).sort(([a], [b]) => a.localeCompare(b)),
);
writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const summary = {
  head: plan.head,
  pushed: pushedOk ? plan.push.map((e) => e.id) : [],
  pulled: plan.pull.map((e) => e.id),
  conflicts: plan.conflict.map((e) => ({ id: e.id, reason: e.reason })),
  unmappedRemote: plan.unmappedRemote,
};
console.log(JSON.stringify(summary, null, 2));

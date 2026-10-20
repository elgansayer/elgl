#!/usr/bin/env node
// Three-way Claude Design sync planner.
//
//   node scripts/design-sync/plan-sync.mjs --remote-dir <dir> --bundle <dir> --out <plan.json>
//
// <remote-dir> holds the current Claude Design files, saved at their claudeDesignPath (an absent
// file means it does not exist remotely). For every manifest item the planner compares:
//   local    - the repository preview now
//   baseline - what automation last pushed (design-sync.state.json), falling back to the preview at
//              the item's lastReconciledCommit for artefacts reconciled before automation existed
//   remote   - the Claude Design file now
// and classifies it as in-sync, push (code-first), pull (design-first) or conflict. Conflicts are
// never resolved here: docs/claude-design-two-way-sync.md forbids silently picking a winner.
// Push candidates are copied into <bundle> at their Claude Design path for DesignSync.write_files.

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { classify, loadManifest, loadState, root, sha256 } from './lib.mjs';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`--${name} is required`);
  return resolve(process.argv[index + 1]);
}

const remoteDir = arg('remote-dir');
const bundleDir = arg('bundle');
const outPath = arg('out');

const manifest = loadManifest();
const state = loadState();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

function gitShow(commit, path) {
  try {
    return execFileSync('git', ['show', `${commit}:${path}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function listRemote(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory()
      ? listRemote(full, base)
      : [relative(base, full).replaceAll('\\', '/')];
  });
}

const plan = {
  head,
  generated: new Date().toISOString(),
  inSync: [],
  push: [],
  pull: [],
  conflict: [],
  unmappedRemote: [],
};
const mappedDesignPaths = new Set();

for (const item of manifest.items) {
  const designPath = item.claudeDesignPath;
  const previewPath = item.previewPaths[0];
  mappedDesignPaths.add(designPath);
  const localAbs = resolve(root, previewPath);
  if (!existsSync(localAbs)) continue;

  const local = sha256(readFileSync(localAbs));
  const remoteAbs = resolve(remoteDir, designPath);
  const remote = existsSync(remoteAbs) ? sha256(readFileSync(remoteAbs)) : null;
  let baseline = state.remote?.[designPath]?.hash ?? null;
  if (!baseline && item.lastReconciledCommit) {
    const old = gitShow(item.lastReconciledCommit, previewPath);
    if (old !== null) baseline = sha256(old);
  }

  const entry = { id: item.id, previewPath, designPath, local, remote, baseline };
  const { action, reason } = classify(entry);
  plan[action].push({ ...entry, reason });
}

// Remote design artefacts with no manifest mapping are design-first work awaiting an owner.
for (const path of listRemote(remoteDir)) {
  if (!mappedDesignPaths.has(path) && path.endsWith('.html')) plan.unmappedRemote.push(path);
}

mkdirSync(bundleDir, { recursive: true });
for (const entry of plan.push) {
  const target = resolve(bundleDir, entry.designPath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(root, entry.previewPath), target);
}

writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`);
console.log(
  `Design sync plan @ ${head.slice(0, 9)}: ${plan.inSync.length} in sync, ${plan.push.length} push, ` +
    `${plan.pull.length} pull, ${plan.conflict.length} conflict, ${plan.unmappedRemote.length} unmapped remote.`,
);

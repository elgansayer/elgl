import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = resolve(
  frontendRoot,
  '..',
  '.github/workflows-disabled/spartan-dark-theme-parity.yml',
);
const scriptPath = resolve(frontendRoot, 'scripts/check-dark-theme-parity.mjs');

test('the dark theme parity workflow points at an existing script', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /working-directory: frontend/);
  assert.match(workflow, /run: node scripts\/check-dark-theme-parity\.mjs/);
  assert.ok(
    existsSync(scriptPath),
    'the workflow must reference a script committed under frontend/scripts',
  );
});

test('the dark theme parity check passes for the current Relay tokens', () => {
  const result = spawnSync(process.execPath, ['scripts/check-dark-theme-parity.mjs'], {
    cwd: frontendRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dark theme parity check passed/);
});

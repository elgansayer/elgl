import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const deployWorkflow = readFileSync(
  new URL('../.github/workflows/deploy.yml', import.meta.url),
  'utf8',
);
const ciWorkflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

function assertOrdered(...markers) {
  let previous = -1;
  for (const marker of markers) {
    const index = deployWorkflow.indexOf(marker);
    assert.notEqual(index, -1, `missing deploy workflow marker: ${marker}`);
    assert.ok(index > previous, `${marker} must appear after the preceding deployment gate`);
    previous = index;
  }
}

test('deploys only a successful CI-tested main commit', () => {
  assert.match(ciWorkflow, /^name: CI$/m);
  assert.match(
    deployWorkflow,
    /workflow_run:\n\s+workflows: \[CI\]\n\s+types: \[completed\]\n\s+branches: \[main\]/,
  );
  assert.match(deployWorkflow, /if: github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(deployWorkflow, /TESTED_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(deployWorkflow, /git\/ref\/heads\/main/);
  assert.match(deployWorkflow, /if \[ "\$TESTED_SHA" != "\$CURRENT_SHA" \]/);
  assert.match(deployWorkflow, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
});

test('builds immutable production API and Web images from the tested SHA', () => {
  assert.equal((deployWorkflow.match(/uses: docker\/build-push-action@/g) ?? []).length, 2);

  for (const [name, context] of [
    ['api', 'backend'],
    ['web', 'frontend'],
  ]) {
    assert.match(deployWorkflow, new RegExp(`context: ${context}`));
    assert.match(deployWorkflow, new RegExp(`file: ${context}\\/Dockerfile`));
    assert.match(deployWorkflow, /target: production/);
    assert.match(deployWorkflow, /push: true/);
    assert.match(
      deployWorkflow,
      new RegExp(`tags: ghcr\\.io\\/\\$\\{\\{ github\\.repository \\}\\}\\/${name}:\\$\\{\\{ github\\.event\\.workflow_run\\.head_sha \\}\\}`),
    );
  }
});

test('promotes latest only after image scans and provenance attestations', () => {
  assertOrdered(
    'Build and push immutable API image',
    'Build and push immutable Web image',
    'Scan immutable API image',
    'Scan immutable Web image',
    'Attest API build provenance',
    'Attest Web build provenance',
    'Promote verified image digests to latest',
  );
});

test('serializes deployments so stale main builds cannot race latest', () => {
  assert.match(deployWorkflow, /group: deploy-main/);
  assert.match(deployWorkflow, /cancel-in-progress: true/);
});

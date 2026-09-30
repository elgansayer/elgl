import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(join(root, '.github/workflows/deploy.yml'), 'utf8');

function indexOfOrFail(fragment) {
  const index = workflow.indexOf(fragment);
  assert.notEqual(index, -1, `missing deployment contract fragment: ${fragment}`);
  return index;
}

test('deploys only successful CI runs from main and serializes main promotion', () => {
  assert.match(workflow, /workflow_run:\s*\n\s+workflows:\s*\[CI\]/);
  assert.match(workflow, /types:\s*\[completed\]/);
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /if:\s*github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /group:\s*deploy-main/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
});

test('grants only the permissions required to publish and attest images', () => {
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/);
  assert.match(workflow, /packages:\s*write/);
  assert.match(workflow, /attestations:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
});

test('rejects stale successful runs before registry authentication or builds', () => {
  const staleGate = indexOfOrFail('Verify tested commit is still current main');
  const checkout = indexOfOrFail('Checkout tested commit');
  const login = indexOfOrFail('Login to GitHub Container Registry');
  const apiBuild = indexOfOrFail('Build and push immutable API image');

  assert.ok(staleGate < checkout);
  assert.ok(checkout < login);
  assert.ok(login < apiBuild);
  assert.match(workflow, /TESTED_SHA:\s*\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /git\/ref\/heads\/main/);
  assert.match(workflow, /if \[ "\$TESTED_SHA" != "\$CURRENT_SHA" \]/);
  assert.match(workflow, /echo "deploy=false" >> "\$GITHUB_OUTPUT"/);
});

test('checks out and tags exactly the tested commit', () => {
  assert.match(workflow, /ref:\s*\$\{\{ github\.event\.workflow_run\.head_sha \}\}/);

  for (const image of ['api', 'web']) {
    assert.match(
      workflow,
      new RegExp(
        `tags: ghcr\\.io\\/\\$\\{\\{ github\\.repository \\}\\}\\/${image}:\\$\\{\\{ github\\.event\\.workflow_run\\.head_sha \\}\\}`,
      ),
    );
  }

  assert.doesNotMatch(workflow, /tags:.*:latest/);
});

test('builds production API and Web images with cache, SBOM and provenance enabled', () => {
  assert.match(workflow, /context:\s*backend[\s\S]*?file:\s*backend\/Dockerfile[\s\S]*?target:\s*production/);
  assert.match(workflow, /context:\s*frontend[\s\S]*?file:\s*frontend\/Dockerfile[\s\S]*?target:\s*production/);

  const pushes = workflow.match(/push:\s*true/g) ?? [];
  const sboms = workflow.match(/sbom:\s*true/g) ?? [];
  const provenance = workflow.match(/provenance:\s*mode=max/g) ?? [];
  const cacheFrom = workflow.match(/cache-from:\s*type=gha/g) ?? [];
  const cacheTo = workflow.match(/cache-to:\s*type=gha,mode=max/g) ?? [];

  assert.equal(pushes.length, 2);
  assert.equal(sboms.length, 2);
  assert.equal(provenance.length, 2);
  assert.equal(cacheFrom.length, 2);
  assert.equal(cacheTo.length, 2);
});

test('scans both immutable images before attestation and latest promotion', () => {
  const apiScan = indexOfOrFail('Scan immutable API image');
  const webScan = indexOfOrFail('Scan immutable Web image');
  const apiAttestation = indexOfOrFail('Attest API build provenance');
  const webAttestation = indexOfOrFail('Attest Web build provenance');
  const promotion = indexOfOrFail('Promote verified image digests to latest');

  assert.ok(apiScan < apiAttestation);
  assert.ok(webScan < webAttestation);
  assert.ok(apiAttestation < promotion);
  assert.ok(webAttestation < promotion);

  const failingScans = workflow.match(/exit-code:\s*'1'/g) ?? [];
  const severities = workflow.match(/severity:\s*HIGH,CRITICAL/g) ?? [];
  assert.equal(failingScans.length, 2);
  assert.equal(severities.length, 2);
});

test('promotes only verified digests to mutable latest tags', () => {
  assert.match(workflow, /API_DIGEST:\s*\$\{\{ steps\.build-api\.outputs\.digest \}\}/);
  assert.match(workflow, /WEB_DIGEST:\s*\$\{\{ steps\.build-web\.outputs\.digest \}\}/);
  assert.match(workflow, /api:latest/);
  assert.match(workflow, /api@\$\{API_DIGEST\}/);
  assert.match(workflow, /web:latest/);
  assert.match(workflow, /web@\$\{WEB_DIGEST\}/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(
  join(root, '.github/workflows/dashboard-image.yml'),
  'utf8',
);
const compose = readFileSync(
  join(root, 'factory-dashboard/docker-compose.yml'),
  'utf8',
);
const startScript = readFileSync(join(root, 'factory-dashboard/start.sh'), 'utf8');

function indexOfOrFail(fragment) {
  const index = workflow.indexOf(fragment);
  assert.notEqual(index, -1, `missing dashboard image contract fragment: ${fragment}`);
  return index;
}

test('tests and builds dashboard changes and manual dispatches', () => {
  assert.match(workflow, /push:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /- factory-dashboard\/\*\*/);

  const tests = indexOfOrFail('Run dashboard tests');
  const build = indexOfOrFail('docker/build-push-action@');
  assert.ok(tests < build);
  assert.match(workflow, /working-directory: factory-dashboard\s*\n\s+run: npm test/);
  assert.match(workflow, /context: factory-dashboard/);
});

test('publishes latest and commit tags only from main outside pull requests', () => {
  const mainPublicationCondition =
    "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'";

  assert.match(
    workflow,
    new RegExp(`if: ${mainPublicationCondition.replaceAll('.', '\\.')}`),
  );
  assert.match(
    workflow,
    new RegExp(`push: \\$\\{\\{ ${mainPublicationCondition.replaceAll('.', '\\.')} \\}\\}`),
  );
  assert.match(workflow, /ghcr\.io\/elgansayer\/factory-dashboard:latest/);
  assert.match(
    workflow,
    /ghcr\.io\/elgansayer\/factory-dashboard:sha-\$\{\{ github\.sha \}\}/,
  );
});

test('triggers the scoped deployment only after a successful main publication', () => {
  const deploy = indexOfOrFail('deploy:');
  const buildDependency = indexOfOrFail('needs: build');
  const webhook = indexOfOrFail('DEPLOY_WEBHOOK_URL: ${{ secrets.DEPLOY_WEBHOOK_URL }}');

  assert.ok(deploy < buildDependency);
  assert.ok(buildDependency < webhook);
  assert.match(
    workflow,
    /deploy:\s*\n\s+if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'\s*\n\s+needs: build/,
  );
  assert.match(workflow, /test "\$status" = 202/);
});

test('production deployment pulls the tested dashboard image', () => {
  assert.match(
    compose,
    /image: ghcr\.io\/elgansayer\/factory-dashboard:latest/,
  );
  assert.match(compose, /pull_policy: always/);
  assert.doesNotMatch(compose, /^\s+build:/m);
  assert.match(startScript, /docker compose up -d --pull always/);
  assert.doesNotMatch(startScript, /docker compose up -d --build/);
});

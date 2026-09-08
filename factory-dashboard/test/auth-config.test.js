import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(testDir, '..');

function read(relativePath) {
  return readFileSync(path.join(dashboardDir, relativePath), 'utf8');
}

test('example environment includes dashboard auth required by the server', () => {
  const env = read('.env.example');

  assert.match(env, /^DASHBOARD_USER=admin$/m);
  assert.match(env, /^DASHBOARD_PASSWORD=.{16,}$/m);
});

test('compose passes dashboard auth into the container and fails closed when password is absent', () => {
  const compose = read('docker-compose.yml');

  assert.match(compose, /DASHBOARD_USER=\$\{DASHBOARD_USER:-admin\}/);
  assert.match(
    compose,
    /DASHBOARD_PASSWORD=\$\{DASHBOARD_PASSWORD:\?DASHBOARD_PASSWORD must be set\}/,
  );
});

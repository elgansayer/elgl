import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const config = JSON.parse(read('config/centrifugo/config.json'));
const composeFiles = ['docker-compose.yml', 'docker-compose.dev.yml', 'docker-compose.prod.yml'];

test('Centrifugo uses the shared Redis service with bounded realtime namespaces', () => {
  assert.equal(config.engine, 'redis');
  assert.equal(config.redis_address, 'redis://cache:6379');
  assert.equal(config.redis_prefix, 'centrifugo');
  assert.equal(config.prometheus, true);

  const namespaces = new Map(config.namespaces.map((namespace) => [namespace.name, namespace]));
  for (const name of ['chat', 'room', 'user']) {
    const namespace = namespaces.get(name);
    assert.ok(namespace, `missing ${name} namespace`);
    assert.equal(namespace.presence, true);
    assert.ok(Number.isInteger(namespace.channel_limit) && namespace.channel_limit > 0);
    assert.ok(
      Number.isInteger(namespace.channel_subscription_rate_limit) &&
        namespace.channel_subscription_rate_limit > 0,
    );
  }
});

test('tracked Centrifugo config contains no signing or API secret values', () => {
  assert.equal(Object.hasOwn(config, 'token_hmac_secret_key'), false);
  assert.equal(Object.hasOwn(config, 'api_key'), false);
});

for (const path of composeFiles) {
  test(`${path} wires API and Centrifugo through service DNS and shared credentials`, () => {
    const compose = read(path);
    assert.match(compose, /REDIS_URL=redis:\/\/cache:6379/);
    assert.match(compose, /CENTRIFUGO_URL=http:\/\/websocket:8000/);
    assert.match(compose, /CENTRIFUGO_TOKEN_HMAC_SECRET_KEY=\$\{CENTRIFUGO_SECRET\}/);
    assert.match(compose, /CENTRIFUGO_API_KEY=\$\{CENTRIFUGO_API_KEY\}/);
    assert.match(compose, /image: redis:7-alpine/);
    assert.match(compose, /image: centrifugo\/centrifugo:v5/);
  });
}

test('example environment declares the backend/Centrifugo shared credentials', () => {
  const env = read('.env.example');
  assert.match(env, /^CENTRIFUGO_API_KEY=/m);
  assert.match(env, /^CENTRIFUGO_SECRET=/m);
});

test('Prometheus scrapes the Centrifugo internal metrics endpoint', () => {
  const prometheus = read('prometheus/prometheus.yml');
  assert.match(prometheus, /targets: \['websocket:8001'\]/);
});

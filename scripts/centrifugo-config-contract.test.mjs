import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const config = JSON.parse(read('config/centrifugo/config.json'));
const composeFiles = ['docker-compose.yml', 'docker-compose.dev.yml', 'docker-compose.prod.yml'];
const productionComposeFiles = ['docker-compose.yml', 'docker-compose.prod.yml'];

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
    assert.match(compose, /CENTRIFUGO_TOKEN_HMAC_SECRET_KEY=\$\{CENTRIFUGO_SECRET(?::[^}]*)?\}/);
    assert.match(compose, /CENTRIFUGO_API_KEY=\$\{CENTRIFUGO_API_KEY(?::[^}]*)?\}/);
    assert.match(compose, /image: redis:7-alpine/);
    assert.match(compose, /image: centrifugo\/centrifugo:v5/);
  });
}

for (const path of productionComposeFiles) {
  test(`${path} fails closed before exposing production Centrifugo`, () => {
    const compose = read(path);
    assert.match(
      compose,
      /CENTRIFUGO_TOKEN_HMAC_SECRET_KEY=\$\{CENTRIFUGO_SECRET:\?CENTRIFUGO_SECRET must be set in production\}/,
    );
    assert.match(
      compose,
      /CENTRIFUGO_API_KEY=\$\{CENTRIFUGO_API_KEY:\?CENTRIFUGO_API_KEY must be set in production\}/,
    );

    const apiStart = compose.indexOf('  api:');
    const websocketStart = compose.indexOf('  websocket:');
    const websocketEnd = compose.indexOf('\n  sfu:', websocketStart);
    const apiBlock = compose.slice(apiStart, compose.indexOf('\n  web:', apiStart));
    const websocketBlock = compose.slice(websocketStart, websocketEnd);

    assert.doesNotMatch(apiBlock, /\n\s+- websocket\s*$/m);
    assert.match(websocketBlock, /api:\n\s+condition: service_healthy/);
  });
}

test('production requires an explicit Centrifugo browser origin allowlist', () => {
  const compose = read('docker-compose.prod.yml');
  assert.match(
    compose,
    /CENTRIFUGO_ALLOWED_ORIGINS=\$\{CENTRIFUGO_ALLOWED_ORIGINS:\?CENTRIFUGO_ALLOWED_ORIGINS must be set in production\}/,
  );
  assert.doesNotMatch(compose, /CENTRIFUGO_ALLOWED_ORIGINS=\$\{CENTRIFUGO_ALLOWED_ORIGINS:-\*\}/);
});

test('example environment declares the backend/Centrifugo shared credentials', () => {
  const env = read('.env.example');
  assert.match(env, /^CENTRIFUGO_API_KEY=/m);
  assert.match(env, /^CENTRIFUGO_SECRET=/m);
});

test('Prometheus scrapes the Centrifugo internal metrics endpoint', () => {
  const prometheus = read('prometheus/prometheus.yml');
  assert.match(prometheus, /targets: \['websocket:8000'\]/);
});

// WebSocket connection rate limiting (#1849). The layers below are documented in
// docs/centrifugo-connection-rate-limiting.md. Centrifugo treats 0 as "unlimited",
// so each node-level limit must be a positive integer to stay enabled.
test('Centrifugo bounds the node connection rate, per-user connections and per-client channels', () => {
  for (const option of [
    'client_connection_rate_limit',
    'client_user_connection_limit',
    'client_channel_limit',
  ]) {
    assert.ok(
      Number.isInteger(config[option]) && config[option] > 0,
      `${option} must be a positive integer, otherwise Centrifugo leaves it unlimited`,
    );
  }
});

test('nginx rate limits and caps WebSocket connections per client address at the Centrifugo edge', () => {
  const nginx = read('config/nginx/nginx.conf');
  assert.match(
    nginx,
    /limit_req_zone\s+\$binary_remote_addr\s+zone=centrifugo_limit:\d+m\s+rate=[1-9]\d*r\/s;/,
  );
  assert.match(nginx, /limit_conn_zone\s+\$binary_remote_addr\s+zone=centrifugo_conn_limit:\d+m;/);

  const location = nginx.match(/location \/centrifugo\/ \{([^}]*)\}/);
  assert.ok(location, 'missing the /centrifugo/ proxy location');
  assert.match(location[1], /limit_req\s+zone=centrifugo_limit\s+burst=[1-9]\d*(?:\s+nodelay)?;/);
  assert.match(location[1], /limit_conn\s+centrifugo_conn_limit\s+[1-9]\d*;/);
  assert.match(location[1], /proxy_pass\s+http:\/\/websocket:8000\/;/);
});

for (const path of ['.env.example', 'backend/.env.example']) {
  test(`${path} declares a positive connection-token rate limit and window`, () => {
    const env = read(path);
    assert.match(env, /^CENTRIFUGO_CONNECTION_RATE_LIMIT=[1-9]\d*$/m);
    assert.match(env, /^CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC=[1-9]\d*$/m);
  });
}

test('connection rate limiting documentation names every enforcement layer and its tunables', () => {
  const doc = read('docs/centrifugo-connection-rate-limiting.md');
  for (const name of [
    'client_connection_rate_limit',
    'client_user_connection_limit',
    'client_channel_limit',
    'centrifugo_limit',
    'centrifugo_conn_limit',
    'CENTRIFUGO_CONNECTION_RATE_LIMIT',
    'CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC',
    'hellotalk_centrifugo_connection_rate_limit_total',
    'centrifugo_connection_rate_limited',
    'centrifugo_connection_rate_limiter_degraded',
    'centrifugo_connection_rate_limiter_disabled',
    'Retry-After',
  ]) {
    assert.ok(
      doc.includes(name),
      `docs/centrifugo-connection-rate-limiting.md must document ${name}`,
    );
  }
  assert.ok(
    !doc.includes(String.fromCharCode(0x2014)),
    'documentation must not contain an em dash',
  );
});

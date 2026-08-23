import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function serviceBlock(document, service) {
  const lines = document.split(/\r?\n/);
  const servicesIndex = lines.findIndex((line) => line.trim() === 'services:');
  assert.notEqual(servicesIndex, -1, 'compose document must contain services');

  const start = lines.findIndex(
    (line, index) => index > servicesIndex && line === `  ${service}:`,
  );
  assert.notEqual(start, -1, `compose document must define ${service}`);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line) && line.trim() !== '') {
      end = index;
      break;
    }
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(line)) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

const config = JSON.parse(read('config/centrifugo/config.json'));
const production = read('docker-compose.yml');
const development = read('docker-compose.dev.yml');

test('Centrifugo v5 is configured to use the Redis engine', () => {
  assert.equal(config.engine, 'redis');
  assert.equal(config.redis_address, 'redis://cache:6379');
  assert.equal(config.redis_prefix, 'centrifugo');
  assert.equal(config.prometheus, true);
});

test('both Compose stacks mount the checked-in Centrifugo config and depend on Redis', () => {
  for (const [name, document] of [
    ['production', production],
    ['development', development],
  ]) {
    const websocket = serviceBlock(document, 'websocket');
    assert.match(websocket, /image: centrifugo\/centrifugo:v5/);
    assert.match(websocket, /centrifugo -c \/centrifugo\/config\.json/);
    assert.match(websocket, /\.\/config\/centrifugo:\/centrifugo/);
    assert.match(websocket, /(?:^|\n)      (?:- cache\s*$|cache:\s*$)/m, `${name} websocket must depend on cache`);
    assert.match(websocket, /http:\/\/localhost:8000\/health/);
  }
});

test('Redis remains a healthy persisted dependency in both Compose stacks', () => {
  for (const document of [production, development]) {
    const cache = serviceBlock(document, 'cache');
    assert.match(cache, /image: redis:7-alpine/);
    assert.match(cache, /redis-server --appendonly yes/);
    assert.match(cache, /redis-cli', 'ping/);
  }
});

test('production injects deployment credentials instead of relying on checked-in placeholders', () => {
  const websocket = serviceBlock(production, 'websocket');
  assert.match(
    websocket,
    /CENTRIFUGO_TOKEN_HMAC_SECRET_KEY:\s*\$\{CENTRIFUGO_SECRET:\?CENTRIFUGO_SECRET is required\}/,
  );
  assert.match(
    websocket,
    /CENTRIFUGO_API_KEY:\s*\$\{CENTRIFUGO_API_KEY:\?CENTRIFUGO_API_KEY is required\}/,
  );
  assert.match(
    websocket,
    /CENTRIFUGO_ALLOWED_ORIGINS:\s*\$\{FRONTEND_URL:\?FRONTEND_URL is required\}/,
  );

  assert.match(config.token_hmac_secret_key, /change-in-prod$/);
  assert.match(config.api_key, /change-in-prod$/);
});

test('the deployment environment documents matching backend and Centrifugo credentials', () => {
  const envExample = read('.env.example');
  assert.match(envExample, /^CENTRIFUGO_API_KEY=/m);
  assert.match(envExample, /^CENTRIFUGO_SECRET=/m);
  assert.match(envExample, /^FRONTEND_URL=/m);
});

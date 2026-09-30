import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const composeFiles = ['docker-compose.yml', 'docker-compose.dev.yml'];
const requiredServices = ['api', 'web', 'cache', 'websocket', 'sfu'];

function readCompose(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function serviceBlock(document, service) {
  const lines = document.split(/\r?\n/);
  const servicesIndex = lines.findIndex((line) => line.trim() === 'services:');
  assert.notEqual(servicesIndex, -1, 'compose document must contain a services block');

  const start = lines.findIndex(
    (line, index) => index > servicesIndex && line === `  ${service}:`,
  );
  assert.notEqual(start, -1, `compose document must define service ${service}`);

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

function expectDependency(block, dependency) {
  const dependencyPattern = new RegExp(
    `(?:^|\\n)      (?:- ${dependency}\\s*$|${dependency}:\\s*$)`,
    'm',
  );
  assert.match(block, dependencyPattern, `expected dependency on ${dependency}`);
}

test('both compose files retain the five core application services', () => {
  for (const path of composeFiles) {
    const document = readCompose(path);
    for (const service of requiredServices) {
      assert.ok(serviceBlock(document, service), `${path} must define ${service}`);
    }
  }
});

test('core services remain on the approved technology stack', () => {
  for (const path of composeFiles) {
    const document = readCompose(path);

    assert.match(serviceBlock(document, 'cache'), /image: redis:7-alpine/);
    assert.match(serviceBlock(document, 'websocket'), /image: centrifugo\/centrifugo:v5/);
    assert.match(serviceBlock(document, 'sfu'), /image: livekit\/livekit-server:/);
  }

  const production = readCompose('docker-compose.yml');
  assert.match(serviceBlock(production, 'api'), /context: \.\/backend/);
  assert.match(serviceBlock(production, 'web'), /context: \.\/frontend/);

  const development = readCompose('docker-compose.dev.yml');
  assert.match(serviceBlock(development, 'api'), /\.\/backend:\/app/);
  assert.match(serviceBlock(development, 'web'), /\.\/frontend:\/app/);
});

test('core dependency ordering remains explicit', () => {
  for (const path of composeFiles) {
    const document = readCompose(path);

    expectDependency(serviceBlock(document, 'api'), 'cache');
    expectDependency(serviceBlock(document, 'api'), 'websocket');
    expectDependency(serviceBlock(document, 'web'), 'api');
    expectDependency(serviceBlock(document, 'websocket'), 'cache');
  }
});

test('every core service retains health and network contracts', () => {
  for (const path of composeFiles) {
    const document = readCompose(path);
    for (const service of requiredServices) {
      assert.match(
        serviceBlock(document, service),
        /healthcheck:/,
        `${path} ${service} must retain a healthcheck`,
      );
    }

    assert.match(serviceBlock(document, 'api'), /3000:3000/);
    assert.match(serviceBlock(document, 'websocket'), /8000:8000/);
    assert.match(serviceBlock(document, 'sfu'), /7880:7880/);
    assert.match(serviceBlock(document, 'sfu'), /3478:3478\/udp/);
  }

  assert.match(serviceBlock(readCompose('docker-compose.yml'), 'web'), /80:80/);
  assert.match(serviceBlock(readCompose('docker-compose.dev.yml'), 'web'), /4200:4200/);
});

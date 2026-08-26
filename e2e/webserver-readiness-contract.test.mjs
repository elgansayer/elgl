import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const configSource = readFileSync(new URL('./playwright.config.ts', import.meta.url), 'utf8');
const readinessSource = readFileSync(new URL('./backend-readiness.mjs', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

test('gates the Angular web server on backend readiness', () => {
  const readinessIndex = configSource.indexOf('node ./backend-readiness.mjs');
  const frontendStartIndex = configSource.indexOf('cd ../frontend && npm run start');

  assert.notEqual(readinessIndex, -1, 'Playwright must invoke the backend readiness gate');
  assert.notEqual(frontendStartIndex, -1, 'Playwright must start the Angular frontend');
  assert.ok(
    readinessIndex < frontendStartIndex,
    'backend readiness must complete before Angular starts',
  );
  assert.match(
    configSource,
    /node \.\/backend-readiness\.mjs && cd \.\.\/frontend && npm run start/,
    'the frontend webServer command must fail closed when readiness fails',
  );
});

test('uses one configurable backend health target for Playwright and the readiness helper', () => {
  assert.match(configSource, /process\.env\.E2E_BACKEND_HEALTH_URL/);
  assert.match(configSource, /url: backendHealthUrl/);
  assert.match(readinessSource, /process\.env\.E2E_BACKEND_HEALTH_URL/);
  assert.match(readinessSource, /http:\/\/127\.0\.0\.1:3000\/api\/health/);
});

test('keeps readiness bounded and tolerant of transient connection refusal', () => {
  assert.match(readinessSource, /DEFAULT_TIMEOUT_MS = 180_000/);
  assert.match(readinessSource, /DEFAULT_ATTEMPT_TIMEOUT_MS = 2_000/);
  assert.match(readinessSource, /catch \{[\s\S]*Connection refusal is expected/);
  assert.match(readinessSource, /Backend did not become healthy within \$\{timeoutMs\}ms/);
});

test('runs the webServer contract before Playwright test discovery', () => {
  assert.match(packageJson.scripts.pretest, /test:readiness/);
  assert.match(packageJson.scripts.pretest, /test:webserver-readiness-contract/);
  assert.match(packageJson.scripts.pretest, /test:chat-composer-contract/);
});

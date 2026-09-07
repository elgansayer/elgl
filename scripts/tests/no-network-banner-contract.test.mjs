import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

test('app shell mounts the global no-network banner', async () => {
  const appComponent = await read('frontend/src/app/app.component.ts');
  const appTemplate = await read('frontend/src/app/app.component.html');

  assert.match(appComponent, /NoNetworkBannerComponent/);
  assert.match(appTemplate, /<app-no-network-banner\s*\/>/);
});

test('banner renders only while offline with translated assertive alert semantics', async () => {
  const banner = await read(
    'frontend/src/app/components/primitives/no-network-banner/no-network-banner.component.ts',
  );

  assert.match(banner, /@if \(!isOnline\(\)\)/);
  assert.match(banner, /readonly isOnline = this\.networkStatus\.isOnline/);
  assert.match(banner, /role="alert"/);
  assert.match(banner, /aria-live="assertive"/);
  assert.match(banner, /no_network_banner\.message/);
  assert.match(banner, /aria-hidden="true"/);
  assert.match(banner, /fixed top-0 inset-x-0/);
});

test('network status starts SSR-safe and tracks browser online and offline events', async () => {
  const service = await read('frontend/src/app/services/network-status.service.ts');

  assert.match(service, /typeof navigator === 'undefined' \? true : navigator\.onLine/);
  assert.match(service, /window\.addEventListener\('online', this\.handleOnline\)/);
  assert.match(service, /window\.addEventListener\('offline', this\.handleOffline\)/);
  assert.match(service, /this\.onlineSignal\.set\(true\)/);
  assert.match(service, /this\.onlineSignal\.set\(false\)/);
  assert.match(service, /readonly isOnline = this\.onlineSignal\.asReadonly\(\)/);
});

test('connectivity contract does not introduce polling or network requests', async () => {
  const service = await read('frontend/src/app/services/network-status.service.ts');

  assert.doesNotMatch(service, /\bfetch\s*\(/);
  assert.doesNotMatch(service, /HttpClient/);
  assert.doesNotMatch(service, /setInterval\s*\(/);
  assert.doesNotMatch(service, /setTimeout\s*\(/);
});

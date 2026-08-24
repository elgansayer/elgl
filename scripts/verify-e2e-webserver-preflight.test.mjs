import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const configUrl = new URL('../e2e/playwright.config.ts', import.meta.url);

test('Playwright compiles the Angular app before waiting for the frontend web server', async () => {
  const source = await readFile(configUrl, 'utf8');

  assert.match(
    source,
    /command:\s*'cd \.\.\/frontend && npm run build && npm run start -- --host 127\.0\.0\.1'/,
    'frontend webServer must fail immediately on Angular/TypeScript build errors before starting ng serve',
  );
  assert.match(source, /url:\s*'http:\/\/localhost:4200'/);
});

test('Playwright keeps the backend build preflight as well', async () => {
  const source = await readFile(configUrl, 'utf8');

  assert.match(
    source,
    /command:\s*'cd \.\.\/backend && npm run build && node dist\/main'/,
    'backend webServer must continue to fail fast on compilation errors',
  );
});

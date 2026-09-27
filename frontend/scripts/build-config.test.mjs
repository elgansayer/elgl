import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const angularConfigUrl = new URL('../angular.json', import.meta.url);

test('production builds do not require remote font downloads', async () => {
  const angularConfig = JSON.parse(await readFile(angularConfigUrl, 'utf8'));
  const production =
    angularConfig.projects.frontend.architect.build.configurations.production;

  assert.equal(production.optimization.fonts, false);
});

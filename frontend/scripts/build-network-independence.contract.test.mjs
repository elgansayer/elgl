import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const angularConfig = JSON.parse(
  readFileSync(new URL('../angular.json', import.meta.url), 'utf8'),
);

test('production builds do not require network access to inline external fonts', () => {
  const production = angularConfig.projects.frontend.architect.build.configurations.production;

  assert.equal(production.optimization.scripts, true);
  assert.equal(production.optimization.styles, true);
  assert.equal(production.optimization.fonts.inline, false);
});

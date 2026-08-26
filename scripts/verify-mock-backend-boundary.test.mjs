import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyMockBackendBoundary } from './verify-mock-backend-boundary.mjs';

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'elgl-mock-boundary-'));
  const files = {
    'backend/src/config/environment.validation.ts':
      'assertMockBackendActivationBoundary(rawConfig);',
    'backend/src/config/mock-backend-mode.ts':
      "const modes = ['disabled', 'local', 'test', 'demo'];",
    'frontend/src/app/core/config/configuration.service.ts':
      'const MOCK_CLIENT_ENVIRONMENTS = new Set();',
    'frontend/src/app/components/primitives/no-network-banner/no-network-banner.component.ts':
      '<div data-testid="mock-backend-indicator"></div>',
    '.github/workflows/ci.yml': 'name: CI\n',
  };

  for (const [path, content] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, content);
  }
  return root;
}

test('accepts a repository with an explicit fail-closed boundary', () => {
  assert.deepEqual(verifyMockBackendBoundary(fixtureRoot()), []);
});

test('rejects an enabled mock backend in production workflow/configuration', () => {
  const root = fixtureRoot();
  writeFileSync(
    join(root, '.github/workflows/ci.yml'),
    'env:\n  MOCK_BACKEND_MODE: demo\n',
  );
  assert.match(verifyMockBackendBoundary(root).join('\n'), /enables MOCK_BACKEND_MODE/);
});

test('requires the visible client indicator contract', () => {
  const root = fixtureRoot();
  writeFileSync(
    join(
      root,
      'frontend/src/app/components/primitives/no-network-banner/no-network-banner.component.ts',
    ),
    '<div></div>',
  );
  assert.match(verifyMockBackendBoundary(root).join('\n'), /mock-backend-indicator/);
});

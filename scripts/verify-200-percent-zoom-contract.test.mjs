import assert from 'node:assert/strict';
import test from 'node:test';

import { verify200PercentZoomContract } from './verify-200-percent-zoom-contract.mjs';

const representativeIds = [
  'screen.discovery',
  'screen.chat',
  'screen.vocabulary',
  'screen.moderation',
];

function matrixWith(states) {
  return {
    rendering: {
      viewportMobile: { width: 390, height: 844 },
      viewportTabletMd: { width: 768, height: 1024 },
    },
    contracts: representativeIds.map((designSyncId) => ({
      designSyncId,
      states: [...states],
    })),
  };
}

const requiredStates = [
  'light',
  'dark',
  'rtl',
  'mobile-390-text-200',
  'tablet-768-text-200',
];

const validHarness = `
const mobileStates = {
  'mobile-390-text-200': { mode: 'text-200' },
};
const tabletStates = {
  'tablet-768-text-200': { viewport: 'md', mode: 'text-200' },
};
document.documentElement.style.fontSize = '200%';
assertNoHorizontalDocumentOverflow(state, '390px mobile layout');
assertNoHorizontalDocumentOverflow(state, 'tablet layout');
`;

test('accepts the repository 200% zoom verification contract', () => {
  assert.deepEqual(
    verify200PercentZoomContract(matrixWith(requiredStates), validHarness),
    [],
  );
});

test('requires light and dark theme coverage on every representative', () => {
  const failures = verify200PercentZoomContract(
    matrixWith(requiredStates.filter((state) => state !== 'dark')),
    validHarness,
  );
  assert.equal(failures.filter((failure) => failure.endsWith('dark')).length, 4);
});

test('requires RTL alongside 200% reflow coverage', () => {
  const failures = verify200PercentZoomContract(
    matrixWith(requiredStates.filter((state) => state !== 'rtl')),
    validHarness,
  );
  assert.equal(failures.filter((failure) => failure.endsWith('rtl')).length, 4);
});

test('requires both mobile and tablet 200% states', () => {
  const states = requiredStates.filter((state) => !state.endsWith('text-200'));
  const failures = verify200PercentZoomContract(matrixWith(states), validHarness);
  assert.equal(
    failures.filter((failure) => failure.includes('text-200')).length,
    8,
  );
});

test('requires the visual harness to apply 200% text scale and reject overflow', () => {
  const failures = verify200PercentZoomContract(
    matrixWith(requiredStates),
    'const mobileStates = {}; const tabletStates = {};',
  );
  assert.ok(failures.some((failure) => failure.includes('200% root text scale')));
  assert.ok(
    failures.some((failure) => failure.includes('horizontal document overflow')),
  );
});

test('requires the canonical effective viewports', () => {
  const matrix = matrixWith(requiredStates);
  matrix.rendering.viewportMobile.width = 400;
  matrix.rendering.viewportTabletMd.width = 800;
  const failures = verify200PercentZoomContract(matrix, validHarness);
  assert.ok(failures.some((failure) => failure.includes('390px')));
  assert.ok(failures.some((failure) => failure.includes('768px')));
});

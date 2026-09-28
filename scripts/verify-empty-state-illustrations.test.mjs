import assert from 'node:assert/strict';
import test from 'node:test';
import {
  illustrationContracts,
  validateIllustrationSvg,
  verifyEmptyStateIllustrations,
} from './verify-empty-state-illustrations.mjs';

const safeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160" aria-hidden="true" focusable="false">
  <path d="M20 20h40v40H20z" fill="#778199" />
</svg>`;

test('declares exactly the three product empty-state illustration contracts', () => {
  assert.deepEqual(
    illustrationContracts.map(({ name }) => name),
    ['No Messages', 'No Moments Found', 'No Users Nearby'],
  );
});

test('accepts a bounded decorative vector with no active content', () => {
  assert.deepEqual(validateIllustrationSvg(safeSvg, 'safe'), []);
});

test('rejects missing responsive and decorative accessibility metadata', () => {
  const errors = validateIllustrationSvg('<svg><path d="M0 0h1v1z"/></svg>', 'bad');

  assert.ok(errors.some((error) => error.includes('viewBox')));
  assert.ok(errors.some((error) => error.includes('aria-hidden')));
  assert.ok(errors.some((error) => error.includes('focusable')));
});

test('rejects active, remote, raster, animated and localised SVG content', () => {
  const unsafeSvg = `
    <svg viewBox="0 0 240 160" aria-hidden="true" focusable="false" onload="run()">
      <script>alert(1)</script>
      <foreignObject><div>unsafe</div></foreignObject>
      <image href="https://example.com/photo.png" />
      <text>Not localised</text>
      <animate attributeName="opacity" values="0;1" />
    </svg>`;
  const errors = validateIllustrationSvg(unsafeSvg, 'unsafe');

  assert.ok(errors.some((error) => error.includes('scripts')));
  assert.ok(errors.some((error) => error.includes('foreignObject')));
  assert.ok(errors.some((error) => error.includes('raster')));
  assert.ok(errors.some((error) => error.includes('event handlers')));
  assert.ok(errors.some((error) => error.includes('resource references')));
  assert.ok(errors.some((error) => error.includes('localised text')));
  assert.ok(errors.some((error) => error.includes('animation')));
});

test('keeps every checked-in asset present, safe and wired to its product surface', async () => {
  const result = await verifyEmptyStateIllustrations();

  assert.equal(result.count, 3);
  assert.equal(result.assets.length, 3);
});

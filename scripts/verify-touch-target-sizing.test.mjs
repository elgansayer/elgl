import test from 'node:test';
import assert from 'node:assert/strict';

import {
  newlyIntroducedViolations,
  scanAngularSource,
  scanTemplate,
  validateSharedTouchVariants,
} from './verify-touch-target-sizing.mjs';

test('accepts canonical touch and icon-touch Spartan actions in light and dark classes', () => {
  const source = `
    <button hlmBtn size="touch" class="bg-surface-500 dark:bg-surface-400">Save</button>
    <button hlmBtn size="icon-touch" aria-label="Close">×</button>
  `;
  assert.deepEqual(scanTemplate(source), []);
});

test('rejects default and explicitly compact standalone Spartan actions', () => {
  const source = `
    <button hlmBtn>Save</button>
    <button hlmBtn size="sm">Retry</button>
    <a hlmBtn size="icon" routerLink="/settings">Settings</a>
  `;
  const failures = scanTemplate(source);
  assert.equal(failures.length, 3);
  assert.ok(failures.every((failure) => failure.code === 'undersized-spartan-action'));
});

test('allows audited compact exceptions and dynamic Relay-owned sizing', () => {
  const source = `
    <button hlmBtn size="sm" data-touch-target-exception>Dense grid action</button>
    <button hlmBtn [size]="helmSize()">Shared wrapper action</button>
  `;
  assert.deepEqual(scanTemplate(source), []);
});

test('rejects click handlers attached directly to generic glyph and text targets', () => {
  const source = `
    <span (click)="open()">Open</span>
    <ng-icon (click)="close()" />
  `;
  const failures = scanTemplate(source);
  assert.deepEqual(
    failures.map((failure) => failure.code),
    ['generic-click-target', 'generic-click-target'],
  );
});

test('allows native prose links and labelled checkbox rows without inventing touch failures', () => {
  const source = `
    <a href="/terms">Terms</a>
    <label class="flex min-h-11 items-center gap-3" for="notify">
      <input id="notify" type="checkbox" />
      <span>Notify me</span>
    </label>
  `;
  assert.deepEqual(scanTemplate(source), []);
});

test('scans inline Angular templates with stable source line offsets', () => {
  const source = `
@Component({
  template: \`
    <button hlmBtn size="sm">Compact</button>
  \`,
})
export class Example {}
`;
  const failures = scanAngularSource(source, 'example.component.ts');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].file, 'example.component.ts');
  assert.ok(failures[0].line >= 3);
});

test('does not fail unchanged legacy debt but catches an added occurrence during migration', () => {
  const legacy = scanTemplate('<button hlmBtn size="sm">Legacy</button>');
  const unchanged = scanTemplate('<button hlmBtn size="sm">Legacy</button>');
  const worsened = scanTemplate(`
    <button hlmBtn size="sm">Legacy</button>
    <button hlmBtn size="sm">New</button>
  `);

  assert.deepEqual(newlyIntroducedViolations(unchanged, legacy), []);
  assert.equal(newlyIntroducedViolations(worsened, legacy).length, 1);
});

test('requires shared touch variants to preserve the 44 CSS pixel baseline', () => {
  const valid = `
    size: {
      touch: 'min-h-11 gap-2 px-4',
      'icon-touch': 'size-11',
    }
  `;
  assert.deepEqual(validateSharedTouchVariants(valid), []);

  const failures = validateSharedTouchVariants(`
    size: {
      touch: 'min-h-10',
      'icon-touch': 'size-10',
    }
  `);
  assert.equal(failures.length, 2);
  assert.ok(failures.every((failure) => failure.code === 'shared-touch-variant-regression'));
});

test('theme and logical RTL utility changes do not alter touch-target semantics', () => {
  const source = `
    <button
      hlmBtn
      size="touch"
      class="ms-auto bg-primary text-on-fill dark:bg-primary rtl:me-auto"
    >
      Continue
    </button>
  `;
  assert.deepEqual(scanTemplate(source), []);
});

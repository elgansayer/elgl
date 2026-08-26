import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareKeyboardFindings,
  scanKeyboardInteractionSource,
} from './verify-keyboard-interaction-contract.mjs';

function violationRules(source) {
  return scanKeyboardInteractionSource(source).violations.map(({ rule }) => rule);
}

test('rejects positive tabindex while allowing normal sequential focus', () => {
  assert.deepEqual(violationRules('<button tabindex="0">Save</button>'), []);
  assert.deepEqual(violationRules('<button tabindex="2">Save</button>'), ['positive-tabindex']);
});

test('rejects new appA11yClickable compatibility call sites', () => {
  assert.deepEqual(violationRules('<article appA11yClickable>Profile</article>'), ['a11y-clickable']);
});

test('rejects deprecated numeric keyboard APIs', () => {
  assert.deepEqual(violationRules('if (event.keyCode === 13 || event.which === 32) activate();'), [
    'deprecated-key-api',
    'deprecated-key-api',
  ]);
});

test('rejects synthetic button Enter or Space emulation but not native buttons', () => {
  assert.deepEqual(
    violationRules('<div role="button" tabindex="0" (keydown.enter)="save()">Save</div>'),
    ['synthetic-button-keyboard'],
  );
  assert.deepEqual(violationRules('<button type="button" (click)="save()">Save</button>'), []);
});

test('rejects obvious feature-owned roving tabindex state', () => {
  assert.deepEqual(
    violationRules('<li [attr.tabindex]="selectedIndex === index ? 0 : -1">Option</li>'),
    ['feature-roving-tabindex'],
  );
});

test('reports local Escape handling for review without failing the migration', () => {
  const result = scanKeyboardInteractionSource('<section (keydown.escape)="close()"></section>');
  assert.equal(result.violations.length, 0);
  assert.equal(result.warnings[0]?.rule, 'escape-review');
});

test('reports Enter handlers on text-entry controls for IME review', () => {
  const result = scanKeyboardInteractionSource('<input (keydown.enter)="submit($event)" />');
  assert.equal(result.violations.length, 0);
  assert.equal(result.warnings[0]?.rule, 'ime-review');
});

test('does not fail unchanged migration debt', () => {
  const source = '<div role="button" (keydown.enter)="open()">Open</div>';
  assert.deepEqual(compareKeyboardFindings(source, source).violations, []);
});

test('fails when a changed file introduces an additional prohibited pattern', () => {
  const before = '<button type="button">Save</button>';
  const current = `${before}\n<div role="button" (keydown.space)="save()">Save</div>`;
  assert.equal(compareKeyboardFindings(before, current).violations.length, 1);
});

test('records useful line numbers for migration failures', () => {
  const result = scanKeyboardInteractionSource('<p>Intro</p>\n<span tabindex="3">Bad</span>');
  assert.equal(result.violations[0]?.line, 2);
});

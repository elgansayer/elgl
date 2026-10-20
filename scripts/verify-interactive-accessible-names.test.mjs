import assert from 'node:assert/strict';
import test from 'node:test';

import { auditSource } from './verify-interactive-accessible-names.mjs';

test('rejects icon-only native buttons without an accessible name', () => {
  const failures = auditSource(
    `<button type="button"><svg aria-hidden="true"></svg></button>`,
    'fixture.html',
  );

  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.tagName, 'button');
  assert.equal(failures[0]?.line, 1);
});

test('accepts explicit aria-label and aria-labelledby bindings', () => {
  const source = `
    <button type="button" aria-label="Close"><svg></svg></button>
    <button type="button" [attr.aria-label]="closeLabel"><svg></svg></button>
    <button type="button" aria-labelledby="dialog-title"><svg></svg></button>
    <button type="button" [attr.aria-labelledby]="labelId"><svg></svg></button>
  `;

  assert.deepEqual(auditSource(source, 'fixture.html'), []);
});

test('accepts visible, translated, screen-reader, and image alternative text', () => {
  const source = `
    <button type="button">Save</button>
    <button type="button">{{ 'common.close' | translate }}</button>
    <button type="button"><span class="sr-only">Close</span><svg></svg></button>
    <button type="button"><img src="avatar.png" alt="Open profile" /></button>
  `;

  assert.deepEqual(auditSource(source, 'fixture.html'), []);
});

test('rejects empty aria-label values', () => {
  const failures = auditSource(
    `<button type="button" aria-label="   "><svg></svg></button>`,
    'fixture.html',
  );

  assert.equal(failures.length, 1);
});

test('audits interactive anchors but ignores anchors without navigation', () => {
  const source = `
    <a routerLink="/settings"><svg></svg></a>
    <a><svg></svg></a>
  `;

  const failures = auditSource(source, 'fixture.html');
  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.tagName, 'a');
});

test('audits custom role=button controls', () => {
  const failures = auditSource(
    `<div role="button" tabindex="0"><svg></svg></div>`,
    'fixture.html',
  );

  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.tagName, 'div');
});

test('does not mistake Angular control-flow syntax for visible text', () => {
  const failures = auditSource(
    `<button type="button">@if (open) { <svg></svg> } @else { <svg></svg> }</button>`,
    'fixture.html',
  );

  assert.equal(failures.length, 1);
});

test('reports the source line for actionable CI diagnostics', () => {
  const failures = auditSource(
    `\n<section>\n  <button type="button"><svg></svg></button>\n</section>`,
    'fixture.html',
  );

  assert.equal(failures[0]?.line, 3);
});

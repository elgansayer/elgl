import assert from 'node:assert/strict';
import test from 'node:test';

import {
  newViolations,
  scanAngularSource,
  scanTemplate,
} from './verify-screen-reader-naming.mjs';

test('rejects hardcoded product aria-label copy', () => {
  const failures = scanTemplate(
    '<button type="button" aria-label="Save profile"></button>',
    'frontend/src/app/profile/profile.html',
  );

  assert.equal(failures.length, 1);
  assert.equal(failures[0].code, 'hardcoded-aria-label');
  assert.match(failures[0].remediation, /translated/);
});

test('rejects generic static accessible names', () => {
  const failures = scanTemplate(
    '<button type="button" aria-label="Button"></button>',
    'frontend/src/app/example/example.html',
  );

  assert.equal(failures.length, 1);
  assert.equal(failures[0].code, 'generic-aria-label');
});

test('allows translated and explicitly reviewed static accessible names', () => {
  const source = `
    <button [attr.aria-label]="'profile.save' | t"></button>
    <a href="https://github.com" aria-label="GitHub" data-screen-reader-naming-ok></a>
  `;

  assert.deepEqual(scanTemplate(source), []);
});

test('rejects positive tabindex while allowing native-order values', () => {
  const source = `
    <button tabindex="0">A</button>
    <div tabindex="-1">B</div>
    <button tabindex="2">C</button>
  `;
  const failures = scanTemplate(source);

  assert.equal(failures.length, 1);
  assert.equal(failures[0].code, 'positive-tabindex');
});

test('rejects duplicate literal ids in one template', () => {
  const failures = scanTemplate(`
    <h2 id="dialog-title">First</h2>
    <h2 id="dialog-title">Second</h2>
  `);

  assert.equal(failures.length, 1);
  assert.equal(failures[0].code, 'duplicate-literal-id');
  assert.match(failures[0].detail, /dialog-title/);
});

test('rejects missing literal IDREF and label targets', () => {
  const failures = scanTemplate(`
    <label for="email">Email</label>
    <input id="other" aria-describedby="email-help" />
  `);

  assert.deepEqual(
    failures.map((failure) => failure.code).sort(),
    ['missing-idref-target', 'missing-label-target'],
  );
});

test('accepts complete naming relationships in light and dark presentation states', () => {
  for (const theme of ['light', 'dark']) {
    const source = `
      <section data-theme="${theme}" class="bg-surface-50 dark:bg-surface-900">
        <label for="search">{{ 'search.label' | t }}</label>
        <input id="search" aria-describedby="search-help search-error" />
        <p id="search-help">{{ 'search.help' | t }}</p>
        <p id="search-error" role="alert">{{ error() }}</p>
      </section>
    `;

    assert.deepEqual(scanTemplate(source), []);
  }
});

test('accepts dynamic instance-safe IDs and primitive-owned bindings', () => {
  const source = `
    <label [for]="fieldId()">{{ label() }}</label>
    <input [id]="fieldId()" [attr.aria-describedby]="descriptionId()" />
  `;

  assert.deepEqual(scanTemplate(source), []);
});

test('scans inline Angular templates as well as external templates', () => {
  const failures = scanAngularSource(
    `@Component({ template: \`<button aria-label="Modal"></button>\` }) export class Example {}`,
    'frontend/src/app/example/example.component.ts',
  );

  assert.equal(failures.length, 1);
  assert.equal(failures[0].code, 'generic-aria-label');
  assert.match(failures[0].file, /inline-template-1/);
});

test('migration comparison reports only newly introduced violations', () => {
  const baseline = scanTemplate('<button aria-label="Old debt"></button>');
  const current = scanTemplate(`
    <button aria-label="Old debt"></button>
    <button tabindex="3">New debt</button>
  `);

  const added = newViolations(current, baseline);
  assert.equal(added.length, 1);
  assert.equal(added[0].code, 'positive-tabindex');
});

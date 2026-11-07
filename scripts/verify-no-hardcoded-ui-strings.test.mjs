import assert from 'node:assert/strict';
import test from 'node:test';

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  auditRoots,
  bareCopyLiterals,
  decodeStringEscapes,
  extractInlineTemplates,
  findMissingTranslationKeys,
  scanMessageLiterals,
  scanNativeDialogLiterals,
  scanSourceFile,
  scanTemplate,
} from './verify-no-hardcoded-ui-strings.mjs';

const codes = (violations) => violations.map((violation) => violation.code);

test('flags visible copy written directly in a template', () => {
  const violations = scanTemplate(
    '<h1>Welcome back</h1>\n<p>{{ "home.tagline" | t }}</p>',
    'fixture.html',
  );
  assert.deepEqual(codes(violations), ['static-text-node']);
  assert.equal(violations[0].line, 1);
  assert.equal(violations[0].detail, 'Welcome back');
});

test('accepts copy that flows through the translation pipe', () => {
  const source = `
    <h1>{{ 'home.title' | t }}</h1>
    <button [attr.aria-label]="'common.close' | t" [title]="'common.close' | t">
      {{ (isOpen() ? 'common.hide' : 'common.show') | t }}
    </button>
    <img [alt]="'profile.avatarAlt' | t" src="a.png" />
  `;
  assert.deepEqual(scanTemplate(source, 'fixture.html'), []);
});

test('ignores Angular control flow headers, comments, scripts, styles and entities', () => {
  const source = `
    <!-- Plain English comment -->
    @if (items().length > 0 && user()?.id === 'abc') {
      <ul>
        @for (item of items(); track item.id) {
          <li>{{ item.name }}</li>
        } @empty {
          <li>{{ 'list.empty' | t }}</li>
        }
      </ul>
    } @else if (loading()) {
      <span>{{ 'common.loading' | t }}</span>
    } @else {
      &middot;&nbsp;&times;
    }
    @let heading = 'Not rendered copy';
    <script>const greeting = 'Hello';</script>
    <style>.a::after { content: 'Hello'; }</style>
  `;
  assert.deepEqual(scanTemplate(source, 'fixture.html'), []);
});

test('flags copy inside control flow bodies with the correct line', () => {
  const source = ['@if (ready()) {', '  <p>', '    Ready to go', '  </p>', '}'].join('\n');
  const violations = scanTemplate(source, 'fixture.html');
  assert.deepEqual(codes(violations), ['static-text-node']);
  assert.equal(violations[0].line, 3);
});

test('flags static assistive attributes on native and component elements', () => {
  const source = [
    '<button aria-label="Close dialog"></button>',
    '<img alt="avatar" src="a.png" />',
    '<input placeholder="Type a message..." />',
    '<app-card heading="Recommended for you"></app-card>',
    '<div title="Delete {{ name }}"></div>',
  ].join('\n');
  const violations = scanTemplate(source, 'fixture.html');
  assert.deepEqual(codes(violations), Array(5).fill('static-copy-attribute'));
  assert.deepEqual(
    violations.map((violation) => violation.line),
    [1, 2, 3, 4, 5],
  );
});

test('ignores attributes without letters, translated interpolations and non-copy attributes', () => {
  const source = [
    '<button aria-label="{{ \'common.close\' | t }}"></button>',
    '<div title="42"></div>',
    '<input placeholder="" />',
    '<a href="https://example.com" class="Close" id="Close" data-label="Close"></a>',
    '<input (focus)="open(\'Close\')" #ref />',
  ].join('\n');
  assert.deepEqual(scanTemplate(source, 'fixture.html'), []);
});

test('flags bare literals bound to copy attributes but not piped or dynamic ones', () => {
  const source = [
    `<button [attr.aria-label]="'Close'"></button>`,
    `<button [attr.aria-label]="isOpen() ? 'Hide' : 'Show'"></button>`,
    `<button [attr.aria-label]="'common.close' | t"></button>`,
    `<button [attr.aria-label]="label()"></button>`,
    `<input [placeholder]="'Search' + suffix()" />`,
  ].join('\n');
  const violations = scanTemplate(source, 'fixture.html');
  assert.deepEqual(codes(violations), ['literal-copy-binding', 'literal-copy-binding']);
  assert.deepEqual(
    violations.map((violation) => violation.line),
    [1, 2],
  );
});

test('treats dotted translation keys on components as keys but on native elements as copy', () => {
  const source = [
    '<app-input label="deck.nameLabel" [placeholder]="\'deck.namePlaceholder\'" />',
    '<app-select ariaLabel="events.languagePair" />',
    '<input placeholder="deck.namePlaceholder" />',
    '<app-input [placeholder]="\'Type here\'" />',
  ].join('\n');
  const violations = scanTemplate(source, 'fixture.html');
  assert.deepEqual(
    violations.map((violation) => [violation.code, violation.line]),
    [
      ['static-copy-attribute', 3],
      ['literal-copy-binding', 4],
    ],
  );
});

test('flags interpolations that resolve directly to literal copy', () => {
  const source = [
    `{{ 'Hello' }}`,
    `{{ creating() ? 'Creating...' : 'Create' }}`,
    `{{ 'common.close' | t }}`,
    `{{ playing() ? '\\u23F8' : '\\u25B6' }}`,
    `{{ count() + ' items' }}`,
  ].join('\n');
  const violations = scanTemplate(source, 'fixture.html');
  assert.deepEqual(codes(violations), ['literal-copy-interpolation', 'literal-copy-interpolation']);
  assert.deepEqual(
    violations.map((violation) => violation.line),
    [1, 2],
  );
});

test('honours the translation-static-ok escape on the same line or the line above', () => {
  const source = [
    '<span>GitHub</span> <!-- translation-static-ok -->',
    '<!-- translation-static-ok: brand wordmark -->',
    '<span>ELGL</span>',
    '<img alt="Logo" src="logo.svg" data-policy="translation-static-ok" />',
    '<span>Unmarked</span>',
  ].join('\n');
  const violations = scanTemplate(source, 'fixture.html');
  assert.deepEqual(
    violations.map((violation) => [violation.code, violation.detail]),
    [['static-text-node', 'Unmarked']],
  );
});

test('applies the line offset used for inline templates', () => {
  const violations = scanTemplate('<p>Offset copy</p>', 'fixture.ts', 41);
  assert.equal(violations[0].line, 42);
});

test('extracts inline templates and reports lines relative to the TypeScript file', () => {
  const source = [
    `import { Component } from '@angular/core';`,
    `@Component({`,
    `  selector: 'app-x',`,
    '  template: `',
    '    <p>{{ "a.key" | t }}</p>',
    '    <p>Plain copy</p>',
    '  `,',
    `})`,
    `export class X {}`,
  ].join('\n');

  assert.equal(extractInlineTemplates(source).length, 1);
  const violations = scanSourceFile(source, 'x.component.ts');
  assert.deepEqual(
    violations.map((violation) => [violation.code, violation.line]),
    [['static-text-node', 6]],
  );
});

test('decodes JavaScript escapes before deciding whether a literal contains words', () => {
  assert.equal(decodeStringEscapes('\\u23F8\\u{25B6}\\x41\\n'), '⏸▶A\n');
  assert.deepEqual(bareCopyLiterals(`'\\u23F8'`), []);
  assert.deepEqual(bareCopyLiterals(`'Saved'`), ['Saved']);
  assert.deepEqual(bareCopyLiterals('`Total ${count()}`'), []);
  assert.deepEqual(bareCopyLiterals(`a ? ('Yes' | t) : 'No'`), []);
});

test('flags native dialogs that receive literal copy but not translated values', () => {
  const source = [
    `alert('View-once media will be shown here.');`,
    `if (window.confirm('Delete everything?')) {}`,
    `const answer = prompt(\`\${title}\\n\${options}\`);`,
    `alert(this.i18n.translate('chat.viewOnce'));`,
  ].join('\n');
  const violations = scanNativeDialogLiterals(source, 'fixture.ts');
  assert.deepEqual(
    violations.map((violation) => [violation.code, violation.line]),
    [
      ['native-dialog-literal', 1],
      ['native-dialog-literal', 2],
    ],
  );
});

test('flags sentence-like literals assigned to message state but not state tokens', () => {
  const source = [
    `this.errorMessage.set('Failed to save settings');`,
    `this.message.set(\`Challenge settled for \${coins} coins\`);`,
    `this.error.set('idle');`,
    `this.errorMessage.set(this.i18n.translate('settings.saveFailed'));`,
    `this.statusMessage = 'Upload complete, retrying shortly';`,
    `this.status.set('Not started yet');`,
  ].join('\n');
  const violations = scanMessageLiterals(source, 'fixture.ts');
  assert.deepEqual(
    violations.map((violation) => [violation.code, violation.line]),
    [
      ['literal-message-state', 1],
      ['literal-message-state', 2],
      ['literal-message-state', 5],
    ],
  );
});

test('does not scan translated message assignments or escaped message literals', () => {
  const source = [
    `// translation-static-ok: developer diagnostics only`,
    `this.errorMessage.set('Internal diagnostic failure');`,
  ].join('\n');
  assert.deepEqual(scanMessageLiterals(source, 'fixture.ts'), []);
});

test('treats pictographs and example values as non-copy but still flags words next to them', () => {
  const source = [
    '<span>ℹ️</span>',
    '<span>📷</span>',
    '<input placeholder="#c65230" />',
    '<input placeholder="https://example.com/avatar.png" />',
    '<input placeholder="name@example.com" />',
    '<span>📷 Media</span>',
  ].join('\n');
  const violations = scanTemplate(source, 'fixture.html');
  assert.deepEqual(
    violations.map((violation) => [violation.code, violation.line, violation.detail]),
    [['static-text-node', 6, '📷 Media']],
  );
});

test('flags copy passed to component inputs such as actionLabel and legend', () => {
  const source = [
    `<app-empty-state [title]="'No results'" actionLabel="Update profile" />`,
    `<app-empty-state [title]="'empty.title' | t" [actionLabel]="'empty.action' | t" />`,
    `<fieldset legend="Privacy"></fieldset>`,
  ].join('\n');
  const violations = scanTemplate(source, 'fixture.html');
  assert.deepEqual(
    violations.map((violation) => [violation.code, violation.line]),
    [
      ['literal-copy-binding', 1],
      ['static-copy-attribute', 1],
    ],
  );
});

test('scans html files and inline templates but skips specs and generated sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'hardcoded-ui-strings-'));
  try {
    mkdirSync(join(root, 'app', 'generated'), { recursive: true });
    writeFileSync(join(root, 'app', 'clean.html'), `<p>{{ 'a.key' | t }}</p>`);
    writeFileSync(join(root, 'app', 'dirty.html'), '<p>Dirty copy</p>');
    writeFileSync(
      join(root, 'app', 'inline.component.ts'),
      '@Component({ template: `<h1>Inline copy</h1>` })\nexport class InlineComponent {}\n',
    );
    writeFileSync(join(root, 'app', 'dirty.spec.ts'), 'template: `<p>Spec copy</p>`');
    writeFileSync(join(root, 'app', 'generated', 'api.ts'), 'template: `<p>Generated copy</p>`');

    const violations = auditRoots([join(root, 'app')], root);
    assert.deepEqual(
      violations.map((violation) => [violation.file, violation.line, violation.detail]),
      [
        ['app/dirty.html', 1, 'Dirty copy'],
        ['app/inline.component.ts', 1, 'Inline copy'],
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reports translation keys that the base dictionary cannot resolve', () => {
  const root = mkdtempSync(join(tmpdir(), 'hardcoded-ui-strings-'));
  try {
    mkdirSync(join(root, 'app'), { recursive: true });
    const dictionary = join(root, 'i18n.service.ts');
    writeFileSync(
      dictionary,
      [
        'export class I18nService {',
        '  private readonly baseDictionary = {',
        "    'common.close': 'Close',",
        "    'common.save': 'Save',",
        '  };',
        '}',
      ].join('\n'),
    );
    writeFileSync(
      join(root, 'app', 'view.html'),
      `<button>{{ 'common.close' | t }}</button><p>{{ 'orphan.title' | t }}</p>`,
    );
    writeFileSync(
      join(root, 'app', 'view.component.ts'),
      "this.message.set(this.i18n.translate('orphan.failure'));\nthis.i18n.translate('common.save');\n",
    );

    assert.deepEqual(findMissingTranslationKeys([join(root, 'app')], dictionary, root), [
      { key: 'orphan.failure', files: ['app/view.component.ts'] },
      { key: 'orphan.title', files: ['app/view.html'] },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('keys introduced by the audit stay defined in the base dictionary', () => {
  const audited = [
    'account_deletion.',
    'chat_settings.',
    'chatMedia.',
    'deviceTransfer.',
    'languageChallenges.',
    'lessons.',
    'recommendedForYou.',
    'studyStreak.',
    'videoNote.',
    'voiceroomPreview.',
  ];
  const missing = findMissingTranslationKeys().filter(({ key }) =>
    audited.some((prefix) => key.startsWith(prefix)),
  );
  assert.deepEqual(missing, []);
});

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { OPT_OUT_MARKER, runAudit, scanRtlSource } from './check-rtl-audit.mjs';

const codes = (source, file = 'sample.component.html') =>
  scanRtlSource(source, file).map((violation) => violation.code);

test('flags physical text alignment and accepts the logical utilities', () => {
  assert.deepEqual(codes('<p class="text-left">a</p>'), ['physical-text-align']);
  assert.deepEqual(codes('<p class="md:text-right">a</p>'), ['physical-text-align']);
  assert.deepEqual(codes('<p class="text-start md:text-end text-center">a</p>'), []);
  assert.deepEqual(codes('<p class="context-left">a</p>'), []);
});

test('flags physical corner radii without confusing them with size utilities', () => {
  for (const radius of [
    'rounded-l',
    'rounded-r-lg',
    'rounded-tl-xl',
    'rounded-br-md',
    'hover:rounded-tr-2xl',
  ]) {
    assert.deepEqual(codes(`<div class="${radius}"></div>`), ['physical-corner-radius'], radius);
  }
  for (const radius of [
    'rounded-lg',
    'rounded-s-lg',
    'rounded-ee-md',
    'rounded-t-xl',
    'rounded-b',
    'rounded-full',
  ]) {
    assert.deepEqual(codes(`<div class="${radius}"></div>`), [], radius);
  }
});

test('flags physical float, clear and scroll spacing utilities', () => {
  assert.deepEqual(codes('<img class="float-left">'), ['physical-float']);
  assert.deepEqual(codes('<img class="clear-right">'), ['physical-float']);
  assert.deepEqual(codes('<img class="float-start clear-end">'), []);
  assert.deepEqual(codes('<ul class="scroll-ml-4"></ul>'), ['physical-scroll-spacing']);
  assert.deepEqual(codes('<ul class="scroll-pr-2"></ul>'), ['physical-scroll-spacing']);
  assert.deepEqual(codes('<ul class="scroll-ms-4 scroll-pe-2"></ul>'), []);
});

test('flags translate-x offsets unless an rtl: or ltr: counterpart is named', () => {
  for (const token of [
    'translate-x-6',
    '-translate-x-1/2',
    'md:translate-x-4',
    'translate-x-[10px]',
  ]) {
    assert.deepEqual(codes(`<span class="${token}"></span>`), ['physical-translate'], token);
  }
  assert.deepEqual(codes('<span [class.translate-x-6]="on()"></span>'), ['physical-translate']);
  assert.deepEqual(codes('<span class="translate-x-6 rtl:-translate-x-6"></span>'), []);
  assert.deepEqual(codes('<span class="ltr:translate-x-2 rtl:-translate-x-2"></span>'), []);
  assert.deepEqual(codes('<span class="translate-y-1 -translate-y-1/2"></span>'), []);
});

test('flags inline 50% centring offsets and recommends the symmetric alternative', () => {
  const [violation] = scanRtlSource(
    '<div class="absolute start-1/2 -translate-x-1/2"></div>',
    'a.html',
  );
  assert.equal(violation.code, 'physical-centre-offset');
  assert.match(violation.remediation, /inset-x-0 mx-auto w-fit/);
  assert.deepEqual(codes('<div class="absolute end-1/2"></div>'), ['physical-centre-offset']);
  assert.deepEqual(codes('<div class="absolute inset-x-0 mx-auto w-fit start-4"></div>'), []);
});

test('flags transform origins that have no rtl: counterpart', () => {
  assert.deepEqual(codes('<div class="origin-left"></div>'), ['physical-transform-origin']);
  assert.deepEqual(codes('<div class="origin-top-right"></div>'), ['physical-transform-origin']);
  assert.deepEqual(codes('<div class="origin-left rtl:origin-right"></div>'), []);
  assert.deepEqual(codes('<div class="origin-center origin-top"></div>'), []);
});

test('the opt-out marker works on the line, the previous line or above a multi-line tag', () => {
  assert.deepEqual(codes(`<p class="text-left"> <!-- ${OPT_OUT_MARKER} -->`), []);
  assert.deepEqual(
    codes(`<!-- ${OPT_OUT_MARKER}: code sample -->\n<p class="text-left">a</p>`),
    [],
  );
  assert.deepEqual(
    codes(
      `<!-- ${OPT_OUT_MARKER}: image pixels -->\n<div\n  class="p-2"\n  [style.left.px]="x()"\n></div>`,
    ),
    [],
  );
  assert.deepEqual(codes(`<!-- ${OPT_OUT_MARKER} -->\n\n<p class="text-left">a</p>`), [
    'physical-text-align',
  ]);
});

test('flags physical style bindings in templates only', () => {
  for (const binding of [
    'left.px',
    'right.%',
    'marginLeft.px',
    'margin-right.px',
    'padding-left.px',
    'borderRight.px',
  ]) {
    assert.deepEqual(
      codes(`<div [style.${binding}]="x()"></div>`),
      ['physical-style-binding'],
      binding,
    );
  }
  for (const binding of ['top.px', 'width.px', 'inset-inline-start.px', 'margin-inline-end.px']) {
    assert.deepEqual(codes(`<div [style.${binding}]="x()"></div>`), [], binding);
  }
  assert.deepEqual(codes('const scroll = { left: 4, right: 8 };', 'service.ts'), []);
  assert.deepEqual(
    codes(
      '@Component({ template: `<div [style.left.px]="x()"></div>` }) class A {}',
      'a.component.ts',
    ),
    ['physical-style-binding'],
  );
});

test('flags physical CSS declarations in stylesheets and inline styles', () => {
  const declarations = [
    ['text-align: left;', 'physical-css-text-align'],
    ['text-align:right;', 'physical-css-text-align'],
    ['float: right;', 'physical-css-float'],
    ['clear: left;', 'physical-css-float'],
    ['left: 0;', 'physical-css-offset'],
    ['right: 1rem;', 'physical-css-offset'],
    ['border-top-left-radius: 4px;', 'physical-css-radius'],
    ['border-bottom-right-radius: 4px;', 'physical-css-radius'],
    ['border-left-width: 1px;', 'physical-css-border'],
    ['border-right-color: red;', 'physical-css-border'],
    ['scroll-margin-left: 4px;', 'physical-css-scroll-spacing'],
    ['scroll-padding-right: 4px;', 'physical-css-scroll-spacing'],
  ];
  for (const [declaration, code] of declarations) {
    assert.deepEqual(codes(`.a { ${declaration} }`, 'a.component.scss'), [code], declaration);
    assert.deepEqual(
      codes(`@Component({ styles: [\`:host { ${declaration} }\`] }) class A {}`, 'a.component.ts'),
      [code],
      declaration,
    );
  }

  for (const declaration of [
    'text-align: start;',
    'text-align: center;',
    'float: inline-start;',
    'inset-inline-start: 0;',
    'border-start-start-radius: 4px;',
    'border-inline-end-width: 1px;',
    'scroll-margin-inline-start: 4px;',
    'background-position: left center;',
  ]) {
    assert.deepEqual(codes(`.a { ${declaration} }`, 'a.component.scss'), [], declaration);
  }
});

test('does not treat TypeScript properties named left or right as CSS', () => {
  const source = [
    'interface Box { left: number; right: number }',
    'element.scrollBy({ left: distance * direction, behavior: "smooth" });',
  ].join('\n');
  assert.deepEqual(codes(source, 'carousel.component.ts'), []);
});

test('flags arrow glyphs that are not mirrored in RTL', () => {
  const unmirrored = [
    '<span>←</span>',
    '<span class="text-xl">→</span>',
    '<span aria-hidden="true">&larr;</span>',
    '<span aria-hidden="true">&rarr;</span>',
    '<span>&#8592;</span>',
    '<span>&#x2192;</span>',
    '<button type="button">← Back</button>',
    '<a href="/x">View details →</a>',
    '<p>{{ from() }} → {{ to() }}</p>',
    '<button>\n  &larr;\n</button>',
  ];
  for (const markup of unmirrored) {
    assert.deepEqual(codes(markup), ['unmirrored-direction-glyph'], markup);
  }
});

test('accepts arrow glyphs that carry an rtl: mirror and ignores non-text arrows', () => {
  const accepted = [
    '<span class="inline-block rtl:rotate-180">←</span>',
    '<span class="text-xl inline-block rtl:-scale-x-100" aria-hidden="true">&rarr;</span>',
    '<span class="rtl:scale-x-[-1]">→</span>',
    '<button aria-label="Back ←">Back</button>',
    "<p>{{ '→' }}</p>",
    '<span>&lsaquo; Previous</span>',
    '<span>Next &rsaquo;</span>',
    '<span>‹ ›</span>',
    '<span>▶</span>',
    '<button>Play ▶️</button>',
    '<span>No arrows here</span>',
  ];
  for (const markup of accepted) {
    assert.deepEqual(codes(markup), [], markup);
  }
});

test('flags directional Lucide icons that are not mirrored in RTL', () => {
  for (const icon of [
    'lucideArrowLeft',
    'lucideArrowRight',
    'lucideArrowBigRight',
    'lucideChevronLeft',
    'lucideChevronRight',
    'lucideChevronsLeft',
    'lucideCornerUpLeft',
    'lucideMoveRight',
  ]) {
    assert.deepEqual(
      codes(`<ng-icon name="${icon}" class="size-4" aria-hidden="true" />`),
      ['unmirrored-direction-icon'],
      icon,
    );
  }
});

test('accepts mirrored, vertical and symmetric Lucide icons', () => {
  for (const markup of [
    '<ng-icon name="lucideChevronRight" class="size-4 rtl:rotate-180" />',
    '<ng-icon\n  name="lucideArrowLeft"\n  class="size-5 rtl:-scale-x-100"\n></ng-icon>',
    '<ng-icon name="lucideChevronDown" class="size-4" />',
    '<ng-icon name="lucideArrowUp" class="size-4" />',
    '<ng-icon name="lucideArrowLeftRight" class="size-4" />',
    '<ng-icon name="lucidePlay" class="size-4" />',
    '<ng-icon [name]="icon()" class="size-4" />',
    '<span name="lucideArrowLeft"></span>',
  ]) {
    assert.deepEqual(codes(markup), [], markup);
  }
});

test('reports a directional icon on the line where its start tag begins', () => {
  const source = '<div>\n  <ng-icon\n    name="lucideArrowRight"\n    class="size-4"\n  />\n</div>';
  const violations = scanRtlSource(source, 'sample.component.html');

  assert.deepEqual(
    violations.map((violation) => [violation.line, violation.code]),
    [[2, 'unmirrored-direction-icon']],
  );
});

test('lets an inner mirrored element cover its own arrow only', () => {
  assert.deepEqual(
    codes('<button><span class="inline-block rtl:rotate-180">←</span> Back</button>'),
    [],
  );
  assert.deepEqual(
    codes('<button><span class="inline-block rtl:rotate-180">←</span> Back →</button>'),
    ['unmirrored-direction-glyph'],
  );
});

test('reports arrow glyphs inside inline templates with the real line number', () => {
  const source = [
    "import { Component } from '@angular/core';",
    '',
    '@Component({',
    "  selector: 'app-sample',",
    '  template: `',
    '    <header>',
    '      <span>←</span>',
    '    </header>',
    '  `,',
    '})',
    'export class SampleComponent {}',
  ].join('\n');
  const violations = scanRtlSource(source, 'sample.component.ts');

  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 7);
  assert.equal(violations[0].code, 'unmirrored-direction-glyph');
});

test('does not read arrows in component code or comments as rendered glyphs', () => {
  const source = [
    '// Maps a language pair such as en → es for logging.',
    'export const label = (a: string, b: string) => `${a} → ${b}`;',
  ].join('\n');
  assert.deepEqual(codes(source, 'pair.ts'), []);
});

test('reports each rule once per line and sorts by line number', () => {
  const source =
    '<p class="text-left text-right">a</p>\n<span>→</span>\n<p class="float-left">b</p>';
  const violations = scanRtlSource(source, 'sample.component.html');

  assert.deepEqual(
    violations.map((violation) => [violation.line, violation.code]),
    [
      [1, 'physical-text-align'],
      [2, 'unmirrored-direction-glyph'],
      [3, 'physical-float'],
    ],
  );
});

test('runAudit scans templates, scripts and styles but skips spec files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rtl-audit-'));
  try {
    mkdirSync(join(directory, 'src', 'app'), { recursive: true });
    writeFileSync(
      join(directory, 'src', 'app', 'bad.component.html'),
      '<p class="text-left">a</p>',
    );
    writeFileSync(join(directory, 'src', 'app', 'bad.component.scss'), '.a { float: left; }');
    writeFileSync(
      join(directory, 'src', 'app', 'ignored.component.spec.ts'),
      'const x = \'<p class="text-left">\';',
    );
    writeFileSync(
      join(directory, 'src', 'app', 'clean.component.html'),
      '<p class="text-start">a</p>',
    );

    const violations = runAudit(join(directory, 'src'), directory);

    assert.deepEqual(violations.map((violation) => `${violation.file}:${violation.code}`).sort(), [
      'src/app/bad.component.html:physical-text-align',
      'src/app/bad.component.scss:physical-css-float',
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the frontend source tree has no unmirrored physical layout', () => {
  const frontendRoot = resolve(import.meta.dirname, '..');
  const violations = runAudit(resolve(frontendRoot, 'src'), frontendRoot);

  assert.deepEqual(
    violations.map(
      (violation) => `${violation.file}:${violation.line} [${violation.code}] ${violation.found}`,
    ),
    [],
  );
});

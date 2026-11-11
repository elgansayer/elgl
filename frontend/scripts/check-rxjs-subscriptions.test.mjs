import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkRxjsSubscriptions,
  collectSubscriptionFailures,
  maskSource,
  readProductionSources,
} from './check-rxjs-subscriptions.mjs';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function entry(overrides = {}) {
  return {
    file: 'app/a.service.ts',
    rule: 'subscribe',
    count: 1,
    teardown: 'takeUntilDestroyed(destroyRef)',
    reason: 'Reactive Forms exposes valueChanges only as an Observable',
    ...overrides,
  };
}

function failuresFor(files, entries = []) {
  return collectSubscriptionFailures({
    files: files.map(([filePath, source]) => ({ path: filePath, source })),
    baseline: { entries },
  });
}

const SUBSCRIBING =
  'export class A {\n  run() {\n    this.stream$.subscribe(() => undefined);\n  }\n}\n';

test('accepts a tree whose subscriptions all match the audited baseline', () => {
  assert.deepEqual(failuresFor([['app/a.service.ts', SUBSCRIBING]], [entry()]), []);
});

test('accepts a tree with no subscriptions and an empty baseline', () => {
  assert.deepEqual(failuresFor([['app/a.service.ts', 'export const a = 1;\n']]), []);
});

test('fails a new subscription in an unaudited file and names its line', () => {
  const failures = failuresFor([['app/new.component.ts', SUBSCRIBING]]);

  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /app\/new\.component\.ts:3: 1 'subscribe' call site\(s\) found, 0 audited/,
  );
  assert.match(failures[0], /toSignal\(\)/);
});

test('fails an extra subscription beyond the audited count in the same file', () => {
  const source = `${SUBSCRIBING}\nconst again = () => other$.subscribe();\n`;

  const failures = failuresFor([['app/a.service.ts', source]], [entry()]);

  assert.equal(failures.length, 1);
  assert.match(failures[0], /2 'subscribe' call site\(s\) found, 1 audited/);
});

test('ignores subscribe mentioned in comments, strings and templates', () => {
  const source = [
    '// stream$.subscribe(() => undefined)',
    '/* legacy.subscribe(handler) */',
    "const text = 'obs.subscribe(() => {})';",
    'const template = `obs.subscribe(${value})`;',
    '@Component({ template: `<button (click)="x.subscribe()"></button>` })',
    'export class A {}',
  ].join('\n');

  assert.deepEqual(failuresFor([['app/a.component.ts', source]]), []);
});

test('does not treat a property named subscribe without a call as a subscription', () => {
  assert.deepEqual(failuresFor([['app/a.ts', 'const handle = channel.subscribe;\n']]), []);
});

test('counts optional-chained and multi-line subscribe calls', () => {
  const source = 'a$?.subscribe(x);\nb$\n  .pipe(map(y))\n  .subscribe(\n    z,\n  );\n';

  const failures = failuresFor([['app/a.ts', source]], [entry({ file: 'app/a.ts', count: 2 })]);

  assert.deepEqual(failures, []);
});

test('fails when fewer subscriptions remain than the baseline audits', () => {
  const failures = failuresFor([['app/a.service.ts', SUBSCRIBING]], [entry({ count: 3 })]);

  assert.equal(failures.length, 1);
  assert.match(failures[0], /audits 3 'subscribe' call site\(s\) but 1 remain, lower the count/);
});

test('fails when an audited subscription has been removed without removing its entry', () => {
  const failures = failuresFor([['app/a.service.ts', 'export const a = 1;\n']], [entry()]);

  assert.equal(failures.length, 1);
  assert.match(failures[0], /baseline audits 'subscribe' but none remain, remove the entry/);
});

test('fails an entry for a file that no longer exists', () => {
  const failures = failuresFor([], [entry({ file: 'app/gone.service.ts' })]);

  assert.ok(failures.some((failure) => /the file no longer exists/.test(failure)));
});

test('requires a reason and a teardown on every entry', () => {
  const files = [['app/a.service.ts', SUBSCRIBING]];

  assert.ok(failuresFor(files, [entry({ reason: '  ' })]).some((f) => /"reason" must/.test(f)));
  assert.ok(failuresFor(files, [entry({ teardown: '' })]).some((f) => /"teardown" must/.test(f)));
});

test('rejects malformed entries: unknown rule, bad count and duplicates', () => {
  const files = [['app/a.service.ts', SUBSCRIBING]];

  assert.ok(
    failuresFor(files, [entry({ rule: 'to-promise' })]).some((f) => /"rule" must be/.test(f)),
  );
  assert.ok(failuresFor(files, [entry({ count: 0 })]).some((f) => /"count" must be/.test(f)));
  assert.ok(failuresFor(files, [entry(), entry()]).some((f) => /duplicated entry/.test(f)));
});

test('rejects a baseline without an entries array', () => {
  const failures = collectSubscriptionFailures({ files: [], baseline: {} });

  assert.deepEqual(failures, ['baseline must contain an "entries" array']);
});

test('audits new Subject and setInterval through the same baseline', () => {
  const source = 'const trigger = new Subject<void>();\nconst id = setInterval(tick, 1000);\n';

  const unaudited = failuresFor([['app/a.ts', source]]);
  assert.equal(unaudited.length, 2);
  assert.ok(unaudited.some((f) => /'subject' call site/.test(f)));
  assert.ok(unaudited.some((f) => /'set-interval' call site/.test(f)));

  const audited = failuresFor(
    [['app/a.ts', source]],
    [
      entry({ file: 'app/a.ts', rule: 'subject' }),
      entry({ file: 'app/a.ts', rule: 'set-interval' }),
    ],
  );
  assert.deepEqual(audited, []);
});

test('never allows the rxjs/operators import, toPromise or state subjects', () => {
  const source = [
    "import { map } from 'rxjs/operators';",
    'import { filter } from "rxjs/operators";',
    'const value = await http$.toPromise();',
    'const state = new BehaviorSubject(0);',
    'const replay = new ReplaySubject<string>(1);',
    'const last = new AsyncSubject<string>();',
  ].join('\n');

  const failures = failuresFor([['app/a.ts', source]]);

  assert.equal(failures.length, 6);
  assert.ok(failures.some((f) => /^app\/a\.ts:1: import operators from 'rxjs' directly/.test(f)));
  assert.ok(failures.some((f) => /^app\/a\.ts:2: import operators from 'rxjs' directly/.test(f)));
  assert.ok(failures.some((f) => /^app\/a\.ts:3: use firstValueFrom\(\)/.test(f)));
  assert.ok(failures.some((f) => /^app\/a\.ts:4: hold state in signal/.test(f)));
  assert.ok(failures.some((f) => /^app\/a\.ts:5: hold state in signal/.test(f)));
  assert.ok(failures.some((f) => /^app\/a\.ts:6: hold state in signal/.test(f)));
});

test('does not flag the rxjs/operators text inside comments', () => {
  const source = "// import { map } from 'rxjs/operators';\nexport const a = 1;\n";

  assert.deepEqual(failuresFor([['app/a.ts', source]]), []);
});

test('maskSource blanks comments and strings but keeps every newline and offset', () => {
  const source =
    "const a = 'x.subscribe()'; // y.subscribe()\n/* z\n.subscribe() */\nb.subscribe();\n";

  const masked = maskSource(source);

  assert.equal(masked.length, source.length);
  assert.equal(masked.split('\n').length, source.split('\n').length);
  assert.equal([...masked.matchAll(/\.subscribe\s*\(/g)].length, 1);
  assert.match(masked.split('\n')[3], /b\.subscribe\(\);/);
});

test('maskSource keeps string contents when asked and handles escaped quotes', () => {
  const source = "import { a } from 'rxjs/operators';\nconst s = 'it\\'s';\n";

  assert.match(maskSource(source, { keepStrings: true }), /'rxjs\/operators'/);
  assert.doesNotMatch(maskSource(source), /rxjs/);
  assert.equal(maskSource(source).length, source.length);
});

test('reads only production TypeScript sources', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rxjs-subscriptions-'));
  try {
    fs.mkdirSync(path.join(directory, 'app'));
    for (const name of [
      'a.component.ts',
      'a.component.spec.ts',
      'a.cy.ts',
      'a.e2e-spec.ts',
      'a.test.ts',
      'types.d.ts',
      'a.component.html',
    ]) {
      fs.writeFileSync(path.join(directory, 'app', name), '');
    }

    assert.deepEqual(
      readProductionSources(directory).map((file) => file.path),
      ['app/a.component.ts'],
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the committed baseline matches the production tree', () => {
  assert.deepEqual(checkRxjsSubscriptions(frontendRoot), []);
});

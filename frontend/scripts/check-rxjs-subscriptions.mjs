import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guards frontend production code against subscription handles that outlive their owner.
 *
 * frontend/AGENTS.md bans `.subscribe()`, `Subject` state, `setInterval` state, `.toPromise()` and
 * `rxjs/operators` imports. Zero-tolerance rules fail outright. The rest are ratcheted against
 * `rxjs-subscriptions.baseline.json`: every remaining call site was audited once, and the audit
 * records how it is torn down. A new call site, or one that disappears without the baseline being
 * lowered, fails until the baseline is updated in the same change with a reviewed reason.
 *
 * Prefer `toSignal()`, `resource()`, `linkedSignal()`, the `async` pipe or `elapsedSeconds()`.
 */

/** Rules that are never allowed in production code. */
export const FORBIDDEN_RULES = [
  {
    id: 'rxjs-operators-import',
    pattern: /from\s+['"]rxjs\/operators['"]/g,
    keepStrings: true,
    message: "import operators from 'rxjs' directly; 'rxjs/operators' is banned",
  },
  {
    id: 'to-promise',
    pattern: /\.toPromise\s*\(/g,
    message: 'use firstValueFrom() or lastValueFrom() instead of the removed toPromise()',
  },
  {
    id: 'state-subject',
    pattern: /\bnew\s+(?:Behavior|Replay|Async)Subject\b/g,
    message:
      'hold state in signal<T>() instead of a BehaviorSubject, ReplaySubject or AsyncSubject',
  },
];

/** Rules that require an audited, documented baseline entry per file. */
export const AUDITED_RULES = [
  {
    id: 'subscribe',
    pattern: /\.subscribe\s*\(/g,
    message:
      'use toSignal(), resource(), the async pipe or elapsedSeconds(); if a subscription is unavoidable, tie it to the owner with takeUntilDestroyed() and record it in the baseline',
  },
  {
    id: 'subject',
    pattern: /\bnew\s+Subject\b/g,
    message:
      'use a signal for state; a Subject is only acceptable as an event trigger that completes with its owner and must be recorded in the baseline',
  },
  {
    id: 'set-interval',
    pattern: /\bsetInterval\s*\(/g,
    message:
      'use elapsedSeconds() or interval() converted with toSignal(); a raw interval needs a clearInterval on every exit path and a baseline entry',
  },
];

const AUDITED_RULE_IDS = new Set(AUDITED_RULES.map((rule) => rule.id));

/**
 * Blanks comments (and, unless `keepStrings`, string and template literal contents) while keeping
 * every newline, so a match offset still maps to its original line.
 */
export function maskSource(source, { keepStrings = false } = {}) {
  let masked = '';
  let index = 0;
  const length = source.length;
  const blank = (character) => (character === '\n' ? '\n' : ' ');

  while (index < length) {
    const character = source[index];
    const next = source[index + 1];

    if (character === '/' && next === '/') {
      while (index < length && source[index] !== '\n') {
        masked += ' ';
        index += 1;
      }
      continue;
    }

    if (character === '/' && next === '*') {
      masked += '  ';
      index += 2;
      while (index < length && !(source[index] === '*' && source[index + 1] === '/')) {
        masked += blank(source[index]);
        index += 1;
      }
      if (index < length) {
        masked += '  ';
        index += 2;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      masked += character;
      index += 1;
      while (index < length && source[index] !== character) {
        if (source[index] === '\n' && character !== '`') break;
        if (source[index] === '\\' && index + 1 < length) {
          masked += keepStrings ? source.slice(index, index + 2) : '  ';
          index += 2;
          continue;
        }
        masked += keepStrings ? source[index] : blank(source[index]);
        index += 1;
      }
      if (index < length && source[index] === character) {
        masked += character;
        index += 1;
      }
      continue;
    }

    masked += character;
    index += 1;
  }

  return masked;
}

function matchLines(masked, pattern) {
  const lines = [];
  for (const match of masked.matchAll(new RegExp(pattern.source, pattern.flags))) {
    lines.push(masked.slice(0, match.index).split('\n').length);
  }
  return lines;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function baselineKey(file, rule) {
  return `${file}#${rule}`;
}

function validateBaseline(baseline, knownFiles) {
  const failures = [];
  const seen = new Set();

  if (!Array.isArray(baseline?.entries)) {
    return ['baseline must contain an "entries" array'];
  }

  for (const entry of baseline.entries) {
    const label = `baseline entry ${entry?.file ?? '(no file)'} / ${entry?.rule ?? '(no rule)'}`;
    if (!nonEmptyString(entry?.file)) failures.push(`${label}: "file" is required`);
    if (!AUDITED_RULE_IDS.has(entry?.rule)) {
      failures.push(`${label}: "rule" must be one of ${[...AUDITED_RULE_IDS].join(', ')}`);
    }
    if (!Number.isInteger(entry?.count) || entry.count < 1) {
      failures.push(`${label}: "count" must be a positive integer`);
    }
    if (!nonEmptyString(entry?.teardown)) {
      failures.push(`${label}: "teardown" must say how the handle is released`);
    }
    if (!nonEmptyString(entry?.reason)) {
      failures.push(`${label}: "reason" must say why a signal-based alternative is not used`);
    }
    const key = baselineKey(entry?.file, entry?.rule);
    if (seen.has(key)) failures.push(`${label}: duplicated entry`);
    seen.add(key);
    if (nonEmptyString(entry?.file) && !knownFiles.has(entry.file)) {
      failures.push(`${label}: the file no longer exists, remove the entry`);
    }
  }

  return failures;
}

/**
 * @param {{ files: Array<{ path: string, source: string }>, baseline: object }} input
 *   `path` is relative to `frontend/src` with forward slashes.
 */
export function collectSubscriptionFailures({ files, baseline }) {
  const failures = validateBaseline(baseline, new Set(files.map((file) => file.path)));
  const audited = new Map(
    (Array.isArray(baseline?.entries) ? baseline.entries : []).map((entry) => [
      baselineKey(entry.file, entry.rule),
      entry,
    ]),
  );
  const found = new Map();

  for (const file of files) {
    const code = maskSource(file.source);
    const withStrings = maskSource(file.source, { keepStrings: true });

    for (const rule of FORBIDDEN_RULES) {
      for (const line of matchLines(rule.keepStrings ? withStrings : code, rule.pattern)) {
        failures.push(`${file.path}:${line}: ${rule.message}`);
      }
    }

    for (const rule of AUDITED_RULES) {
      const lines = matchLines(code, rule.pattern);
      if (lines.length > 0) found.set(baselineKey(file.path, rule.id), { file, rule, lines });
    }
  }

  for (const [key, { file, rule, lines }] of found) {
    const allowed = audited.get(key)?.count ?? 0;
    if (lines.length > allowed) {
      const where = lines.map((line) => `${file.path}:${line}`).join(', ');
      failures.push(
        `${where}: ${lines.length} '${rule.id}' call site(s) found, ${allowed} audited: ${rule.message}`,
      );
    }
  }

  for (const [key, entry] of audited) {
    const actual = found.get(key)?.lines.length ?? 0;
    if (Number.isInteger(entry.count) && actual > 0 && actual < entry.count) {
      failures.push(
        `${entry.file}: baseline audits ${entry.count} '${entry.rule}' call site(s) but ${actual} remain, lower the count`,
      );
    }
    if (actual === 0 && nonEmptyString(entry.file) && AUDITED_RULE_IDS.has(entry.rule)) {
      failures.push(
        `${entry.file}: baseline audits '${entry.rule}' but none remain, remove the entry`,
      );
    }
  }

  return failures;
}

function isProductionSource(name) {
  return (
    name.endsWith('.ts') &&
    !name.endsWith('.d.ts') &&
    !name.endsWith('.spec.ts') &&
    !name.endsWith('.e2e-spec.ts') &&
    !name.endsWith('.cy.ts') &&
    !name.endsWith('.test.ts')
  );
}

export function readProductionSources(sourceRoot) {
  const files = [];
  const walk = (directory) => {
    for (const name of fs.readdirSync(directory)) {
      const entryPath = path.join(directory, name);
      if (fs.statSync(entryPath).isDirectory()) {
        walk(entryPath);
      } else if (isProductionSource(name)) {
        files.push({
          path: path.relative(sourceRoot, entryPath).split(path.sep).join('/'),
          source: fs.readFileSync(entryPath, 'utf8'),
        });
      }
    }
  };
  walk(sourceRoot);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export function checkRxjsSubscriptions(root) {
  let baseline;
  try {
    baseline = JSON.parse(
      fs.readFileSync(path.join(root, 'scripts/rxjs-subscriptions.baseline.json'), 'utf8'),
    );
  } catch (error) {
    return [
      `unable to read rxjs-subscriptions.baseline.json: ${error instanceof Error ? error.message : 'unknown error'}`,
    ];
  }
  return collectSubscriptionFailures({
    files: readProductionSources(path.join(root, 'src')),
    baseline,
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  const root = path.resolve(path.dirname(modulePath), '..');
  const failures = checkRxjsSubscriptions(root);
  if (failures.length > 0) {
    console.error('RxJS subscription hygiene check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(
      'RxJS subscription hygiene check passed. Every remaining subscription is audited in the baseline.',
    );
  }
}

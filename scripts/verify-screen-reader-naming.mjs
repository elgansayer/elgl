#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ESCAPE = 'screen-reader-naming-ok';
const GENERIC_LABEL = /^(?:button|control|dialog|icon|input|modal|text input)$/i;
const TEMPLATE_FILE = /\.(?:html|ts)$/;

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function makeViolation({ code, detail, file, line, remediation }) {
  return {
    code,
    detail,
    file,
    line,
    remediation,
    fingerprint: `${code}:${detail}`,
  };
}

function literalAttribute(tag, name) {
  const escaped = name.replaceAll('-', '\\-');
  const expression = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  return tag.match(expression)?.[2] ?? null;
}

function tagMatches(source) {
  return [...source.matchAll(/<[A-Za-z][^<>]*?>/gs)];
}

export function scanTemplate(source, file = '(template)', lineOffset = 0) {
  const failures = [];
  const ids = new Map();
  const tags = tagMatches(source);

  for (const match of tags) {
    const tag = match[0];
    const line = lineOffset + lineNumber(source, match.index ?? 0);
    const escaped = tag.includes(ESCAPE);
    const id = literalAttribute(tag, 'id');

    if (id) {
      const occurrences = ids.get(id) ?? [];
      occurrences.push(line);
      ids.set(id, occurrences);
    }

    const ariaLabel = literalAttribute(tag, 'aria-label');
    if (ariaLabel && /[A-Za-z]/.test(ariaLabel) && !escaped) {
      if (GENERIC_LABEL.test(ariaLabel.trim())) {
        failures.push(
          makeViolation({
            code: 'generic-aria-label',
            detail: `generic static aria-label "${ariaLabel.trim()}"`,
            file,
            line,
            remediation:
              `provide a translated, purpose-specific accessible name or add ${ESCAPE} only for intentionally untranslated static copy`,
          }),
        );
      } else {
        failures.push(
          makeViolation({
            code: 'hardcoded-aria-label',
            detail: `static aria-label "${ariaLabel.trim()}"`,
            file,
            line,
            remediation:
              `bind translated product copy (for example [attr.aria-label]="'key' | t") or add ${ESCAPE} only for intentionally untranslated static copy`,
          }),
        );
      }
    }

    const tabindex = literalAttribute(tag, 'tabindex');
    if (tabindex && /^\+?\d+$/.test(tabindex.trim()) && Number(tabindex) > 0) {
      failures.push(
        makeViolation({
          code: 'positive-tabindex',
          detail: `positive tabindex "${tabindex.trim()}"`,
          file,
          line,
          remediation: 'use native DOM order, tabindex="0" for a justified custom focus target, or tabindex="-1" for programmatic focus',
        }),
      );
    }
  }

  for (const [id, lines] of ids) {
    if (lines.length <= 1) continue;
    failures.push(
      makeViolation({
        code: 'duplicate-literal-id',
        detail: `literal id "${id}" appears ${lines.length} times`,
        file,
        line: lines[1],
        remediation: 'use one unique literal ID or an instance-safe generated ID for reusable relationships',
      }),
    );
  }

  const knownIds = new Set(ids.keys());
  for (const match of tags) {
    const tag = match[0];
    if (tag.includes(ESCAPE)) continue;
    const line = lineOffset + lineNumber(source, match.index ?? 0);

    for (const attribute of ['aria-labelledby', 'aria-describedby']) {
      const value = literalAttribute(tag, attribute);
      if (!value) continue;
      for (const reference of value.trim().split(/\s+/).filter(Boolean)) {
        if (knownIds.has(reference)) continue;
        failures.push(
          makeViolation({
            code: 'missing-idref-target',
            detail: `${attribute} references missing literal id "${reference}"`,
            file,
            line,
            remediation:
              `render the referenced element in this template, use an instance-safe primitive relationship, or add ${ESCAPE} when the target is intentionally external`,
          }),
        );
      }
    }

    if (/^<label\b/i.test(tag)) {
      const target = literalAttribute(tag, 'for');
      if (target && !knownIds.has(target)) {
        failures.push(
          makeViolation({
            code: 'missing-label-target',
            detail: `label for="${target}" has no matching literal id`,
            file,
            line,
            remediation:
              `render id="${target}" in the same template, use label nesting/Spartan Field composition, or add ${ESCAPE} when the target is intentionally external`,
          }),
        );
      }
    }
  }

  return failures;
}

function inlineTemplates(source, file) {
  const templates = [];
  const expression = /\btemplate\s*:\s*(`([\s\S]*?)`|'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g;
  let match;
  let index = 0;
  while ((match = expression.exec(source)) !== null) {
    const body = match[2] ?? match[3] ?? match[4] ?? '';
    const bodyIndex = (match.index ?? 0) + match[0].indexOf(body);
    templates.push({
      file: `${file}#inline-template-${index + 1}`,
      source: body,
      lineOffset: lineNumber(source, bodyIndex) - 1,
    });
    index += 1;
  }
  return templates;
}

export function scanAngularSource(source, file = '(source)') {
  if (file.endsWith('.html')) return scanTemplate(source, file);
  if (!file.endsWith('.ts')) return [];
  return inlineTemplates(source, file).flatMap((template) =>
    scanTemplate(template.source, template.file, template.lineOffset),
  );
}

export function newViolations(current, baseline) {
  const baselineCounts = new Map();
  for (const violation of baseline) {
    baselineCounts.set(
      violation.fingerprint,
      (baselineCounts.get(violation.fingerprint) ?? 0) + 1,
    );
  }

  const added = [];
  for (const violation of current) {
    const remaining = baselineCounts.get(violation.fingerprint) ?? 0;
    if (remaining > 0) {
      baselineCounts.set(violation.fingerprint, remaining - 1);
    } else {
      added.push(violation);
    }
  }
  return added;
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function resolveBase() {
  if (process.env.SCREEN_READER_NAMING_BASE_SHA) {
    return process.env.SCREEN_READER_NAMING_BASE_SHA;
  }

  try {
    const mergeBase = git(['merge-base', 'HEAD', 'origin/main']);
    const head = git(['rev-parse', 'HEAD']);
    return mergeBase === head ? 'HEAD^' : mergeBase;
  } catch {
    return 'HEAD^';
  }
}

function changedFrontendFiles(base) {
  try {
    return git([
      'diff',
      '--name-only',
      '--diff-filter=ACMR',
      `${base}...HEAD`,
      '--',
      'frontend/src/app',
    ])
      .split('\n')
      .map((value) => value.trim())
      .filter((value) => TEMPLATE_FILE.test(value));
  } catch (error) {
    console.error(`Unable to calculate screen-reader naming diff from ${base}.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function baseSource(base, path) {
  try {
    return git(['show', `${base}:${path}`]);
  } catch {
    return '';
  }
}

function verify() {
  const base = resolveBase();
  const failures = [];

  for (const path of changedFrontendFiles(base)) {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) continue;

    const currentSource = readFileSync(absolute, 'utf8');
    const current = scanAngularSource(currentSource, path);
    const baseline = scanAngularSource(baseSource(base, path), path);
    failures.push(...newViolations(current, baseline));
  }

  if (failures.length) {
    console.error('Screen-reader naming and relationship verification failed:');
    for (const failure of failures) {
      console.error(
        `- ${failure.file}:${failure.line} [${failure.code}] ${failure.detail}; ${failure.remediation}`,
      );
    }
    console.error(
      `The gate reports only new violations relative to the base branch. See docs/screen-reader-naming-and-relationships.md and use ${ESCAPE} only for an intentional, reviewed exception.`,
    );
    process.exit(1);
  }

  console.log('Screen-reader naming and relationship contract verified.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  verify();
}

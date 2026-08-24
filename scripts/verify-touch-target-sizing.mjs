#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ESCAPE = 'data-touch-target-exception';
const ANGULAR_FILE = /\.(?:html|ts)$/;
const GENERIC_CLICK_TARGET = new Set(['div', 'span', 'img', 'ng-icon', 'svg']);
const TOUCH_SIZES = new Set(['touch', 'icon-touch']);

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
  const expression = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'is');
  return tag.match(expression)?.[2] ?? null;
}

function hasAttribute(tag, name) {
  const escaped = name.replaceAll('-', '\\-');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s*=|\\s|>|$)`, 'i').test(tag);
}

function tagName(tag) {
  return tag.match(/^<\s*([\w-]+)/)?.[1]?.toLowerCase() ?? '';
}

function tagMatches(source) {
  return [...source.matchAll(/<[A-Za-z][^<>]*?>/gs)];
}

function inlineTemplates(source) {
  const templates = [];
  const expression = /\btemplate\s*:\s*(`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*")/gs;
  for (const match of source.matchAll(expression)) {
    const quoted = match[1];
    templates.push({
      source: quoted.slice(1, -1),
      lineOffset: lineNumber(source, (match.index ?? 0) + match[0].indexOf(quoted)) - 1,
    });
  }
  return templates;
}

export function scanTemplate(source, file = '(template)', lineOffset = 0) {
  const failures = [];

  for (const match of tagMatches(source)) {
    const tag = match[0];
    if (hasAttribute(tag, ESCAPE)) continue;

    const name = tagName(tag);
    const line = lineOffset + lineNumber(source, match.index ?? 0);

    if (GENERIC_CLICK_TARGET.has(name) && /\(click\)\s*=/.test(tag)) {
      failures.push(
        makeViolation({
          code: 'generic-click-target',
          detail: `<${name}> owns a click handler`,
          file,
          line,
          remediation:
            'use a native/Spartan button or link with a touch-safe hit area; reserve data-touch-target-exception for a documented specialised interaction',
        }),
      );
    }

    if ((name === 'button' || name === 'a') && /\bhlmBtn\b/.test(tag)) {
      const size = literalAttribute(tag, 'size');
      const boundSize = /\[size\]\s*=/.test(tag);

      if (boundSize) continue;
      if (!size || !TOUCH_SIZES.has(size)) {
        failures.push(
          makeViolation({
            code: 'undersized-spartan-action',
            detail: `standalone Spartan <${name}> uses ${size ? `size="${size}"` : 'the compact default size'}`,
            file,
            line,
            remediation:
              'use size="touch" or size="icon-touch"; if this is a deliberately dense audited exception, add data-touch-target-exception with review coverage',
          }),
        );
      }
    }
  }

  return failures;
}

export function scanAngularSource(source, file = '(source)') {
  if (file.endsWith('.html')) return scanTemplate(source, file);
  if (!file.endsWith('.ts')) return [];

  return inlineTemplates(source).flatMap(({ source: template, lineOffset }) =>
    scanTemplate(template, file, lineOffset),
  );
}

export function validateSharedTouchVariants(source, file = 'hlm-button.ts') {
  const failures = [];
  const requirements = [
    [/\btouch\s*:\s*['"][^'"]*\bmin-h-11\b/, 'touch size must retain min-h-11 (44 CSS px minimum height)'],
    [/["']icon-touch["']\s*:\s*['"][^'"]*\bsize-11\b/, 'icon-touch size must retain size-11 (44 by 44 CSS px)'],
  ];

  for (const [pattern, detail] of requirements) {
    if (!pattern.test(source)) {
      failures.push(
        makeViolation({
          code: 'shared-touch-variant-regression',
          detail,
          file,
          line: 1,
          remediation:
            'restore the shared Spartan touch variant to the repository 44 CSS pixel baseline before changing feature code',
        }),
      );
    }
  }
  return failures;
}

export function newlyIntroducedViolations(current, base) {
  const remaining = new Map();
  for (const violation of base) {
    remaining.set(violation.fingerprint, (remaining.get(violation.fingerprint) ?? 0) + 1);
  }

  const introduced = [];
  for (const violation of current) {
    const count = remaining.get(violation.fingerprint) ?? 0;
    if (count > 0) {
      remaining.set(violation.fingerprint, count - 1);
    } else {
      introduced.push(violation);
    }
  }
  return introduced;
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function eventBeforeSha() {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path || !existsSync(path)) return null;
  try {
    const payload = JSON.parse(readFileSync(path, 'utf8'));
    return typeof payload.before === 'string' && /^[0-9a-f]{40}$/i.test(payload.before)
      ? payload.before
      : null;
  } catch {
    return null;
  }
}

function resolveBaseRef() {
  if (process.env.TOUCH_TARGET_BASE_REF) return process.env.TOUCH_TARGET_BASE_REF;

  if (process.env.GITHUB_EVENT_NAME === 'push') {
    return eventBeforeSha() ?? 'HEAD^';
  }

  if (process.env.GITHUB_BASE_REF) {
    const remoteRef = `origin/${process.env.GITHUB_BASE_REF}`;
    try {
      git(['rev-parse', '--verify', remoteRef]);
      return remoteRef;
    } catch {
      return process.env.GITHUB_BASE_REF;
    }
  }

  try {
    git(['rev-parse', '--verify', 'origin/main']);
    return 'origin/main';
  } catch {
    return 'HEAD^';
  }
}

function changedAngularFiles(baseRef) {
  try {
    return git(['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`, '--', 'frontend/src/app'])
      .split('\n')
      .map((file) => file.trim())
      .filter((file) => ANGULAR_FILE.test(file));
  } catch {
    return git(['diff', '--name-only', '--diff-filter=ACMR', baseRef, 'HEAD', '--', 'frontend/src/app'])
      .split('\n')
      .map((file) => file.trim())
      .filter((file) => ANGULAR_FILE.test(file));
  }
}

function readBaseFile(baseRef, file) {
  try {
    return git(['show', `${baseRef}:${file}`]);
  } catch {
    return '';
  }
}

function report(failures) {
  console.error('Touch target contract verification failed:');
  for (const failure of failures) {
    console.error(
      `- ${failure.file}:${failure.line} [${failure.code}] ${failure.detail}; ${failure.remediation}`,
    );
  }
}

export function runVerification() {
  const failures = [];
  const sharedButtonPath = 'frontend/src/app/components/ui/button/src/lib/hlm-button.ts';
  const sharedButtonSource = readFileSync(resolve(root, sharedButtonPath), 'utf8');
  failures.push(...validateSharedTouchVariants(sharedButtonSource, sharedButtonPath));

  const baseRef = resolveBaseRef();
  for (const file of changedAngularFiles(baseRef)) {
    const absolute = resolve(root, file);
    if (!existsSync(absolute)) continue;
    const currentSource = readFileSync(absolute, 'utf8');
    const baseSource = readBaseFile(baseRef, file);
    const current = scanAngularSource(currentSource, file);
    const base = scanAngularSource(baseSource, file);
    failures.push(...newlyIntroducedViolations(current, base));
  }

  if (failures.length > 0) {
    report(failures);
    return false;
  }

  console.log('Touch target sizing contract verified.');
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = runVerification() ? 0 : 1;
}

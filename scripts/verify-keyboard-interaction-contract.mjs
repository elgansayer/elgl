#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const GUIDANCE = {
  'positive-tabindex': 'Use DOM order, native focus order, or an approved Spartan composite instead of positive tabindex values.',
  'a11y-clickable': 'Use a native button/link or an approved Relay/Spartan primitive instead of adding new appA11yClickable call sites.',
  'deprecated-key-api': 'Use KeyboardEvent.key (for example Enter, Escape, or ArrowDown) instead of keyCode/which.',
  'synthetic-button-keyboard': 'Replace the synthetic role=button + Enter/Space state machine with a native button/link or approved Spartan primitive.',
  'feature-roving-tabindex': 'Move standard roving-tabindex behavior into the approved Spartan composite primitive.',
};

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function collectRegex(source, rule, pattern, message) {
  return [...source.matchAll(pattern)].map((match) => ({
    rule,
    line: lineNumber(source, match.index ?? 0),
    excerpt: match[0].replace(/\s+/g, ' ').trim().slice(0, 180),
    message,
  }));
}

export function scanKeyboardInteractionSource(source) {
  const violations = [
    ...collectRegex(
      source,
      'positive-tabindex',
      /\btabindex\s*=\s*["'](?:[1-9]\d*)["']/gi,
      GUIDANCE['positive-tabindex'],
    ),
    ...collectRegex(
      source,
      'a11y-clickable',
      /\bappA11yClickable\b/g,
      GUIDANCE['a11y-clickable'],
    ),
    ...collectRegex(
      source,
      'deprecated-key-api',
      /\b(?:keyCode|which)\b/g,
      GUIDANCE['deprecated-key-api'],
    ),
    ...collectRegex(
      source,
      'feature-roving-tabindex',
      /\[(?:attr\.)?tabindex\]\s*=\s*["'][^"']*(?:active|selected|focused|focusIndex|activeIndex)[^"']*["']/gi,
      GUIDANCE['feature-roving-tabindex'],
    ),
  ];

  const syntheticTagPattern = /<(?:div|span|article|li|section|p)\b[^>]*>/gims;
  for (const match of source.matchAll(syntheticTagPattern)) {
    const tag = match[0];
    if (
      /\brole\s*=\s*["']button["']/i.test(tag) &&
      /\((?:key|key(?:down|up))\.(?:enter|space)\)/i.test(tag)
    ) {
      violations.push({
        rule: 'synthetic-button-keyboard',
        line: lineNumber(source, match.index ?? 0),
        excerpt: tag.replace(/\s+/g, ' ').trim().slice(0, 180),
        message: GUIDANCE['synthetic-button-keyboard'],
      });
    }
  }

  const warnings = [
    ...collectRegex(
      source,
      'escape-review',
      /\(keydown\.escape\)\s*=/gi,
      'Review local Escape handling: Spartan Dialog/Popover should own generic dismissal and focus restoration.',
    ),
  ];

  const textEntryPattern = /<(?:input|textarea)\b[^>]*\(keydown\.enter\)\s*=[^>]*>/gims;
  for (const match of source.matchAll(textEntryPattern)) {
    warnings.push({
      rule: 'ime-review',
      line: lineNumber(source, match.index ?? 0),
      excerpt: match[0].replace(/\s+/g, ' ').trim().slice(0, 180),
      message: 'Review Enter handling for IME safety; the invoked handler must ignore KeyboardEvent.isComposing.',
    });
  }

  return { violations, warnings };
}

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function resolveBase() {
  if (process.env.KEYBOARD_INTERACTION_BASE_SHA) return process.env.KEYBOARD_INTERACTION_BASE_SHA;
  try {
    return git(['rev-parse', 'HEAD^']).trim();
  } catch {
    return null;
  }
}

function readBaseSource(base, path) {
  try {
    return git(['show', `${base}:${path}`]);
  } catch {
    return '';
  }
}

function countByRule(findings) {
  const counts = new Map();
  for (const finding of findings) counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1);
  return counts;
}

function changedFrontendFiles(base) {
  return git(['diff', '--name-only', `${base}...HEAD`])
    .split('\n')
    .map((path) => path.trim())
    .filter(Boolean)
    .filter(
      (path) =>
        path.startsWith('frontend/src/app/') &&
        (path.endsWith('.html') || path.endsWith('.ts')) &&
        !path.endsWith('.spec.ts') &&
        !path.endsWith('.test.ts') &&
        !path.startsWith('frontend/src/app/components/ui/') &&
        path !== 'frontend/src/app/components/primitives/a11y-clickable.ts',
    );
}

export function compareKeyboardFindings(beforeSource, currentSource) {
  const before = scanKeyboardInteractionSource(beforeSource);
  const current = scanKeyboardInteractionSource(currentSource);
  const beforeViolations = countByRule(before.violations);
  const beforeWarnings = countByRule(before.warnings);

  return {
    violations: current.violations.filter(
      (finding, index, all) =>
        index >= (beforeViolations.get(finding.rule) ?? 0) +
          all.slice(0, index).filter((candidate) => candidate.rule !== finding.rule).length,
    ),
    warnings: current.warnings.filter(
      (finding, index, all) =>
        index >= (beforeWarnings.get(finding.rule) ?? 0) +
          all.slice(0, index).filter((candidate) => candidate.rule !== finding.rule).length,
    ),
  };
}

function newlyIntroduced(beforeSource, currentSource) {
  const before = scanKeyboardInteractionSource(beforeSource);
  const current = scanKeyboardInteractionSource(currentSource);
  const beforeViolationCounts = countByRule(before.violations);
  const beforeWarningCounts = countByRule(before.warnings);
  const seenViolations = new Map();
  const seenWarnings = new Map();

  const violations = current.violations.filter((finding) => {
    const seen = seenViolations.get(finding.rule) ?? 0;
    seenViolations.set(finding.rule, seen + 1);
    return seen >= (beforeViolationCounts.get(finding.rule) ?? 0);
  });
  const warnings = current.warnings.filter((finding) => {
    const seen = seenWarnings.get(finding.rule) ?? 0;
    seenWarnings.set(finding.rule, seen + 1);
    return seen >= (beforeWarningCounts.get(finding.rule) ?? 0);
  });

  return { violations, warnings };
}

function main() {
  const base = resolveBase();
  if (!base) {
    console.log('Keyboard interaction migration check skipped: no base commit is available.');
    return;
  }

  let candidates;
  try {
    candidates = changedFrontendFiles(base);
  } catch (error) {
    console.error(`Unable to calculate keyboard-interaction changes from ${base}.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const failures = [];
  const reviewWarnings = [];

  for (const path of candidates) {
    const absolute = resolve(root, path);
    const current = existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
    const before = readBaseSource(base, path);
    const delta = newlyIntroduced(before, current);
    for (const finding of delta.violations) failures.push({ path, ...finding });
    for (const finding of delta.warnings) reviewWarnings.push({ path, ...finding });
  }

  for (const warning of reviewWarnings) {
    console.warn(`Keyboard interaction review: ${warning.path}:${warning.line} [${warning.rule}]`);
    console.warn(`  ${warning.message}`);
    console.warn(`  ${warning.excerpt}`);
  }

  if (failures.length > 0) {
    console.error('Keyboard interaction contract verification failed:');
    for (const failure of failures) {
      console.error(`- ${failure.path}:${failure.line} [${failure.rule}] ${failure.message}`);
      console.error(`  ${failure.excerpt}`);
    }
    console.error('\nSee docs/keyboard-interaction-standards.md and docs/keyboard-interaction-verification.md.');
    process.exitCode = 1;
    return;
  }

  console.log(
    `Keyboard interaction contract verified across ${candidates.length} changed frontend feature file(s); ${reviewWarnings.length} review warning(s).`,
  );
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();

#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appRoot = resolve(root, 'frontend/src/app');
const ownedUiRoot = 'frontend/src/app/components/ui/';
const legacyPrimitiveRoot = 'frontend/src/app/components/primitives/';

function files(path) {
  const result = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) result.push(...files(full));
    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.html'))) result.push(full);
  }
  return result;
}

function repoPath(absolutePath) {
  return relative(root, absolutePath).replaceAll('\\', '/');
}

function changedFrontendFiles() {
  const base = process.env.SPARTAN_BOUNDARY_BASE_SHA;
  if (!base) return [];

  try {
    return execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRTUXB', `${base}...HEAD`], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .map((path) => path.trim())
      .filter((path) => path.startsWith('frontend/src/app/') && (path.endsWith('.ts') || path.endsWith('.html')))
      .filter((path) => existsSync(resolve(root, path)));
  } catch (error) {
    console.error(`Unable to calculate Spartan boundary diff from ${base}.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function openingTags(source, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[\\s\\S]*?>`, 'g');
  return source.match(pattern) ?? [];
}

const violations = [];
const brainImportPattern = /from\s+['"]@spartan-ng\/brain(?:\/[^'"]*)?['"]/;

// Direct Brain ownership is strict across the current tree. Feature code must
// consume the repository-owned Helm/Relay boundary instead.
for (const absolutePath of files(appRoot)) {
  const path = repoPath(absolutePath);
  if (!path.endsWith('.ts') || path.startsWith(ownedUiRoot)) continue;
  const source = readFileSync(absolutePath, 'utf8');
  if (brainImportPattern.test(source)) {
    violations.push(`${path}: direct @spartan-ng/brain import outside the owned Helm layer`);
  }
}

// Bespoke interaction-state detection is changed-files-aware so the legacy
// migration can continue incrementally without forcing an unsafe bulk rewrite.
const changedFiles = changedFrontendFiles();
for (const path of changedFiles) {
  if (path.startsWith(ownedUiRoot) || path.endsWith('.spec.ts')) continue;
  const source = readFileSync(resolve(root, path), 'utf8');

  const manualFocusTrap = /\b(trapFocus|focusTrap|firstFocusable|lastFocusable|focusableElements)\b/i.test(source);
  if (manualFocusTrap) {
    violations.push(`${path}: newly changed feature code appears to implement a manual focus trap; use the approved Spartan overlay primitive`);
  }

  const manualEscapeListener =
    /(document|window)\.addEventListener\(\s*['"]keydown['"]/.test(source) &&
    /(?:event|e)\.key\s*===?\s*['"]Escape['"]/.test(source);
  if (manualEscapeListener) {
    violations.push(`${path}: newly changed feature code manually owns Escape-key overlay behaviour; use Spartan dialog/sheet/menu ownership`);
  }

  const rovingTabindex =
    /(?:tabindex|tabIndex)/.test(source) &&
    /(?:ArrowLeft|ArrowRight|ArrowUp|ArrowDown)/.test(source) &&
    /(?:activeIndex|focusedIndex|selectedIndex|roving)/i.test(source);
  if (rovingTabindex) {
    violations.push(`${path}: newly changed feature code appears to implement roving tabindex; use the appropriate Spartan selection/navigation primitive`);
  }

  // A combobox role alone is not evidence of bespoke keyboard ownership. The
  // changed feature must also own active-descendant state or an explicit
  // ArrowUp/ArrowDown key handler. This avoids false positives from templates
  // that contain unrelated icon names or translated text mentioning arrows.
  const comboboxRole = /role=["']combobox["']|role:\s*["']combobox["']/.test(source);
  const ownsActiveDescendant = /aria-activedescendant/.test(source);
  const ownsComboboxArrowHandler =
    /\(keydown(?:\.(?:arrowdown|arrowup))?\)/i.test(source) ||
    /(?:event|e)\.key\s*===?\s*['"]Arrow(?:Down|Up)['"]/.test(source);
  const manualCombobox = comboboxRole && (ownsActiveDescendant || ownsComboboxArrowHandler);
  if (manualCombobox) {
    violations.push(`${path}: newly changed feature code appears to implement combobox keyboard state; use the Spartan combobox/autocomplete primitive`);
  }

  // Generic feature actions must now cross the owned Helm button boundary.
  // Legacy primitive implementations themselves remain temporarily exempt so
  // they can be retired incrementally without making unrelated migrations atomic.
  if (!path.startsWith(legacyPrimitiveRoot)) {
    const unownedButtons = openingTags(source, 'button').filter((tag) => !/\bhlmBtn\b/.test(tag));
    if (unownedButtons.length > 0) {
      violations.push(
        `${path}: ${unownedButtons.length} native button(s) bypass the Spartan Helm button directive; add hlmBtn or use an approved product composition`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error('Spartan ownership boundary verification failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('\nFeature code should use Relay/Helm abstractions. See docs/spartan-relay-architecture.md.');
  process.exit(1);
}

const incremental = process.env.SPARTAN_BOUNDARY_BASE_SHA
  ? ` Changed feature files inspected for bespoke interaction state: ${changedFiles.length}.`
  : '';
console.log(`Spartan ownership boundary verified with zero feature-level Brain imports.${incremental}`);

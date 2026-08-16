#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appRoot = resolve(root, 'frontend/src/app');
const ownedUiRoot = 'frontend/src/app/components/ui/';

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
    return execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .map((path) => path.trim())
      .filter((path) => path.startsWith('frontend/src/app/') && (path.endsWith('.ts') || path.endsWith('.html')));
  } catch (error) {
    console.error(`Unable to calculate Spartan boundary diff from ${base}.`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
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
  if (path.startsWith(ownedUiRoot)) continue;
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

  const manualCombobox =
    /role=["']combobox["']|role:\s*["']combobox["']/.test(source) &&
    /(?:ArrowDown|ArrowUp|aria-activedescendant)/.test(source);
  if (manualCombobox) {
    violations.push(`${path}: newly changed feature code appears to implement combobox keyboard state; use the Spartan combobox/autocomplete primitive`);
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

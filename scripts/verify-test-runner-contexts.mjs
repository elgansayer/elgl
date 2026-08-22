#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const PACKAGE_FILES = Object.freeze([
  'package.json',
  'frontend/package.json',
  'backend/package.json',
  'admin-portal/package.json',
  'e2e/package.json',
]);

const COMMAND_SCAN_DIRECTORIES = Object.freeze([
  '.github/workflows',
  '.agents/automations',
]);

const DIRECT_PLAYWRIGHT_SPEC_PATTERN =
  /\b(?:cd\s+e2e\s*&&\s*)?(?:node|tsx|ts-node|bun)\s+(?!(?:--test|test)\b)(?:--[^\s]+\s+)*(?:\.\/)?(?:e2e\/)?tests\/[^\s"'`;&|]+\.spec\.[cm]?[jt]sx?\b/gi;
const WRONG_TEST_RUNNER_PATTERN =
  /\b(?:cd\s+e2e\s*&&\s*)?(?:npx\s+)?(?:vitest|jest)\b[^\n;&|]*(?:\.\/)?(?:e2e\/)?tests\/[^\s"'`;&|]+\.spec\.[cm]?[jt]sx?\b/gi;

export function findCommandViolations(source, label = 'input') {
  const violations = [];

  for (const match of source.matchAll(DIRECT_PLAYWRIGHT_SPEC_PATTERN)) {
    violations.push({
      kind: 'direct-playwright-spec',
      label,
      command: match[0].trim(),
      message:
        'Playwright specs must run through the e2e package test script, not through a generic JavaScript/TypeScript runtime.',
    });
  }

  for (const match of source.matchAll(WRONG_TEST_RUNNER_PATTERN)) {
    violations.push({
      kind: 'wrong-test-runner',
      label,
      command: match[0].trim(),
      message: 'Playwright specs under e2e/tests must not be collected by Vitest or Jest.',
    });
  }

  return violations;
}

export function validatePackageScripts(packages) {
  const violations = [];
  const e2ePackage = packages['e2e/package.json'];
  const e2eTest = String(e2ePackage?.scripts?.test ?? '');

  if (!/\bplaywright\s+test\b/.test(e2eTest)) {
    violations.push({
      kind: 'missing-playwright-owner',
      label: 'e2e/package.json',
      command: e2eTest,
      message: 'e2e/package.json must own Playwright execution through its test script.',
    });
  }

  for (const packagePath of ['package.json', 'frontend/package.json', 'backend/package.json', 'admin-portal/package.json']) {
    const testScript = String(packages[packagePath]?.scripts?.test ?? '');
    if (/\bplaywright\s+test\b/.test(testScript) || /(?:^|\s)e2e\/tests\//.test(testScript)) {
      violations.push({
        kind: 'playwright-owned-by-wrong-package',
        label: packagePath,
        command: testScript,
        message: 'Only e2e/package.json may own the standalone Playwright suite.',
      });
    }
  }

  return violations;
}

export function validateE2ERunnerWorkflow(source) {
  const violations = [];
  const workingDirectoryCount = source.match(/working-directory:\s*e2e\b/g)?.length ?? 0;

  if (!/run:\s*npm test -- --list\b/.test(source)) {
    violations.push({
      kind: 'missing-playwright-discovery',
      label: '.github/workflows/e2e-runner-context.yml',
      command: '',
      message: 'The E2E runner-context workflow must perform Playwright test discovery.',
    });
  }

  if (workingDirectoryCount < 2) {
    violations.push({
      kind: 'wrong-playwright-working-directory',
      label: '.github/workflows/e2e-runner-context.yml',
      command: '',
      message:
        'Dependency installation and Playwright discovery must both execute with working-directory: e2e.',
    });
  }

  return violations;
}

async function readPackageFiles() {
  const packages = {};
  const rawSources = [];

  for (const packagePath of PACKAGE_FILES) {
    const raw = await readFile(resolve(REPO_ROOT, packagePath), 'utf8');
    packages[packagePath] = JSON.parse(raw);
    rawSources.push({ label: packagePath, source: raw });
  }

  return { packages, rawSources };
}

async function readCommandSources() {
  const sources = [];

  for (const directory of COMMAND_SCAN_DIRECTORIES) {
    const absoluteDirectory = resolve(REPO_ROOT, directory);
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !/\.(?:md|ya?ml)$/.test(entry.name)) continue;
      const label = `${directory}/${entry.name}`;
      sources.push({ label, source: await readFile(resolve(absoluteDirectory, entry.name), 'utf8') });
    }
  }

  return sources;
}

export async function verifyRepository(root = REPO_ROOT) {
  if (root !== REPO_ROOT) {
    throw new Error('verifyRepository currently validates the checked-out repository root only');
  }

  const { packages, rawSources } = await readPackageFiles();
  const commandSources = [...rawSources, ...(await readCommandSources())];
  const workflowSource = await readFile(
    resolve(REPO_ROOT, '.github/workflows/e2e-runner-context.yml'),
    'utf8',
  );

  return [
    ...validatePackageScripts(packages),
    ...validateE2ERunnerWorkflow(workflowSource),
    ...commandSources.flatMap(({ label, source }) => findCommandViolations(source, label)),
  ];
}

async function main() {
  const violations = await verifyRepository();

  if (violations.length === 0) {
    console.log('Test runner context check passed.');
    return;
  }

  console.error('Test runner context check failed:');
  for (const violation of violations) {
    const command = violation.command ? ` (${violation.command})` : '';
    console.error(`- ${violation.label}: ${violation.message}${command}`);
  }
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}

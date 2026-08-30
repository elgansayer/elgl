#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_EXTENSIONS = new Set([
  '.sh',
  '.bash',
  '.mjs',
  '.cjs',
  '.js',
  '.ts',
  '.json',
  '.yml',
  '.yaml',
]);
const IGNORED_SCAN_PATHS = new Set([
  'scripts/verify-playwright-test-boundary.mjs',
  'scripts/verify-playwright-test-boundary.test.mjs',
]);
const CONTEXT_LINES = 10;
const COMMAND_SOURCE_PREFIXES = [
  '.github/workflows/',
  '.agents/automations/',
  'automation/',
  'scripts/',
];

function normalizePath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function workflowStepContext(lines, index) {
  let start = index;
  let stepIndent = null;

  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const match = lines[cursor].match(/^(\s*)-\s+/);
    if (match) {
      start = cursor;
      stepIndent = match[1].length;
      break;
    }
  }

  if (stepIndent === null) {
    return lines[index] ?? '';
  }

  let end = lines.length;
  for (let cursor = start + 1; cursor < lines.length; cursor += 1) {
    const match = lines[cursor].match(/^(\s*)-\s+/);
    if (match && match[1].length === stepIndent) {
      end = cursor;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

function hasSafePlaywrightContext(lines, index, path) {
  const normalizedPath = normalizePath(path);
  if (normalizedPath.startsWith('e2e/')) {
    return true;
  }

  const context = /\.ya?ml$/.test(normalizedPath)
    ? workflowStepContext(lines, index)
    : lines
        .slice(
          Math.max(0, index - CONTEXT_LINES),
          Math.min(lines.length, index + CONTEXT_LINES + 1),
        )
        .join('\n');

  const changesIntoE2e = /\bcd\s+(?:\.\/)?e2e(?:\s|&&|;|\)|$)/m.test(context);
  const usesE2eWorkingDirectory = /working-directory\s*:\s*["']?(?:\.\/)?e2e["']?\s*$/m.test(
    context,
  );
  const usesE2eConfig =
    /--config(?:=|\s+)["']?(?:\.\/)?e2e\/playwright\.config\.(?:ts|js|mjs)["']?/m.test(context);

  return changesIntoE2e || usesE2eWorkingDirectory || usesE2eConfig;
}

function isCommandSource(path) {
  return (
    path.endsWith('package.json') ||
    COMMAND_SOURCE_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

function normalizeCommandLine(line) {
  return line
    .replaceAll('\\', '/')
    .replaceAll(/['"`]/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function targetBelongsToE2e(match, lines, index, path) {
  return Boolean(match?.[1]) || hasSafePlaywrightContext(lines, index, path);
}

function scanWrongRunnerInvocations(files) {
  const violations = [];

  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizePath(rawPath);
    if (IGNORED_SCAN_PATHS.has(path) || !isCommandSource(path)) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const command = normalizeCommandLine(line);
      const specTarget = command.match(
        /(?:^|[\s(])((?:\.\/)?e2e\/)?tests\/[^\s;&|)]*\.spec\.[cm]?[jt]sx?(?=$|[\s;&|)])/i,
      );
      if (
        specTarget &&
        targetBelongsToE2e(specTarget, lines, index, path) &&
        /\b(?:node|tsx|ts-node|bun)\b/i.test(command)
      ) {
        violations.push(
          `${path}:${index + 1} executes a Playwright spec through a generic JavaScript/TypeScript runtime`,
        );
      }

      const testsTarget = command.match(
        /(?:^|[\s(])((?:\.\/)?e2e\/)?tests(?:\/[^\s;&|)]*)?(?=$|[\s;&|)])/i,
      );
      if (
        testsTarget &&
        targetBelongsToE2e(testsTarget, lines, index, path) &&
        /\b(?:vitest|jest)\b/i.test(command)
      ) {
        violations.push(`${path}:${index + 1} sends the Playwright suite to Vitest or Jest`);
      }
    });
  }

  return violations;
}

function scanPlaywrightInvocations(files) {
  const violations = [];

  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizePath(rawPath);
    if (IGNORED_SCAN_PATHS.has(path) || !SCRIPT_EXTENSIONS.has(extname(path))) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const normalizedLine = line.replace(/\s+/g, ' ').trim();
      if (!normalizedLine.includes('playwright test')) {
        return;
      }

      if (!hasSafePlaywrightContext(lines, index, path)) {
        violations.push(
          `${path}:${index + 1} invokes Playwright without the e2e working directory or explicit e2e config`,
        );
      }
    });
  }

  return violations;
}

function validateE2ePackage(e2ePackageJson) {
  const violations = [];
  let pkg;
  try {
    pkg = JSON.parse(e2ePackageJson);
  } catch {
    return ['e2e/package.json is not valid JSON'];
  }

  const testScript = pkg?.scripts?.test;
  if (typeof testScript !== 'string' || !testScript.includes('playwright test')) {
    violations.push('e2e/package.json must own the canonical Playwright test script');
  }

  if (!pkg?.devDependencies?.['@playwright/test']) {
    violations.push('e2e/package.json must own the @playwright/test dependency');
  }

  return violations;
}

function validateE2eConfig(e2eConfig) {
  const violations = [];
  if (!/\btestDir\s*:\s*["']\.\/tests["']/.test(e2eConfig)) {
    violations.push("e2e/playwright.config.ts must constrain discovery to testDir: './tests'");
  }
  return violations;
}

function scanFrontendSpecs(files) {
  const violations = [];
  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizePath(rawPath);
    if (!path.startsWith('frontend/') || !/\.(?:spec|test)\.ts$/.test(path)) {
      continue;
    }
    if (/from\s+["']@playwright\/test["']|require\(["']@playwright\/test["']\)/.test(content)) {
      violations.push(`${path} is a frontend unit test importing the Playwright runner`);
    }
  }
  return violations;
}

function scanBrittleE2eLoginHelpers(files) {
  const violations = [];

  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizePath(rawPath);
    if (!path.startsWith('e2e/tests/') || !/\.spec\.ts$/.test(path)) {
      continue;
    }

    if (/\bloginIfNeeded\b/.test(content)) {
      violations.push(
        `${path} defines or calls loginIfNeeded; E2E specs must not conditionally scrape the login form`,
      );
    }

    if (
      !/(?:^|\/)auth(?:-flows)?\.spec\.ts$/.test(path) &&
      /input\[name=["']email["']\]/.test(content)
    ) {
      violations.push(
        `${path} targets the legacy input[name="email"] login selector outside an authentication spec`,
      );
    }
  }

  return violations;
}

export function analysePlaywrightBoundary({ files, e2ePackageJson, e2eConfig }) {
  return [
    ...validateE2ePackage(e2ePackageJson),
    ...validateE2eConfig(e2eConfig),
    ...scanPlaywrightInvocations(files),
    ...scanWrongRunnerInvocations(files),
    ...scanFrontendSpecs(files),
    ...scanBrittleE2eLoginHelpers(files),
  ];
}

function readTrackedFiles(repoRoot) {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const files = {};
  for (const rawPath of output.split('\0')) {
    if (!rawPath) {
      continue;
    }
    const path = normalizePath(rawPath);
    const extension = extname(path);
    const automationMarkdown = path.startsWith('.agents/automations/') && extension === '.md';
    if (
      !SCRIPT_EXTENSIONS.has(extension) &&
      !/\.(?:spec|test)\.ts$/.test(path) &&
      !automationMarkdown
    ) {
      continue;
    }
    files[path] = readFileSync(resolve(repoRoot, path), 'utf8');
  }
  return files;
}

function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '..');
  const files = readTrackedFiles(repoRoot);
  const violations = analysePlaywrightBoundary({
    files,
    e2ePackageJson: readFileSync(resolve(repoRoot, 'e2e/package.json'), 'utf8'),
    e2eConfig: readFileSync(resolve(repoRoot, 'e2e/playwright.config.ts'), 'utf8'),
  });

  if (violations.length > 0) {
    console.error('Playwright test-boundary verification failed:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    'Playwright test boundary verified: E2E discovery is isolated and brittle conditional login helpers are absent.',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

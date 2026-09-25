#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_EXTENSIONS = new Set(['.sh', '.bash', '.mjs', '.cjs', '.js', '.ts', '.json', '.yml', '.yaml']);
const YAML_EXTENSIONS = new Set(['.yml', '.yaml']);
const IGNORED_SCAN_PATHS = new Set([
  'scripts/verify-playwright-test-boundary.mjs',
  'scripts/verify-playwright-test-boundary.test.mjs',
]);

const PLAYWRIGHT_INVOCATION = /\bplaywright\s+test\b/g;
const E2E_CONFIG_FLAG =
  /--config(?:=|\s+)["']?(?:\.\/)?e2e\/playwright\.config\.(?:ts|js|mjs)["']?/;
const CHANGE_DIRECTORY = /\bcd\s+(["']?[^\s;&|()"']+["']?)/g;
const COMMAND_SEPARATOR = /&&|\|\||[;|)]/;
const COMMENT_LINE = /^\s*(?:#|\/\/)/;
const RUN_KEY = /^\s*run\s*:/;
const STEP_OPENER = /^\s*-\s/;
const E2E_WORKING_DIRECTORY = /^\s*working-directory\s*:\s*(["']?)(?:\.\/)?e2e\/?\1\s*(?:#.*)?$/;
const UNSAFE_INVOCATION_MESSAGE =
  'invokes Playwright without the e2e working directory or explicit e2e config: ' +
  'use "(cd e2e && npx playwright test)", "--config e2e/playwright.config.ts", ' +
  'or "working-directory: e2e" on the same workflow step';

function normalizePath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function leadingSpaces(line) {
  return line.length - line.trimStart().length;
}

function isBlankOrComment(line) {
  return line.trim() === '' || COMMENT_LINE.test(line);
}

function countOf(text, character) {
  return [...text].filter((candidate) => candidate === character).length;
}

// A shell continuation (`cd e2e && \` then `npx playwright test`) is one command, so join it
// while remembering the physical line where the command starts for the violation report. A
// comment never continues, so a trailing backslash in one cannot swallow the next real command.
function toLogicalLines(lines) {
  const logicalLines = [];
  let index = 0;
  while (index < lines.length) {
    const start = index;
    let text = lines[index];
    index += 1;
    while (!COMMENT_LINE.test(text) && /\\\s*$/.test(text) && index < lines.length) {
      text = `${text.replace(/\\\s*$/, ' ')}${lines[index].trimStart()}`;
      index += 1;
    }
    logicalLines.push({ text, index: start });
  }
  return logicalLines;
}

function isE2eDirectory(target) {
  return /(?:^|\/)e2e\/?$/.test(target.replace(/^["']|["']$/g, ''));
}

// Where the command itself runs the invocation: 'e2e' for an explicit e2e config or the innermost
// `cd` still in effect entering e2e, 'elsewhere' for any other `cd` still in effect, and undefined
// when the command never moves (it then inherits the working directory of its caller). A `cd` is
// no longer in effect once its subshell has closed: `(cd e2e && npm ci) && npx playwright test`.
function commandDirectory(command, invocationStart) {
  const invocation = command.slice(invocationStart).split(COMMAND_SEPARATOR, 1)[0];
  if (E2E_CONFIG_FLAG.test(invocation)) {
    return 'e2e';
  }

  const beforeInvocation = command.slice(0, invocationStart);
  for (const change of [...beforeInvocation.matchAll(CHANGE_DIRECTORY)].reverse()) {
    const sinceChange = beforeInvocation.slice(change.index);
    if (countOf(sinceChange, ')') <= countOf(sinceChange, '(')) {
      return isE2eDirectory(change[1]) ? 'e2e' : 'elsewhere';
    }
  }
  return undefined;
}

// A GitHub Actions `working-directory` only vouches for the `run` script of the step that
// declares it. Blank the list dash so every key of one step shares a column, then look for the
// working directory among the keys of the step that owns the invocation and nowhere else.
function stepRunsFromE2e(rawLines, index) {
  const lines = rawLines.map((line) => line.replace(/^(\s*)-(\s)/, '$1 $2'));
  const runIndex = findRunKey(lines, index);
  if (runIndex < 0) {
    return false;
  }

  const keyIndent = leadingSpaces(lines[runIndex]);
  const opensStep = (cursor) =>
    STEP_OPENER.test(rawLines[cursor]) && leadingSpaces(rawLines[cursor]) < keyIndent;
  const stepKeys = [lines[runIndex]];

  // A run key that carries the list dash itself starts the step, so nothing above belongs to it.
  if (rawLines[runIndex] === lines[runIndex]) {
    for (let cursor = runIndex - 1; cursor >= 0; cursor -= 1) {
      if (isBlankOrComment(rawLines[cursor])) {
        continue;
      }
      if (opensStep(cursor)) {
        stepKeys.push(lines[cursor]);
        break;
      }
      if (leadingSpaces(lines[cursor]) < keyIndent) {
        break;
      }
      stepKeys.push(lines[cursor]);
    }
  }

  for (let cursor = runIndex + 1; cursor < lines.length; cursor += 1) {
    if (isBlankOrComment(rawLines[cursor])) {
      continue;
    }
    if (opensStep(cursor) || leadingSpaces(lines[cursor]) < keyIndent) {
      break;
    }
    stepKeys.push(lines[cursor]);
  }

  return stepKeys.some(
    (line) => leadingSpaces(line) === keyIndent && E2E_WORKING_DIRECTORY.test(line),
  );
}

// Finds the `run:` key whose value (a one-line command or a block scalar) contains the line.
function findRunKey(lines, index) {
  if (RUN_KEY.test(lines[index])) {
    return index;
  }

  const invocationIndent = leadingSpaces(lines[index]);
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (isBlankOrComment(lines[cursor]) || leadingSpaces(lines[cursor]) >= invocationIndent) {
      continue;
    }
    return RUN_KEY.test(lines[cursor]) ? cursor : -1;
  }
  return -1;
}

function scanPlaywrightInvocations(files) {
  const violations = [];

  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizePath(rawPath);
    // The e2e package owns its scripts, so its own working directory is e2e by definition.
    if (
      IGNORED_SCAN_PATHS.has(path) ||
      path.startsWith('e2e/') ||
      !SCRIPT_EXTENSIONS.has(extname(path))
    ) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const isYaml = YAML_EXTENSIONS.has(extname(path));
    for (const { text, index } of toLogicalLines(lines)) {
      // A commented-out or documented-as-forbidden invocation cannot run.
      if (COMMENT_LINE.test(text)) {
        continue;
      }

      // An explicit `cd` on the command decides; only a command that never moves inherits the
      // working directory of its workflow step.
      const unsafe = [...text.matchAll(PLAYWRIGHT_INVOCATION)].some((match) => {
        const directory = commandDirectory(text, match.index);
        return !(
          directory === 'e2e' ||
          (directory === undefined && isYaml && stepRunsFromE2e(lines, index))
        );
      });
      if (unsafe) {
        violations.push(`${path}:${index + 1} ${UNSAFE_INVOCATION_MESSAGE}`);
      }
    }
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
    if (!SCRIPT_EXTENSIONS.has(extension) && !/\.(?:spec|test)\.ts$/.test(path)) {
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

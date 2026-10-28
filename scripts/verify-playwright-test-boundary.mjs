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
const PLAYWRIGHT_TEST_FILE_PATTERN = /\.(?:spec|test)\.[cm]?[jt]sx?$/;
const RUNNER_GLOBAL_REPLACEMENTS = new Map([
  ['describe', 'test.describe'],
  ['it', 'test'],
  ['beforeAll', 'test.beforeAll'],
  ['beforeEach', 'test.beforeEach'],
  ['afterAll', 'test.afterAll'],
  ['afterEach', 'test.afterEach'],
]);
const RUNNER_MODIFIERS = [
  'only',
  'skip',
  'todo',
  'each',
  'for',
  'concurrent',
  'sequential',
  'shuffle',
  'runIf',
  'skipIf',
  'fails',
  'failing',
];
const RUNNER_NAMESPACES = ['vi', 'jest'];
const FOREIGN_RUNNER_MODULES = ['vitest', '@jest/globals', 'node:test'];
// Comments and string literals, matched left to right so a quote inside a comment (or the other
// way round) cannot start the wrong token.
const COMMENT_OR_STRING_PATTERN =
  /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`/g;
const NOT_A_MEMBER = String.raw`(?<![\w$])(?<!\.\s*)`;
const FOREIGN_RUNNER_IMPORT_PATTERN = new RegExp(
  String.raw`\b(?:from|import|require)\s*\(?\s*(['"])(${FOREIGN_RUNNER_MODULES.join('|')})\1`,
  'g',
);
const RUNNER_GLOBAL_CALL_PATTERN = new RegExp(
  String.raw`${NOT_A_MEMBER}(${[...RUNNER_GLOBAL_REPLACEMENTS.keys()].join('|')})(?![\w$])(?:\s*\.\s*(?:${RUNNER_MODIFIERS.join('|')})(?![\w$]))*\s*\(`,
  'g',
);
const RUNNER_NAMESPACE_PATTERN = new RegExp(
  String.raw`${NOT_A_MEMBER}(${RUNNER_NAMESPACES.join('|')})\s*\.\s*[A-Za-z_$]`,
  'g',
);

function normalizePath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function hasSafePlaywrightContext(lines, index, path) {
  const normalizedPath = normalizePath(path);
  if (normalizedPath.startsWith('e2e/')) {
    return true;
  }

  const start = Math.max(0, index - CONTEXT_LINES);
  const end = Math.min(lines.length, index + CONTEXT_LINES + 1);
  const context = lines.slice(start, end).join('\n');

  const changesIntoE2e = /\bcd\s+(?:\.\/)?e2e(?:\s|&&|;|\)|$)/m.test(context);
  const usesE2eWorkingDirectory = /working-directory\s*:\s*["']?(?:\.\/)?e2e["']?\s*$/m.test(
    context,
  );
  const usesE2eConfig =
    /--config(?:=|\s+)["']?(?:\.\/)?e2e\/playwright\.config\.(?:ts|js|mjs)["']?/m.test(context);

  return changesIntoE2e || usesE2eWorkingDirectory || usesE2eConfig;
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

function maskSource(source, keepStrings) {
  return source.replace(COMMENT_OR_STRING_PATTERN, (token) =>
    keepStrings && !token.startsWith('/') ? token : token.replace(/[^\n]/g, ' '),
  );
}

function isLocallyBound(name, code) {
  const identifier = String.raw`(?<![\w$.])${name}(?![\w$])`;
  return [
    String.raw`\b(?:const|let|var|function|class)\s+${identifier}`,
    String.raw`\b(?:const|let|var)\s*\{[^}]*${identifier}[^}]*\}\s*=`,
    String.raw`\bimport\s*(?:[\w$]+\s*,\s*)?\{[^}]*${identifier}[^}]*\}\s*from`,
    String.raw`\bimport\s+${identifier}`,
  ].some((pattern) => new RegExp(pattern).test(code));
}

function findBareRunnerGlobals(code, pattern, describeViolation) {
  const findings = [];
  const reported = new Set();

  for (const match of code.matchAll(pattern)) {
    const name = match[1];
    if (reported.has(name) || isLocallyBound(name, code)) {
      continue;
    }
    reported.add(name);
    findings.push({ index: match.index, message: describeViolation(name) });
  }

  return findings;
}

function findForeignRunnerImports(sourceWithStrings) {
  return [...sourceWithStrings.matchAll(FOREIGN_RUNNER_IMPORT_PATTERN)].map((match) => ({
    index: match.index,
    message: `imports ${match[2]}; Playwright specs must import test and expect from @playwright/test only`,
  }));
}

function scanE2eRunnerGlobals(files) {
  const violations = [];

  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizePath(rawPath);
    if (!path.startsWith('e2e/tests/') || !PLAYWRIGHT_TEST_FILE_PATTERN.test(path)) {
      continue;
    }

    const code = maskSource(content, false);
    const findings = [
      ...findForeignRunnerImports(maskSource(content, true)),
      ...findBareRunnerGlobals(
        code,
        RUNNER_GLOBAL_CALL_PATTERN,
        (name) =>
          `calls ${name}() as a bare runner global; Playwright does not define it and fails with "ReferenceError: ${name} is not defined". Use ${RUNNER_GLOBAL_REPLACEMENTS.get(name)}() from @playwright/test`,
      ),
      ...findBareRunnerGlobals(
        code,
        RUNNER_NAMESPACE_PATTERN,
        (name) =>
          `uses the ${name} test-runner namespace; Playwright does not define it and fails with "ReferenceError: ${name} is not defined". Use page.route() to intercept network calls and plain closures to record calls`,
      ),
    ].sort((left, right) => left.index - right.index);

    for (const { index, message } of findings) {
      violations.push(`${path}:${content.slice(0, index).split('\n').length} ${message}`);
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
    ...scanE2eRunnerGlobals(files),
  ];
}

export function shouldReadTrackedFile(path) {
  return SCRIPT_EXTENSIONS.has(extname(path)) || PLAYWRIGHT_TEST_FILE_PATTERN.test(path);
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
    if (!shouldReadTrackedFile(path)) {
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
    'Playwright test boundary verified: E2E discovery is isolated, specs use only Playwright runner APIs and brittle conditional login helpers are absent.',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

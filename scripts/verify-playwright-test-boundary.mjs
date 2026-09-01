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

function commandStartsInE2e(lines, index, path) {
  const normalizedPath = normalizePath(path);
  if (normalizedPath.startsWith('e2e/')) {
    return true;
  }
  if (!/\.ya?ml$/.test(normalizedPath)) {
    return false;
  }
  const contextLines = workflowStepContext(lines, index).split('\n');
  const stepIndent = contextLines[0]?.match(/^(\s*)-\s+/)?.[1].length;
  if (stepIndent === undefined) {
    return false;
  }

  return contextLines.some((line) => {
    const match = /^(\s*)(-\s*)?working-directory\s*:\s*["']?(?:\.\/)?e2e\/?["']?\s*$/.exec(line);
    if (!match) {
      return false;
    }
    return match[2] ? match[1].length === stepIndent : match[1].length === stepIndent + 2;
  });
}

function isCommandSource(path) {
  return (
    ['.sh', '.bash'].includes(extname(path)) ||
    path.endsWith('package.json') ||
    COMMAND_SOURCE_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

function normalizeCommandLine(line) {
  return line
    .replace(/\\(?=[^;|&'"`\\\s])/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripUnquotedShellComment(line) {
  let quote = null;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '#' && (index === 0 || /[\s;|&()]/.test(line[index - 1]))) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line;
}

function logicalCommandLines(lines, path) {
  const commands = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const foldedRun = /^(\s*)(?:-\s*)?run\s*:\s*>[+-]?\s*$/.exec(line);
    const literalRun = /^(\s*)(?:-\s*)?run\s*:\s*\|[+-]?\s*$/.exec(line);
    const blockRun = foldedRun ?? literalRun;
    if (/\.ya?ml$/.test(path) && blockRun) {
      const indent = blockRun[1].length;
      const parts = [];
      let cursor = index + 1;
      for (; cursor < lines.length; cursor += 1) {
        const next = lines[cursor];
        if (next.trim() && next.match(/^\s*/)[0].length <= indent) {
          break;
        }
        parts.push(next.trim());
      }
      let command = '';
      for (const rawPart of parts) {
        const part = literalRun ? stripUnquotedShellComment(rawPart) : rawPart;
        if (!part) {
          continue;
        }
        const continued = /\\\s*$/.test(command);
        const separator = command && literalRun && !continued ? ' ; ' : command ? ' ' : '';
        command = `${command.replace(/\\\s*$/, '')}${separator}${part}`;
      }
      commands.push({ command, index });
      index = cursor - 1;
      continue;
    }

    const startIndex = index;
    let command = line;
    while (/\\\s*$/.test(command) && index + 1 < lines.length) {
      command = `${command.replace(/\\\s*$/, '')} ${lines[index + 1].trim()}`;
      index += 1;
    }
    commands.push({ command, index: startIndex });
  }

  return commands;
}

function commandSegments(command) {
  const segments = [];
  let start = 0;
  let quote = null;
  let escaped = false;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (![';', '|', '&'].includes(character)) {
      continue;
    }
    const separator =
      command[index + 1] === character && (character === '|' || character === '&')
        ? character.repeat(2)
        : character;
    segments.push({
      command: command.slice(start, index),
      separatorAfter: separator,
    });
    if (separator.length === 2) {
      index += 1;
    }
    start = index + 1;
  }
  segments.push({ command: command.slice(start), separatorAfter: null });
  return segments;
}

function shellTokens(command) {
  const tokens = [];
  let token = '';
  let quote = null;
  let escaped = false;
  for (const character of command) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (character === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        token += character;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (/\s/.test(character)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
    } else {
      token += character;
    }
  }
  if (escaped) {
    token += '\\';
  }
  if (token) {
    tokens.push(token);
  }
  return tokens;
}

function normalizeExecutable(token) {
  const executable = token.split('/').at(-1) ?? '';
  return executable.replace(/@[^@/]+$/, '');
}

function commandInvocation(segment) {
  let command = segment
    .trim()
    .replace(/^\(+\s*/, '')
    .replace(/\)+\s*$/, '')
    .replace(/^-\s+/, '')
    .replace(/^(?:[-\w.]+\s*:\s*)/, '');
  if (
    command.length >= 2 &&
    ((command.startsWith('"') && command.endsWith('"')) ||
      (command.startsWith("'") && command.endsWith("'")))
  ) {
    command = command.slice(1, -1);
  }
  let tokens = shellTokens(command);

  if (normalizeExecutable(tokens[0] ?? '') === 'env') {
    tokens = tokens.slice(1);
    const envOptionsWithValues = new Set([
      '-u',
      '--unset',
      '-C',
      '--chdir',
      '-S',
      '--split-string',
    ]);
    while (tokens[0]?.startsWith('-')) {
      const flag = tokens.shift();
      const optionName = flag.split('=', 1)[0];
      if (!flag.includes('=') && envOptionsWithValues.has(optionName) && tokens.length > 0) {
        tokens.shift();
      }
    }
  }
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0] ?? '')) {
    tokens = tokens.slice(1);
  }

  const wrapper = tokens[0];
  if (wrapper === 'npx') {
    tokens = consumeWrapperOptions(tokens.slice(1));
  } else if (wrapper === 'npm' && ['exec', 'x'].includes(tokens[1])) {
    tokens = consumeWrapperOptions(tokens.slice(2));
  } else if (['pnpm', 'yarn'].includes(wrapper) && tokens[1] === 'exec') {
    tokens = tokens.slice(2);
  }
  while (tokens[0] === '--') {
    tokens = tokens.slice(1);
  }

  const executable = normalizeExecutable(tokens.shift() ?? '');
  return { executable, args: tokens };
}

function consumeWrapperOptions(tokens) {
  const remaining = [...tokens];
  while (remaining[0]?.startsWith('-')) {
    const flag = remaining.shift();
    if (['--package', '-p'].includes(flag) && remaining.length > 0) {
      remaining.shift();
    }
  }
  return remaining;
}

function runtimeEntrypoint(invocation) {
  if (!['node', 'tsx', 'ts-node', 'bun'].includes(invocation.executable)) {
    return null;
  }

  let args = [...invocation.args];
  const optionsWithValues = {
    node: new Set([
      '--conditions',
      '--env-file',
      '--experimental-loader',
      '--import',
      '--loader',
      '--require',
      '-r',
      '--test-name-pattern',
      '--test-reporter',
      '--test-reporter-destination',
    ]),
    tsx: new Set(['--tsconfig']),
    'ts-node': new Set([
      '--compiler',
      '--compilerOptions',
      '-O',
      '--cwd',
      '--dir',
      '--project',
      '-P',
      '--require',
      '-r',
      '--scopeDir',
      '--transpiler',
      '--tsconfig',
    ]),
    bun: new Set(['--config', '--cwd', '--preload', '-r']),
  }[invocation.executable];
  const consumeOptions = (values) => {
    const remaining = [...values];
    while (remaining[0]?.startsWith('-')) {
      const flag = remaining.shift();
      const optionName = flag.split('=', 1)[0];
      if (!flag.includes('=') && optionsWithValues.has(optionName) && remaining.length > 0) {
        remaining.shift();
      }
    }
    return remaining;
  };
  args = consumeOptions(args);
  if (invocation.executable === 'bun' && ['run', 'test'].includes(args[0])) {
    args.shift();
  }
  if (invocation.executable === 'tsx' && args[0] === 'watch') {
    args.shift();
  }
  args = consumeOptions(args);
  return args[0] ?? null;
}

function runnerTargets(invocation) {
  const args = [...invocation.args];
  if (['run', 'watch'].includes(args[0])) {
    args.shift();
  }

  const selectingOptions = new Set([
    '--dir',
    '--include',
    '--root',
    '--roots',
    '--testPathPattern',
    '--testPathPatterns',
  ]);
  const nonSelectingOptions = new Set([
    '--config',
    '--exclude',
    '--testNamePattern',
    '--testPathIgnorePatterns',
    '-t',
  ]);
  const targets = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') {
      continue;
    }
    if (argument.startsWith('-')) {
      const equalsIndex = argument.indexOf('=');
      const optionName = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
      const inlineValue = equalsIndex === -1 ? null : argument.slice(equalsIndex + 1);
      if (selectingOptions.has(optionName) && inlineValue) {
        targets.push(inlineValue);
      } else if (selectingOptions.has(optionName) && args[index + 1]) {
        targets.push(args[index + 1]);
        index += 1;
      } else if (nonSelectingOptions.has(optionName) && inlineValue === null) {
        index += 1;
      }
      continue;
    }
    targets.push(argument);
  }
  return targets;
}

function commandEntries(content, path) {
  if (path.endsWith('package.json')) {
    try {
      const scripts = JSON.parse(content)?.scripts ?? {};
      return Object.entries(scripts)
        .filter(([, command]) => typeof command === 'string')
        .map(([name, command]) => ({ command, index: 0, location: `${path}#scripts.${name}` }));
    } catch {
      return [];
    }
  }
  return logicalCommandLines(content.split(/\r?\n/), path);
}

function cwdAfterSegment(cwdState, baseCwdIsE2e, segment, separatorAfter, precedingSeparator) {
  let { cwdIsE2e, cwdIsConditional } = cwdState;
  const cdMatch = /^\s*(?:[-\w.]+\s*:\s*)?\(?\s*cd\s+([^\s;&|)]+)/i.exec(segment);
  if (cdMatch) {
    const target = normalizePath(cdMatch[1].replace(/^['"]|['"]$/g, '')).replace(/\/+$/, '');
    cwdIsE2e =
      precedingSeparator === '||' || precedingSeparator === '|'
        ? baseCwdIsE2e
        : target === 'e2e' || target.startsWith('e2e/');
    cwdIsConditional = precedingSeparator === '&&';
  }

  if (/\)\s*$/.test(segment) || !['&&', ';', null].includes(separatorAfter)) {
    return { cwdIsE2e: baseCwdIsE2e, cwdIsConditional: false };
  }
  if (separatorAfter === ';' && cwdIsConditional) {
    return { cwdIsE2e: baseCwdIsE2e, cwdIsConditional: false };
  }
  return { cwdIsE2e, cwdIsConditional };
}

function isPlaywrightTestInvocation(invocation) {
  if (invocation.executable !== 'playwright') {
    return false;
  }
  return invocation.args.filter((argument) => argument !== '--')[0] === 'test';
}

function targetBelongsToE2e(match, cwdIsE2e) {
  return Boolean(match?.[1]) || cwdIsE2e;
}

function scanWrongRunnerInvocations(files) {
  const violations = [];

  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizePath(rawPath);
    if (IGNORED_SCAN_PATHS.has(path) || !isCommandSource(path)) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const persistsCwd = ['.sh', '.bash'].includes(extname(path));
    let fileCwdState = {
      cwdIsE2e: path.startsWith('e2e/'),
      cwdIsConditional: false,
    };
    for (const { command: rawCommand, index, location } of commandEntries(content, path)) {
      const command = normalizeCommandLine(rawCommand);
      const baseCwdIsE2e = persistsCwd
        ? fileCwdState.cwdIsE2e
        : commandStartsInE2e(lines, index, path);
      let cwdState = persistsCwd
        ? { ...fileCwdState }
        : { cwdIsE2e: baseCwdIsE2e, cwdIsConditional: false };
      let previousSeparator = null;
      for (const segment of commandSegments(command)) {
        const invocation = commandInvocation(segment.command);
        const entrypoint = runtimeEntrypoint(invocation);
        const specTarget = entrypoint?.match(
          /^((?:\.\/)?e2e\/)?(?:\.\/)?tests(?:\/[^\s),]*\.spec\.[cm]?[jt]sx?)?$/i,
        );
        const cwdRelativeSpecTarget =
          cwdState.cwdIsE2e && entrypoint?.match(/^(?:\.\/)?[^\s),]*\.spec\.[cm]?[jt]sx?$/i);
        if (
          (specTarget && targetBelongsToE2e(specTarget, cwdState.cwdIsE2e)) ||
          cwdRelativeSpecTarget
        ) {
          violations.push(
            `${location ?? `${path}:${index + 1}`} executes a Playwright spec through a generic JavaScript/TypeScript runtime`,
          );
        }

        if (
          ['vitest', 'jest'].includes(invocation.executable) &&
          runnerTargets(invocation).some((target) => {
            const testsTarget = target.match(/^((?:\.\/)?e2e\/)?(?:\.\/)?tests(?:\/[^\s),]*)?$/i);
            return testsTarget && targetBelongsToE2e(testsTarget, cwdState.cwdIsE2e);
          })
        ) {
          violations.push(
            `${location ?? `${path}:${index + 1}`} sends the Playwright suite to Vitest or Jest`,
          );
        }
        cwdState = cwdAfterSegment(
          cwdState,
          baseCwdIsE2e,
          segment.command,
          segment.separatorAfter,
          previousSeparator,
        );
        previousSeparator = segment.separatorAfter;
      }
      if (persistsCwd) {
        fileCwdState = cwdState;
      }
    }
  }

  return violations;
}

function scanPlaywrightInvocations(files) {
  const violations = [];

  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizePath(rawPath);
    const scansCommandMarkdown = extname(path) === '.md' && isCommandSource(path);
    if (
      IGNORED_SCAN_PATHS.has(path) ||
      (!SCRIPT_EXTENSIONS.has(extname(path)) && !scansCommandMarkdown)
    ) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const persistsCwd = ['.sh', '.bash'].includes(extname(path));
    let fileCwdState = {
      cwdIsE2e: path.startsWith('e2e/'),
      cwdIsConditional: false,
    };
    for (const { command, index, location } of commandEntries(content, path)) {
      const normalizedLine = command.replace(/\\\s*/g, ' ').replace(/\s+/g, ' ').trim();
      const baseCwdIsE2e = persistsCwd
        ? fileCwdState.cwdIsE2e
        : commandStartsInE2e(lines, index, path);
      let cwdState = persistsCwd
        ? { ...fileCwdState }
        : { cwdIsE2e: baseCwdIsE2e, cwdIsConditional: false };
      let previousSeparator = null;
      for (const segment of commandSegments(normalizedLine)) {
        const invocation = commandInvocation(segment.command);
        if (
          isPlaywrightTestInvocation(invocation) &&
          !cwdState.cwdIsE2e &&
          !/--config(?:=|\s+)(?:"(?:\.\/)?e2e\/playwright\.config\.(?:ts|js|mjs)"|'(?:\.\/)?e2e\/playwright\.config\.(?:ts|js|mjs)'|(?:\.\/)?e2e\/playwright\.config\.(?:ts|js|mjs))(?=$|[\s;&|)])/.test(
            segment.command,
          )
        ) {
          violations.push(
            `${location ?? `${path}:${index + 1}`} invokes Playwright without the e2e working directory or explicit e2e config`,
          );
        }
        cwdState = cwdAfterSegment(
          cwdState,
          baseCwdIsE2e,
          segment.command,
          segment.separatorAfter,
          previousSeparator,
        );
        previousSeparator = segment.separatorAfter;
      }
      if (persistsCwd) {
        fileCwdState = cwdState;
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
    const automationMarkdown = extension === '.md' && isCommandSource(path);
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

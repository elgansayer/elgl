import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyProjectLintContract } from './verify-project-lint-contract.mjs';

function writeFixture(rootDir, project, lintCheck, lint = 'eslint src --fix') {
  const projectDir = path.join(rootDir, project);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ scripts: { lint, 'lint:check': lintCheck } }),
  );
}

function writeCi(rootDir, frontendCommand = 'npm run check:control-flow && npm run lint:check') {
  const workflowDir = path.join(rootDir, '.github', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, 'ci.yml'),
    `matrix:\n  include:\n    - directory: backend\n      check: lint\n      command: npm run lint:check\n    - directory: frontend\n      check: static-analysis\n      command: ${frontendCommand}\n`,
  );
}

function writeCleanLintWorkflow(rootDir, overrides = {}) {
  const workflowDir = path.join(rootDir, '.github', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });
  const projects = overrides.projects ?? '[backend, frontend]';
  const lintCommand = overrides.lintCommand ?? 'npm run lint';
  const dirtyCheck = overrides.dirtyCheck ?? 'changes="$(git status --porcelain -- "$PROJECT")"';
  const failure = overrides.failure ?? 'exit 1';
  const continueOnError = overrides.continueOnError ? '    continue-on-error: true\n' : '';

  fs.writeFileSync(
    path.join(workflowDir, 'clean-project-lint.yml'),
    `jobs:\n  clean-lint:\n${continueOnError}    strategy:\n      matrix:\n        project: ${projects}\n    steps:\n      - run: ${lintCommand}\n        working-directory: \${{ matrix.project }}\n      - env:\n          PROJECT: \${{ matrix.project }}\n        run: |\n          ${dirtyCheck}\n          if [ -n "$changes" ]; then\n            ${failure}\n          fi\n`,
  );
}

function withFixture(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elgl-lint-contract-'));
  try {
    writeFixture(rootDir, 'backend', 'eslint src');
    writeFixture(rootDir, 'frontend', 'eslint src');
    writeCi(rootDir);
    writeCleanLintWorkflow(rootDir);
    run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('accepts the repository lint contract for backend and frontend', () => {
  withFixture((rootDir) => {
    const result = verifyProjectLintContract(rootDir);
    assert.deepEqual(result.projects, ['backend', 'frontend']);
    assert.equal(result.cleanLintPath, '.github/workflows/clean-project-lint.yml');
  });
});

test('rejects a missing canonical project lint script', () => {
  withFixture((rootDir) => {
    writeFixture(rootDir, 'frontend', 'eslint src', '');
    assert.throws(
      () => verifyProjectLintContract(rootDir),
      /frontend\/package\.json must define the canonical npm run lint command/,
    );
  });
});

test('rejects a missing project lint:check script', () => {
  withFixture((rootDir) => {
    writeFixture(rootDir, 'frontend', '');
    assert.throws(
      () => verifyProjectLintContract(rootDir),
      /frontend\/package\.json must define a non-mutating lint:check script/,
    );
  });
});

test('rejects a mutating lint:check command', () => {
  withFixture((rootDir) => {
    writeFixture(rootDir, 'backend', 'eslint src --fix');
    assert.throws(
      () => verifyProjectLintContract(rootDir),
      /backend lint:check must not modify source files with --fix/,
    );
  });
});

test('rejects CI drift that stops running frontend lint:check', () => {
  withFixture((rootDir) => {
    writeCi(rootDir, 'npm run check:control-flow');
    assert.throws(
      () => verifyProjectLintContract(rootDir),
      /CI must run frontend npm run lint:check/,
    );
  });
});

test('rejects a clean lint workflow that drops one project', () => {
  withFixture((rootDir) => {
    writeCleanLintWorkflow(rootDir, { projects: '[backend]' });
    assert.throws(
      () => verifyProjectLintContract(rootDir),
      /Clean lint workflow must cover backend and frontend/,
    );
  });
});

test('rejects a clean lint workflow that does not execute npm run lint', () => {
  withFixture((rootDir) => {
    writeCleanLintWorkflow(rootDir, { lintCommand: 'npm run lint:check' });
    assert.throws(
      () => verifyProjectLintContract(rootDir),
      /Clean lint workflow must execute each project npm run lint command/,
    );
  });
});

test('rejects a clean lint workflow without a dirty-tree assertion', () => {
  withFixture((rootDir) => {
    writeCleanLintWorkflow(rootDir, { dirtyCheck: 'changes=""' });
    assert.throws(
      () => verifyProjectLintContract(rootDir),
      /Clean lint workflow must fail when npm run lint changes project files/,
    );
  });
});

test('rejects a clean lint workflow that suppresses failures', () => {
  withFixture((rootDir) => {
    writeCleanLintWorkflow(rootDir, { continueOnError: true });
    assert.throws(
      () => verifyProjectLintContract(rootDir),
      /Clean lint workflow must not suppress lint or clean-tree failures/,
    );
  });
});

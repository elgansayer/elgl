import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyProjectLintContract } from './verify-project-lint-contract.mjs';

function writeFixture(rootDir, project, lintCheck) {
  const projectDir = path.join(rootDir, project);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify({ scripts: { 'lint:check': lintCheck } }),
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

function withFixture(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elgl-lint-contract-'));
  try {
    writeFixture(rootDir, 'backend', 'eslint src');
    writeFixture(rootDir, 'frontend', 'eslint src');
    writeCi(rootDir);
    run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('accepts the repository lint contract for backend and frontend', () => {
  withFixture((rootDir) => {
    const result = verifyProjectLintContract(rootDir);
    assert.deepEqual(result.projects, ['backend', 'frontend']);
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

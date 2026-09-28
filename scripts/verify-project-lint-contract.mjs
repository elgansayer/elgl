import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_PROJECTS = ['backend', 'frontend'];
const CLEAN_LINT_WORKFLOW = path.join('.github', 'workflows', 'clean-project-lint.yml');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function verifyProjectLintContract(rootDir) {
  const ciPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
  const cleanLintPath = path.join(rootDir, CLEAN_LINT_WORKFLOW);
  const ci = fs.readFileSync(ciPath, 'utf8');
  const cleanLint = fs.readFileSync(cleanLintPath, 'utf8');

  for (const project of REQUIRED_PROJECTS) {
    const packagePath = path.join(rootDir, project, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const lint = packageJson.scripts?.lint;
    const lintCheck = packageJson.scripts?.['lint:check'];

    assert(
      typeof lint === 'string' && lint.trim().length > 0,
      `${project}/package.json must define the canonical npm run lint command`,
    );
    assert(
      typeof lintCheck === 'string' && lintCheck.trim().length > 0,
      `${project}/package.json must define a non-mutating lint:check script`,
    );
    assert(
      !/(^|\s)--fix(\s|$)/.test(lintCheck),
      `${project} lint:check must not modify source files with --fix`,
    );
  }

  assert(
    /directory:\s*backend[\s\S]*?check:\s*lint[\s\S]*?command:\s*npm run lint:check/.test(ci),
    'CI must run backend npm run lint:check',
  );
  assert(
    /directory:\s*frontend[\s\S]*?check:\s*static-analysis[\s\S]*?command:[^\n]*npm run lint:check/.test(
      ci,
    ),
    'CI must run frontend npm run lint:check as part of static analysis',
  );

  assert(
    /project:\s*\[\s*backend\s*,\s*frontend\s*\]/.test(cleanLint),
    'Clean lint workflow must cover backend and frontend',
  );
  assert(
    /run:\s*npm run lint\s*[\r\n]+\s*working-directory:\s*\$\{\{\s*matrix\.project\s*\}\}/.test(
      cleanLint,
    ),
    'Clean lint workflow must execute each project npm run lint command',
  );
  assert(
    /PROJECT:\s*\$\{\{\s*matrix\.project\s*\}\}/.test(cleanLint),
    'Clean lint workflow must scope the clean-tree assertion to the matrix project',
  );
  assert(
    /git status --porcelain -- ["']?\$PROJECT["']?/.test(cleanLint),
    'Clean lint workflow must fail when npm run lint changes project files',
  );
  assert(
    /exit 1/.test(cleanLint),
    'Clean lint workflow must return a failing status for dirty lint output',
  );
  assert(
    !/continue-on-error:\s*true/.test(cleanLint) &&
      !/npm run lint[^\n]*\|\|\s*true/.test(cleanLint) &&
      !/git status[^\n]*\|\|\s*true/.test(cleanLint),
    'Clean lint workflow must not suppress lint or clean-tree failures',
  );

  return {
    projects: REQUIRED_PROJECTS,
    ciPath: path.relative(rootDir, ciPath),
    cleanLintPath: path.relative(rootDir, cleanLintPath),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = verifyProjectLintContract(rootDir);
  console.log(
    `Lint contract verified for ${result.projects.join(', ')} via ${result.ciPath} and ${result.cleanLintPath}.`,
  );
}

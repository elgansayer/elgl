import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_PROJECTS = ['backend', 'frontend'];
const CLEAN_LINT_WORKFLOW = path.join('.github', 'workflows', 'clean-project-lint.yml');
const LINT_CHECK_COMMAND = 'npm run lint:check';

// Canonical CI must run each required project's non-mutating lint gate as a matrix entry of its own.
const CI_LINT_GATES = [
  { directory: 'backend', check: 'lint', message: 'CI must run backend npm run lint:check' },
  {
    directory: 'frontend',
    check: 'static-analysis',
    message: 'CI must run frontend npm run lint:check as part of static analysis',
  },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readScalar(raw) {
  const quoted = raw.match(/^\s*(["'])(.*?)\1(?:\s+#.*)?\s*$/);
  return quoted ? quoted[2] : raw.replace(/\s+#.*$/, '').trim();
}

// Reads block-style `- key: value` list entries without a YAML dependency, because the guard runs
// before any install. Each field is attributed to the entry that declares it, so another project's
// entry (for example admin-portal, which also runs lint:check) cannot satisfy this project's
// requirement. Flow-style or multi-line scalars are not read, which fails closed.
function readListEntries(workflow) {
  const entries = [];
  let entry;
  let fieldIndent = 0;

  for (const line of workflow.split(/\r?\n/)) {
    if (line.trim() === '' || /^\s*#/.test(line)) {
      continue;
    }

    const item = line.match(/^(\s*)-\s+([\w-]+):(.*)$/);
    if (item) {
      entry = { [item[2]]: readScalar(item[3]) };
      fieldIndent = item[1].length + 2;
      entries.push(entry);
      continue;
    }

    const indent = line.length - line.trimStart().length;
    if (indent < fieldIndent) {
      entry = undefined;
      fieldIndent = 0;
      continue;
    }

    const field = entry && indent === fieldIndent ? line.match(/^\s*([\w-]+):(.*)$/) : null;
    if (field) {
      entry[field[1]] = readScalar(field[2]);
    }
  }

  return entries;
}

// `npm run lint:check` must be a whole `&&` step, so look-alike scripts such as
// `npm run lint:check:frontend` and tolerated failures such as `|| true` do not count.
function runsLintCheck(command) {
  return command.split('&&').some((step) => step.trim() === LINT_CHECK_COMMAND);
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

  const ciEntries = readListEntries(ci);
  for (const gate of CI_LINT_GATES) {
    assert(
      ciEntries.some(
        (entry) =>
          entry.directory === gate.directory &&
          entry.check === gate.check &&
          runsLintCheck(entry.command ?? ''),
      ),
      gate.message,
    );
  }

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

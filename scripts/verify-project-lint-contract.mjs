import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_PROJECTS = ['backend', 'frontend'];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function verifyProjectLintContract(rootDir) {
  const ciPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
  const ci = fs.readFileSync(ciPath, 'utf8');

  for (const project of REQUIRED_PROJECTS) {
    const packagePath = path.join(rootDir, project, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const lintCheck = packageJson.scripts?.['lint:check'];

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

  return {
    projects: REQUIRED_PROJECTS,
    ciPath: path.relative(rootDir, ciPath),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = verifyProjectLintContract(rootDir);
  console.log(
    `Lint contract verified for ${result.projects.join(', ')} via ${result.ciPath}.`,
  );
}

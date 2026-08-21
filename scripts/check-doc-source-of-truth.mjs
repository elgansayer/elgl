import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const required = [
  'AGENTS.md',
  'SPEC.md',
  'DESIGN.md',
  'FEATURES_SPEC.md',
  'ui_architecture.md',
  'docs/factory/README.md',
  'docs/architecture/REPOSITORY_SOURCES_OF_TRUTH.md',
];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) {
    errors.push(`missing canonical documentation source: ${relative}`);
  }
}

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const forbiddenReadmePatterns = [
  /assigned to the swarm queue/i,
  /OpenCode Go, then Gemini Flash/i,
  /Gemini Flash free tier as an ordered provider chain/i,
  /old(?:er)? AI swarm/i,
];
for (const pattern of forbiddenReadmePatterns) {
  if (pattern.test(readme)) {
    errors.push(`README contains retired architecture wording: ${pattern}`);
  }
}

for (const marker of [
  'bounded OpenHands Factory',
  'Codex subscription OAuth',
  'OpenCode Go',
  'REPOSITORY_SOURCES_OF_TRUTH.md',
]) {
  if (!readme.includes(marker)) {
    errors.push(`README is missing active architecture/source marker: ${marker}`);
  }
}

const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
for (const runtime of ['test-results/', 'coverage/', '.pytest_cache/']) {
  if (!gitignore.includes(runtime)) {
    errors.push(`.gitignore must exclude runtime artifact: ${runtime}`);
  }
}

if (fs.existsSync(path.join(root, '.gitignore_patch'))) {
  errors.push('.gitignore_patch is obsolete; update .gitignore directly');
}
if (fs.existsSync(path.join(root, 'test-results/.last-run.json'))) {
  errors.push('Playwright/runtime test-results must not be committed');
}

if (errors.length) {
  console.error('Documentation/source-of-truth contract failed:\n' + errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('Repository documentation and runtime-artifact source-of-truth contract passed.');

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stylesPath = path.join(root, 'admin-portal/src/styles.scss');
const appPath = path.join(root, 'admin-portal/src/app/admin-app.component.ts');
const styles = fs.readFileSync(stylesPath, 'utf8');
const app = fs.readFileSync(appPath, 'utf8');
const adminPackage = JSON.parse(
  fs.readFileSync(path.join(root, 'admin-portal/package.json'), 'utf8'),
);
const frontendPackage = JSON.parse(
  fs.readFileSync(path.join(root, 'frontend/package.json'), 'utf8'),
);

const requiredStyleContracts = [
  '--admin-bg',
  '--admin-surface',
  '--admin-text',
  '--admin-focus',
  ':focus-visible',
  'prefers-reduced-motion: reduce',
  'forced-colors: active',
  'border-inline-end',
  "data-density='compact'",
];

const errors = [];
for (const marker of requiredStyleContracts) {
  if (!styles.includes(marker)) {
    errors.push(`admin styles are missing required contract marker: ${marker}`);
  }
}

for (const marker of ['skip-link', 'aria-label="Admin navigation"', 'routerLinkActive="active"']) {
  if (!app.includes(marker)) {
    errors.push(`admin shell is missing accessibility/navigation marker: ${marker}`);
  }
}

for (const [section, dependency] of [
  ['dependencies', '@spartan-ng/brain'],
  ['dependencies', '@angular/cdk'],
  ['devDependencies', '@spartan-ng/cli'],
  ['devDependencies', 'tailwindcss'],
  ['devDependencies', 'tw-animate-css'],
]) {
  if (!adminPackage[section]?.[dependency]) {
    errors.push(`admin portal must declare ${dependency} in ${section}`);
  }
}

if (
  adminPackage.dependencies?.['@spartan-ng/brain'] !==
  frontendPackage.dependencies?.['@spartan-ng/brain']
) {
  errors.push('admin and consumer frontend must use the same Spartan brain version range');
}
if (
  adminPackage.devDependencies?.['@spartan-ng/cli'] !==
  frontendPackage.devDependencies?.['@spartan-ng/cli']
) {
  errors.push('admin and consumer frontend must use the same Spartan CLI version range');
}

const ownershipDoc = path.join(root, 'admin-portal/src/app/ui/README.md');
if (!fs.existsSync(ownershipDoc)) {
  errors.push('admin portal is missing its repository-owned Spartan Helm ownership document');
}

const forbiddenStyles = [
  /outline\s*:\s*none/gi,
  /margin-left\s*:/gi,
  /margin-right\s*:/gi,
  /padding-left\s*:/gi,
  /padding-right\s*:/gi,
  /border-left\s*:/gi,
  /border-right\s*:/gi,
];
for (const expression of forbiddenStyles) {
  if (expression.test(styles)) {
    errors.push(`admin styles violate logical/focus contract: ${expression}`);
  }
}

const sourceRoot = path.join(root, 'admin-portal/src/app');
for (const entry of fs.readdirSync(sourceRoot, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
  const filePath = path.join(entry.parentPath ?? entry.path, entry.name);
  const relative = path.relative(root, filePath);
  if (relative.endsWith('.spec.ts')) continue;
  const source = fs.readFileSync(filePath, 'utf8');
  if (/\[(?:ngClass|ngStyle)\]/.test(source)) {
    errors.push(`${relative}: use native class/style bindings instead of ngClass/ngStyle`);
  }
  if (/@angular\/material/.test(source)) {
    errors.push(`${relative}: Angular Material must not become a parallel admin primitive system`);
  }
}

if (errors.length) {
  console.error('Admin UI contract failed:\n' + errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('Admin Spartan, semantic, accessibility, RTL and density contract passed.');

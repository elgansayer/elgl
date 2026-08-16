import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stylesPath = path.join(root, 'admin-portal/src/styles.scss');
const appPath = path.join(root, 'admin-portal/src/app/admin-app.component.ts');
const styles = fs.readFileSync(stylesPath, 'utf8');
const app = fs.readFileSync(appPath, 'utf8');

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

console.log('Admin UI semantic, accessibility, RTL and density contract passed.');

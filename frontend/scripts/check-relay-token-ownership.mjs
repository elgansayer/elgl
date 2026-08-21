import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const styles = readFileSync(resolve(root, 'src/styles.scss'), 'utf8');
const tailwind = readFileSync(resolve(root, 'tailwind.config.js'), 'utf8');

const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) {
    failures.push(`${description}: missing ${fragment}`);
  }
}

const relayVariables = [
  '--surface-50-rgb',
  '--surface-100-rgb',
  '--surface-200-rgb',
  '--surface-300-rgb',
  '--surface-400-rgb',
  '--surface-500-rgb',
  '--surface-600-rgb',
  '--surface-700-rgb',
  '--surface-800-rgb',
  '--surface-900-rgb',
  '--text-primary-rgb',
  '--text-secondary-rgb',
  '--text-muted-rgb',
  '--color-primary-rgb',
  '--color-secondary-rgb',
  '--color-danger-rgb',
  '--color-success-rgb',
  '--color-warning-rgb',
  '--color-vip-rgb',
  '--color-accent-rgb',
  '--on-fill-rgb',
  '--shadow-color-rgb',
];

for (const variable of relayVariables) {
  const occurrences = styles.split(variable).length - 1;
  if (occurrences < 2) {
    failures.push(`Relay token ${variable} must be defined for both light and dark theme ownership`);
  }
}

const tailwindMappings = [
  "surface-500-rgb",
  "color-primary-rgb",
  "color-secondary-rgb",
  "color-danger-rgb",
  "color-success-rgb",
  "color-warning-rgb",
  "color-vip-rgb",
  "color-accent-rgb",
  "on-fill-rgb",
  "text-primary-rgb",
  "text-secondary-rgb",
  "text-muted-rgb",
  "shadow-color-rgb",
];

for (const token of tailwindMappings) {
  requireFragment(tailwind, `var(--${token})`, `Tailwind Relay mapping for ${token}`);
}

const aliasStart = styles.indexOf('/* Spartan Helm theme aliases.');
const aliasEnd = styles.indexOf('@layer base {', aliasStart);
if (aliasStart === -1 || aliasEnd === -1) {
  failures.push('Spartan Helm alias block is missing');
} else {
  const aliasBlock = styles.slice(aliasStart, aliasEnd);
  const requiredAliases = new Map([
    ['--background', '--surface-500-rgb'],
    ['--foreground', '--text-primary-rgb'],
    ['--card', '--surface-200-rgb'],
    ['--card-foreground', '--text-primary-rgb'],
    ['--popover', '--surface-200-rgb'],
    ['--popover-foreground', '--text-primary-rgb'],
    ['--primary', '--color-primary-rgb'],
    ['--primary-foreground', '--on-fill-rgb'],
    ['--secondary', '--surface-100-rgb'],
    ['--secondary-foreground', '--text-primary-rgb'],
    ['--muted', '--surface-100-rgb'],
    ['--muted-foreground', '--text-secondary-rgb'],
    ['--accent', '--color-accent-rgb'],
    ['--accent-foreground', '--on-fill-rgb'],
    ['--destructive', '--color-danger-rgb'],
    ['--border', '--surface-100-rgb'],
    ['--input', '--surface-100-rgb'],
    ['--ring', '--color-primary-rgb'],
  ]);

  for (const [alias, relayToken] of requiredAliases) {
    const pattern = new RegExp(`${alias.replaceAll('-', '\\-')}\\s*:\\s*rgb\\(var\\(${relayToken.replaceAll('-', '\\-')}\\)\\)`);
    if (!pattern.test(aliasBlock)) {
      failures.push(`Spartan alias ${alias} must resolve directly to Relay token ${relayToken}`);
    }
  }

  const colourDeclarations = aliasBlock.match(/--[a-z-]+\s*:\s*([^;]+);/g) ?? [];
  for (const declaration of colourDeclarations) {
    if (declaration.startsWith('--radius')) continue;
    if (/#[0-9a-f]{3,8}\b|\boklch\(|\bhsl\(|\brgb\(\s*\d/i.test(declaration)) {
      failures.push(`Spartan semantic aliases must not introduce literal colours: ${declaration.trim()}`);
    }
  }
}

requireFragment(styles, "--primary: rgb(var(--color-primary-rgb));", 'Dynamic primary alias');
requireFragment(styles, "--primary-foreground: rgb(var(--on-fill-rgb));", 'On-fill foreground alias');
requireFragment(tailwind, "primary: {", 'Tailwind primary token');
requireFragment(tailwind, "DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)'", 'Tailwind dynamic primary mapping');

if (failures.length > 0) {
  console.error('Relay token ownership check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Relay token ownership check passed. Spartan semantic aliases remain owned by Relay tokens.');

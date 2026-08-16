import { readFileSync, resolve } from 'node:fs';

const root = resolve(import.meta.dirname, '..');
const service = readFileSync(resolve(root, 'src/app/services/theme.service.ts'), 'utf8');
const styles = readFileSync(resolve(root, 'src/styles.scss'), 'utf8');
const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

requireFragment(service, '/^#[0-9a-fA-F]{6}$/', 'Six-digit primary accent validation');
requireFragment(service, "localStorage.removeItem('app_primary_accent_color')", 'Accent persistence clearing');
requireFragment(service, 'clearPrimaryAccentColor(): void', 'Explicit accent reset API');
requireFragment(service, 'this.clearPrimaryAccentColor();', 'Profile fallback clears prior user accent');
requireFragment(service, "root.style.setProperty('--color-primary-rgb'", 'Runtime Relay RGB override');
requireFragment(service, "root.style.removeProperty('--color-primary-rgb')", 'Runtime Relay RGB reset');
requireFragment(styles, '--primary: rgb(var(--color-primary-rgb))', 'Spartan primary alias consumes Relay primary');
requireFragment(styles, '--primary-foreground: rgb(var(--on-fill-rgb))', 'Dynamic primary uses theme-aware foreground');

if (failures.length > 0) {
  console.error('Primary accent check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Primary accent check passed. Per-user primary overrides are validated, resettable and Relay-owned.');

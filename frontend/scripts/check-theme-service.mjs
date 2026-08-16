import { readFileSync, resolve } from 'node:fs';

const root = resolve(import.meta.dirname, '..');
const service = readFileSync(resolve(root, 'src/app/services/theme.service.ts'), 'utf8');
const styles = readFileSync(resolve(root, 'src/styles.scss'), 'utf8');
const failures = [];

function requireFragment(source, fragment, description) {
  if (!source.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

requireFragment(service, "export type Theme = 'light' | 'dark' | 'system'", 'Theme public API');
requireFragment(service, "localStorage.getItem('app_theme')", 'Theme persistence read');
requireFragment(service, "localStorage.setItem('app_theme', theme)", 'Theme persistence write');
requireFragment(service, "matchMedia('(prefers-color-scheme: dark)')", 'System theme resolution');
requireFragment(service, "documentElement.classList.toggle('dark', isDark)", 'Root dark class ownership');
requireFragment(styles, '@layer base {\n  :root {', 'Relay light token block');
requireFragment(styles, '  .dark {', 'Relay dark token block');

if (failures.length > 0) {
  console.error('Theme service check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Theme service check passed. Theme preference and resolved DOM state remain centrally owned.');

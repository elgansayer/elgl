#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const styles = readFileSync(resolve(root, 'frontend/src/styles.scss'), 'utf8');
const required = [
  [/:focus-visible\s*\{[\s\S]*?ring-2[\s\S]*?ring-primary[\s\S]*?ring-offset-2[\s\S]*?ring-offset-surface-500[\s\S]*?\}/m, 'global :focus-visible must use the canonical Relay 2px primary ring and 2px surface offset'],
  [/:focus:not\(:focus-visible\)\s*\{[\s\S]*?ring-0[\s\S]*?ring-offset-0[\s\S]*?\}/m, 'pointer focus must clear the synthetic keyboard ring'],
  [/--ring:\s*rgb\(var\(--color-primary-rgb\)\);/, 'Spartan --ring must alias Relay primary'],
  [/--sidebar-ring:\s*rgb\(var\(--color-primary-rgb\)\);/, 'Spartan --sidebar-ring must alias Relay primary']
];
const failures = required.filter(([pattern]) => !pattern.test(styles)).map(([, message]) => message);
if (failures.length) { console.error('Focus ring contract verification failed:'); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log('Focus ring contract verified.');

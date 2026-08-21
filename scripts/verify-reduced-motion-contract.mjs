#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const styles = readFileSync(resolve(root, 'frontend/src/reduced-motion.scss'), 'utf8');
const angular = readFileSync(resolve(root, 'frontend/angular.json'), 'utf8');
const required = [
  [/@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'missing prefers-reduced-motion: reduce boundary'],
  [/animation-duration:\s*0\.01ms\s*!important/, 'reduced-motion boundary must collapse animation duration'],
  [/animation-iteration-count:\s*1\s*!important/, 'reduced-motion boundary must stop repeating animations'],
  [/transition-duration:\s*0\.01ms\s*!important/, 'reduced-motion boundary must collapse transition duration'],
  [/scroll-behavior:\s*auto\s*!important/, 'reduced-motion boundary must disable smooth scrolling']
];
const failures = required.filter(([pattern]) => !pattern.test(styles)).map(([, message]) => message);
if (!angular.includes('src/reduced-motion.scss')) failures.push('Angular build must register src/reduced-motion.scss as a global stylesheet');
if (failures.length) { console.error('Reduced motion contract verification failed:'); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log('Reduced motion contract verified.');

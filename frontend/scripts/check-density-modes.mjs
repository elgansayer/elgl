import { readFileSync, resolve } from 'node:fs';

const root = resolve(import.meta.dirname, '..');
const button = readFileSync(resolve(root, 'src/app/components/primitives/button-primary/button-primary.component.ts'), 'utf8');
const failures = [];

function requireFragment(fragment, description) {
  if (!button.includes(fragment)) failures.push(`${description}: missing ${fragment}`);
}

requireFragment("input<'sm' | 'md' | 'lg'>('md')", 'Stable compact/standard/comfortable API');
requireFragment("case 'sm':\n        sizeClass = 'min-h-10", 'Compact 40px target floor');
requireFragment("case 'md':\n        sizeClass = 'min-h-11", 'Standard 44px target floor');
requireFragment("case 'lg':\n        sizeClass = 'min-h-12", 'Comfortable 48px target floor');

if (/\b(?:h|min-h|max-h)-\[[^\]]+\]/.test(button)) {
  failures.push('Primary button density must not use arbitrary height utilities');
}
if (/height\s*:/i.test(button)) {
  failures.push('Primary button density must not hardcode CSS height');
}

if (failures.length > 0) {
  console.error('Density mode check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Density mode check passed. Compact, standard and comfortable control targets remain accessible.');

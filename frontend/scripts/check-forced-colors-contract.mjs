import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = resolve(here, '../src/forced-colors.scss');
const angularPath = resolve(here, '../angular.json');
const source = readFileSync(contractPath, 'utf8');
const angular = readFileSync(angularPath, 'utf8');

const requiredSnippets = [
  '@media (forced-colors: active)',
  'background: Canvas;',
  'color: CanvasText;',
  'color: LinkText;',
  'outline: 2px solid Highlight !important;',
  'border-color: ButtonText;',
  'border-color: GrayText;',
  'background: ButtonFace;',
  "[aria-selected='true']",
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
if (missing.length > 0) {
  console.error('Forced-colours contract check failed. Missing required system-colour behaviour:');
  for (const snippet of missing) console.error(`- ${snippet}`);
  process.exit(1);
}

if (!angular.includes('src/forced-colors.scss')) {
  console.error('Forced-colours contract check failed: global stylesheet is not loaded by Angular.');
  process.exit(1);
}

if (/forced-color-adjust\s*:\s*none/i.test(source)) {
  console.error(
    'Forced-colours contract check failed: forced-color-adjust:none requires an explicit audited exception.',
  );
  process.exit(1);
}

console.log('Forced-colours contract check passed.');

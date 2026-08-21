import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'config/critical-product-contracts.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];

function source(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    errors.push(`missing contract path: ${relative}`);
    return '';
  }
  if (fs.statSync(absolute).isDirectory()) return '';
  return fs.readFileSync(absolute, 'utf8');
}

for (const contract of manifest.adminApi ?? []) {
  const client = source(contract.client);
  const server = source(contract.server);
  if (client && !client.includes(contract.clientMarker)) {
    errors.push(`${contract.name}: client marker ${contract.clientMarker} is missing from ${contract.client}`);
  }
  for (const marker of contract.serverMarkers ?? []) {
    if (server && !server.includes(marker)) {
      errors.push(`${contract.name}: server marker ${marker} is missing from ${contract.server}`);
    }
  }
}

for (const journey of manifest.criticalJourneys ?? []) {
  for (const anchor of journey.anchors ?? []) {
    const absolute = path.join(root, anchor);
    if (!fs.existsSync(absolute)) {
      errors.push(`${journey.name}: critical journey anchor is missing: ${anchor}`);
    }
  }
}

const backendPackage = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8'));
if (!backendPackage.scripts?.['test:e2e']) {
  errors.push('backend/package.json must expose test:e2e for product contract regression coverage');
}
const frontendPackage = JSON.parse(fs.readFileSync(path.join(root, 'frontend/package.json'), 'utf8'));
if (!frontendPackage.scripts?.['e2e:ci']) {
  errors.push('frontend/package.json must expose e2e:ci for browser product smoke coverage');
}

if (errors.length) {
  console.error('Critical product contracts failed:\n' + errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(
  `Critical product contracts passed: ${manifest.adminApi.length} cross-app API contracts and ${manifest.criticalJourneys.length} journey anchors.`,
);

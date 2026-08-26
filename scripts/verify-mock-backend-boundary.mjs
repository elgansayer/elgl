import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const ENABLED_MODE_PATTERN = /MOCK_BACKEND_MODE\s*[:=]\s*['"]?(?:local|test|demo)\b/i;
const ENABLED_CLIENT_PATTERN = /mockBackendMode\s*[:=]\s*['"](?:local|test|demo)['"]/i;
const TEXT_EXTENSIONS = new Set(['.yml', '.yaml', '.json', '.env', '.sh', '.ts', '.js', '.mjs']);

function extension(path) {
  const index = path.lastIndexOf('.');
  return index >= 0 ? path.slice(index) : '';
}

function walk(root, directory = root) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (['.git', 'node_modules', 'dist', 'coverage'].includes(entry)) continue;
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) files.push(...walk(root, absolute));
    else files.push(relative(root, absolute).replaceAll('\\', '/'));
  }
  return files;
}

function isProductionArtifact(path) {
  const lower = path.toLowerCase();
  return (
    lower.startsWith('.github/workflows/') ||
    lower.includes('dockerfile') ||
    lower.includes('docker-compose') ||
    lower.startsWith('deploy/') ||
    lower.startsWith('infra/') ||
    lower.includes('.production') ||
    lower.includes('.prod.')
  );
}

function isTextArtifact(path) {
  const lower = path.toLowerCase();
  return (
    TEXT_EXTENSIONS.has(extension(path)) ||
    lower.includes('dockerfile') ||
    lower.includes('.env')
  );
}

export function verifyMockBackendBoundary(root) {
  const failures = [];
  const required = [
    ['backend/src/config/environment.validation.ts', 'assertMockBackendActivationBoundary'],
    ['backend/src/config/mock-backend-mode.ts', "'disabled', 'local', 'test', 'demo'"],
    ['backend/src/mock-data.ts', 'const fixturesEnabled = isMockBackendEnabled()'],
    ['backend/test/setup.ts', "process.env.MOCK_BACKEND_MODE = 'test'"],
    ['frontend/src/app/core/config/configuration.service.ts', 'MOCK_CLIENT_ENVIRONMENTS'],
    ['frontend/public/assets/config.json', '"mockBackendMode": "disabled"'],
    [
      'frontend/src/app/components/primitives/no-network-banner/no-network-banner.component.ts',
      'data-testid="mock-backend-indicator"',
    ],
  ];

  for (const [path, marker] of required) {
    let source;
    try {
      source = readFileSync(join(root, path), 'utf8');
    } catch {
      failures.push(`missing required mock-boundary file: ${path}`);
      continue;
    }
    if (!source.includes(marker)) failures.push(`${path} is missing boundary marker: ${marker}`);
  }

  for (const path of walk(root)) {
    if (!isProductionArtifact(path) || !isTextArtifact(path)) continue;
    const source = readFileSync(join(root, path), 'utf8');
    if (ENABLED_MODE_PATTERN.test(source)) {
      failures.push(`${path} enables MOCK_BACKEND_MODE in a production artifact`);
    }
    if (path.startsWith('frontend/') && ENABLED_CLIENT_PATTERN.test(source)) {
      failures.push(`${path} enables client mock fixtures in a production artifact`);
    }
  }

  return failures;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const failures = verifyMockBackendBoundary(root);
  if (failures.length > 0) {
    console.error('Mock backend production-boundary verification failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('Mock backend production boundary verified.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();

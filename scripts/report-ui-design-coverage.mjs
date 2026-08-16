#!/usr/bin/env node

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const frontend = resolve(root, 'frontend/src/app');
const components = resolve(frontend, 'components');
const ui = resolve(components, 'ui');
const primitives = resolve(components, 'primitives');
const preview = resolve(root, 'frontend/design-preview');
const manifest = JSON.parse(readFileSync(resolve(root, 'design-sync.manifest.json'), 'utf8'));

function dirs(path) {
  return readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function files(path) {
  const result = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) result.push(...files(full));
    else result.push(full);
  }
  return result;
}

const componentDirs = dirs(components);
const uiDirs = dirs(ui);
const primitiveDirs = dirs(primitives);
const modalDirs = componentDirs.filter((name) => /modal|dialog|sheet|drawer|popover|menu/i.test(name));
const previewFiles = files(preview).filter((path) => extname(path) === '.html');
const routeFiles = files(frontend).filter((path) => /(?:^|\.)routes?\.ts$/.test(basename(path)) || basename(path) === 'app.routes.ts');

let declaredRoutes = 0;
for (const path of routeFiles) {
  const source = readFileSync(path, 'utf8');
  declaredRoutes += [...source.matchAll(/\bpath\s*:\s*['"`]/g)].length;
}

const mappedRepositoryPaths = new Set(manifest.items.flatMap((item) => item.repositoryPaths));
const mappedPreviewPaths = new Set(manifest.items.flatMap((item) => item.previewPaths));
const previewRelative = previewFiles.map((path) => relative(root, path).replaceAll('\\', '/'));
const unmappedPreviewPaths = previewRelative.filter((path) => !mappedPreviewPaths.has(path));

const report = {
  generatedAt: new Date().toISOString(),
  manifestSchemaVersion: manifest.schemaVersion,
  counts: {
    declaredRoutes,
    routeFiles: routeFiles.length,
    componentDirectories: componentDirs.length,
    modalLikeComponentDirectories: modalDirs.length,
    spartanHelmDirectories: uiDirs.length,
    relayPrimitiveDirectories: primitiveDirs.length,
    previewHtmlFiles: previewFiles.length,
    designSyncItems: manifest.items.length,
    mappedRepositoryPaths: mappedRepositoryPaths.size,
    mappedPreviewPaths: mappedPreviewPaths.size,
    unmappedPreviewPaths: unmappedPreviewPaths.length
  },
  modalLikeComponentDirectories: modalDirs,
  spartanHelmDirectories: uiDirs,
  relayPrimitiveDirectories: primitiveDirs,
  routeFiles: routeFiles.map((path) => relative(root, path).replaceAll('\\', '/')),
  unmappedPreviewPaths
};

const markdown = `# UI design coverage report\n\nGenerated: ${report.generatedAt}\n\n| Metric | Count |\n| --- | ---: |\n${Object.entries(report.counts).map(([key, value]) => `| ${key} | ${value} |`).join('\n')}\n\n## Modal-like component directories\n\n${modalDirs.map((name) => `- \`${name}\``).join('\n') || '- None'}\n\n## Spartan Helm directories\n\n${uiDirs.map((name) => `- \`${name}\``).join('\n') || '- None'}\n\n## Relay primitive directories\n\n${primitiveDirs.map((name) => `- \`${name}\``).join('\n') || '- None'}\n\n## Unmapped design-preview files\n\n${unmappedPreviewPaths.map((path) => `- \`${path}\``).join('\n') || '- None'}\n`;

if (process.argv.includes('--write')) {
  const reports = resolve(root, 'reports');
  mkdirSync(reports, { recursive: true });
  writeFileSync(join(reports, 'ui-design-coverage.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(reports, 'ui-design-coverage.md'), markdown);
  console.log('Wrote reports/ui-design-coverage.json and reports/ui-design-coverage.md');
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(markdown);
}

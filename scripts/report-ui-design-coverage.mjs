#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const appRoot = resolve(root, 'frontend/src/app');
const componentsRoot = resolve(appRoot, 'components');
const pagesRoot = resolve(appRoot, 'pages');
const helmRoot = resolve(componentsRoot, 'ui');
const legacyPrimitivesRoot = resolve(componentsRoot, 'primitives');
const previewRoot = resolve(root, 'frontend/design-preview');
const manifest = JSON.parse(readFileSync(resolve(root, 'design-sync.manifest.json'), 'utf8'));

function toRepoPath(path) {
  return relative(root, path).replaceAll('\\', '/');
}

function directories(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function files(path) {
  if (!existsSync(path)) return [];
  const result = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) result.push(...files(full));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}

function specificMappingsFor(repositoryPath) {
  return manifest.items.filter((item) =>
    item.repositoryPaths.some(
      (mappedPath) => mappedPath === repositoryPath || mappedPath.startsWith(`${repositoryPath}/`),
    ),
  );
}

function inheritedMappingsFor(repositoryPath) {
  return manifest.items.filter((item) =>
    item.repositoryPaths.some(
      (mappedPath) => repositoryPath.startsWith(`${mappedPath}/`) && mappedPath !== repositoryPath,
    ),
  );
}

function analyseSurface(repositoryPath, kind) {
  const absolute = resolve(root, repositoryPath);
  const surfaceFiles = files(absolute);
  const sourceText = surfaceFiles
    .filter((path) => ['.ts', '.html', '.scss', '.css'].includes(extname(path)))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
  const mappings = specificMappingsFor(repositoryPath);
  const inheritedMappings = inheritedMappingsFor(repositoryPath);

  return {
    name: basename(repositoryPath),
    kind,
    repositoryPath,
    implemented: surfaceFiles.some((path) => /\.component\.ts$/.test(path)),
    testFiles: surfaceFiles.filter((path) => /\.spec\.ts$/.test(path)).map(toRepoPath),
    hasTests: surfaceFiles.some((path) => /\.spec\.ts$/.test(path)),
    usesSpartanHelm: sourceText.includes('@spartan-ng/helm'),
    directBrainImports: [...sourceText.matchAll(/@spartan-ng\/brain/g)].length,
    legacyPrimitiveMentions: [
      'app-card',
      'app-button-primary',
      'app-button-secondary',
      'app-input',
      'app-textarea',
      'app-chip',
      'app-pill',
      'app-empty-state',
    ].reduce((count, selector) => count + sourceText.split(selector).length - 1, 0),
    designSyncIds: mappings.map((item) => item.id),
    inheritedDesignSyncIds: inheritedMappings.map((item) => item.id),
    ownerLayers: [...new Set(mappings.map((item) => item.ownerLayer))],
    previewPaths: [...new Set(mappings.flatMap((item) => item.previewPaths))],
    previewCovered: mappings.some((item) => item.previewPaths.length > 0),
    claudeDesignMapped: mappings.some((item) => Boolean(item.claudeDesignPath)),
  };
}

const componentSurfaces = directories(componentsRoot)
  .filter((name) => name !== 'ui' && name !== 'primitives')
  .map((name) => analyseSurface(`frontend/src/app/components/${name}`, 'component'));
const pageSurfaces = directories(pagesRoot).map((name) => analyseSurface(`frontend/src/app/pages/${name}`, 'page'));
const surfaces = [...componentSurfaces, ...pageSurfaces].sort((a, b) => a.repositoryPath.localeCompare(b.repositoryPath));

const helmComponents = directories(helmRoot).map((name) => {
  const repositoryPath = `frontend/src/app/components/ui/${name}`;
  const mappings = specificMappingsFor(repositoryPath);
  const inheritedMappings = inheritedMappingsFor(repositoryPath);
  const componentFiles = files(resolve(root, repositoryPath));
  return {
    name,
    repositoryPath,
    owner: 'spartan-helm',
    testFiles: componentFiles.filter((path) => /\.spec\.ts$/.test(path)).map(toRepoPath),
    hasTests: componentFiles.some((path) => /\.spec\.ts$/.test(path)),
    designSyncIds: mappings.map((item) => item.id),
    inheritedDesignSyncIds: inheritedMappings.map((item) => item.id),
    previewPaths: [...new Set(mappings.flatMap((item) => item.previewPaths))],
    claudeDesignMapped: mappings.some((item) => Boolean(item.claudeDesignPath)),
  };
});

const legacyPrimitives = directories(legacyPrimitivesRoot).map((name) =>
  analyseSurface(`frontend/src/app/components/primitives/${name}`, 'legacy-primitive'),
);

const routeFiles = files(appRoot).filter((path) => /(?:^|\.)routes?\.ts$/.test(basename(path)) || basename(path) === 'app.routes.ts');
const routes = [];
for (const routeFile of routeFiles) {
  const repositoryPath = toRepoPath(routeFile);
  const source = readFileSync(routeFile, 'utf8');
  for (const match of source.matchAll(/\bpath\s*:\s*['"`]([^'"`]*)['"`]/g)) {
    routes.push({
      path: match[1],
      sourceFile: repositoryPath,
      designSyncIds: specificMappingsFor(repositoryPath).map((item) => item.id),
      inheritedDesignSyncIds: inheritedMappingsFor(repositoryPath).map((item) => item.id),
    });
  }
}

const modalLikeSurfaces = surfaces.filter((surface) => /modal|dialog|sheet|drawer|popover|menu/i.test(surface.name));
const previewFiles = files(previewRoot).filter((path) => extname(path) === '.html').map(toRepoPath).sort();
const mappedPreviewPaths = new Set(manifest.items.flatMap((item) => item.previewPaths));
const unmappedPreviewPaths = previewFiles.filter((path) => !mappedPreviewPaths.has(path));
const missingManifestRepositoryPaths = manifest.items.flatMap((item) =>
  item.repositoryPaths.filter((path) => !existsSync(resolve(root, path))).map((path) => ({ designSyncId: item.id, path })),
);
const missingManifestPreviewPaths = manifest.items.flatMap((item) =>
  item.previewPaths.filter((path) => !existsSync(resolve(root, path))).map((path) => ({ designSyncId: item.id, path })),
);
const unmappedRuntimeSurfaces = surfaces.filter((surface) => surface.designSyncIds.length === 0);
const broadOnlyRuntimeSurfaces = surfaces.filter(
  (surface) => surface.designSyncIds.length === 0 && surface.inheritedDesignSyncIds.length > 0,
);
const untestedRuntimeSurfaces = surfaces.filter((surface) => !surface.hasTests);
const directBrainRuntimeSurfaces = surfaces.filter((surface) => surface.directBrainImports > 0);
const legacyDebtSurfaces = surfaces.filter((surface) => surface.legacyPrimitiveMentions > 0);

const mappedSurfaceCount = surfaces.length - unmappedRuntimeSurfaces.length;
const testedSurfaceCount = surfaces.length - untestedRuntimeSurfaces.length;
const previewCoveredSurfaceCount = surfaces.filter((surface) => surface.previewCovered).length;
const claudeMappedSurfaceCount = surfaces.filter((surface) => surface.claudeDesignMapped).length;
const percentage = (count, total) => (total === 0 ? 100 : Number(((count / total) * 100).toFixed(1)));

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  manifestSchemaVersion: manifest.schemaVersion,
  counts: {
    routes: routes.length,
    routeFiles: routeFiles.length,
    runtimeSurfaces: surfaces.length,
    componentSurfaces: componentSurfaces.length,
    pageSurfaces: pageSurfaces.length,
    modalLikeSurfaces: modalLikeSurfaces.length,
    spartanHelmComponents: helmComponents.length,
    legacyPrimitiveComponents: legacyPrimitives.length,
    designSyncItems: manifest.items.length,
    previewHtmlFiles: previewFiles.length,
    specificallyMappedRuntimeSurfaces: mappedSurfaceCount,
    unmappedRuntimeSurfaces: unmappedRuntimeSurfaces.length,
    broadOnlyRuntimeSurfaces: broadOnlyRuntimeSurfaces.length,
    untestedRuntimeSurfaces: untestedRuntimeSurfaces.length,
    directBrainRuntimeSurfaces: directBrainRuntimeSurfaces.length,
    legacyDebtSurfaces: legacyDebtSurfaces.length,
    unmappedPreviewPaths: unmappedPreviewPaths.length,
    missingManifestRepositoryPaths: missingManifestRepositoryPaths.length,
    missingManifestPreviewPaths: missingManifestPreviewPaths.length,
  },
  completion: {
    specificallyDesignSyncMappedPercent: percentage(mappedSurfaceCount, surfaces.length),
    testsPresentPercent: percentage(testedSurfaceCount, surfaces.length),
    specificallyPreviewCoveredPercent: percentage(previewCoveredSurfaceCount, surfaces.length),
    specificallyClaudeDesignMappedPercent: percentage(claudeMappedSurfaceCount, surfaces.length),
  },
  routes,
  runtimeSurfaces: surfaces,
  modalLikeSurfaces,
  spartanHelmComponents: helmComponents,
  legacyPrimitives,
  findings: {
    unmappedRuntimeSurfaces: unmappedRuntimeSurfaces.map((surface) => surface.repositoryPath),
    broadOnlyRuntimeSurfaces: broadOnlyRuntimeSurfaces.map((surface) => ({
      path: surface.repositoryPath,
      inheritedDesignSyncIds: surface.inheritedDesignSyncIds,
    })),
    untestedRuntimeSurfaces: untestedRuntimeSurfaces.map((surface) => surface.repositoryPath),
    directBrainRuntimeSurfaces: directBrainRuntimeSurfaces.map((surface) => surface.repositoryPath),
    legacyDebtSurfaces: legacyDebtSurfaces.map((surface) => ({
      path: surface.repositoryPath,
      mentions: surface.legacyPrimitiveMentions,
    })),
    unmappedPreviewPaths,
    missingManifestRepositoryPaths,
    missingManifestPreviewPaths,
  },
};

function tableRows(values) {
  return Object.entries(values).map(([key, value]) => `| ${key} | ${value} |`).join('\n');
}

function list(values) {
  return values.length ? values.map((value) => `- \`${typeof value === 'string' ? value : JSON.stringify(value)}\``).join('\n') : '- None';
}

const markdown = `# UI design coverage report\n\nGenerated: ${report.generatedAt}\n\nSpecific coverage means the manifest names the surface (or a child path) rather than inheriting only a broad ancestor mapping such as \`frontend/src/app\`.\n\n## Counts\n\n| Metric | Count |\n| --- | ---: |\n${tableRows(report.counts)}\n\n## Completion\n\n| Metric | Percent |\n| --- | ---: |\n${tableRows(report.completion)}\n\n## Unmapped runtime surfaces\n\n${list(report.findings.unmappedRuntimeSurfaces)}\n\n## Broad-only inherited mappings\n\n${list(report.findings.broadOnlyRuntimeSurfaces)}\n\n## Runtime surfaces without colocated tests\n\n${list(report.findings.untestedRuntimeSurfaces)}\n\n## Direct Brain usage outside owned Helm\n\n${list(report.findings.directBrainRuntimeSurfaces)}\n\n## Legacy primitive debt surfaces\n\n${list(report.findings.legacyDebtSurfaces)}\n\n## Unmapped design-preview files\n\n${list(report.findings.unmappedPreviewPaths)}\n\n## Invalid manifest paths\n\n### Repository\n${list(report.findings.missingManifestRepositoryPaths)}\n\n### Preview\n${list(report.findings.missingManifestPreviewPaths)}\n`;

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

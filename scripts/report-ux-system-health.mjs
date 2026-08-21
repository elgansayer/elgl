#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const frontendRoot = resolve(root, 'frontend');
const appRoot = resolve(frontendRoot, 'src/app');
const uiRoot = resolve(appRoot, 'components/ui');
const primitiveRoot = resolve(appRoot, 'components/primitives');
const manifest = JSON.parse(readFileSync(resolve(root, 'design-sync.manifest.json'), 'utf8'));
const frontendPackage = JSON.parse(readFileSync(resolve(frontendRoot, 'package.json'), 'utf8'));
const componentsConfig = JSON.parse(readFileSync(resolve(frontendRoot, 'components.json'), 'utf8'));

function walk(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function repoPath(path) {
  return relative(root, path).replaceAll('\\', '/');
}

function percentage(value, total) {
  return total === 0 ? 100 : Number(((value / total) * 100).toFixed(1));
}

const applicationSource = walk(appRoot).filter(
  (path) => ['.ts', '.html', '.scss', '.css'].includes(extname(path)) && !/\.spec\.ts$/.test(path),
);
const nonHelmSource = applicationSource.filter((path) => !path.startsWith(`${uiRoot}/`));
const directBrainFiles = nonHelmSource.filter((path) => readFileSync(path, 'utf8').includes('@spartan-ng/brain'));
const helmComponents = existsSync(uiRoot)
  ? readdirSync(uiRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : [];
const relayPrimitives = existsSync(primitiveRoot)
  ? readdirSync(primitiveRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : [];
const reconciledItems = manifest.items.filter((item) => typeof item.lastReconciledCommit === 'string');
const pendingReconciliation = manifest.items.filter((item) => item.lastReconciledCommit === null);
const previewPaths = manifest.items.flatMap((item) => item.previewPaths ?? []);
const existingPreviewPaths = previewPaths.filter((path) => existsSync(resolve(root, path)));
const requiredGovernanceFiles = [
  'DESIGN.md',
  '.claude/CLAUDE.md',
  '.claude/skills/spartan/SKILL.md',
  'frontend/AGENTS.md',
  'frontend/components.json',
  'docs/spartan-relay-architecture.md',
  'docs/claude-design-two-way-sync.md',
  'design-sync.manifest.json',
];
const missingGovernanceFiles = requiredGovernanceFiles.filter((path) => !existsSync(resolve(root, path)));

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  stack: {
    angular: frontendPackage.dependencies?.['@angular/core'] ?? null,
    tailwind: frontendPackage.devDependencies?.tailwindcss ?? null,
    spartanBrain: frontendPackage.dependencies?.['@spartan-ng/brain'] ?? null,
    spartanCli: frontendPackage.devDependencies?.['@spartan-ng/cli'] ?? null,
    helmImportAlias: componentsConfig.importAlias ?? null,
    helmStyle: componentsConfig.style ?? null,
  },
  counts: {
    applicationSourceFiles: applicationSource.length,
    nonHelmApplicationSourceFiles: nonHelmSource.length,
    helmComponents: helmComponents.length,
    relayPrimitives: relayPrimitives.length,
    directBrainFilesOutsideHelm: directBrainFiles.length,
    designSyncItems: manifest.items.length,
    designSyncItemsReconciled: reconciledItems.length,
    designSyncItemsPendingReconciliation: pendingReconciliation.length,
    mappedPreviewPaths: previewPaths.length,
    existingMappedPreviewPaths: existingPreviewPaths.length,
    missingGovernanceFiles: missingGovernanceFiles.length,
  },
  completion: {
    designSyncReconciliationPercent: percentage(reconciledItems.length, manifest.items.length),
    mappedPreviewPresencePercent: percentage(existingPreviewPaths.length, previewPaths.length),
    brainOwnershipPercent: percentage(nonHelmSource.length - directBrainFiles.length, nonHelmSource.length),
  },
  findings: {
    directBrainFilesOutsideHelm: directBrainFiles.map(repoPath),
    pendingReconciliationIds: pendingReconciliation.map((item) => item.id),
    missingPreviewPaths: previewPaths.filter((path) => !existsSync(resolve(root, path))),
    missingGovernanceFiles,
  },
  inventory: { helmComponents, relayPrimitives },
};

const lines = [
  '# UX, Spartan and Claude Design health report',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '## Stack',
  '',
  '| Capability | Version / configuration |',
  '| --- | --- |',
  `| Angular | ${report.stack.angular ?? 'missing'} |`,
  `| Tailwind | ${report.stack.tailwind ?? 'missing'} |`,
  `| Spartan Brain | ${report.stack.spartanBrain ?? 'missing'} |`,
  `| Spartan CLI | ${report.stack.spartanCli ?? 'missing'} |`,
  `| Helm import alias | ${report.stack.helmImportAlias ?? 'missing'} |`,
  `| Helm style | ${report.stack.helmStyle ?? 'missing'} |`,
  '',
  '## Completion',
  '',
  '| Metric | Value |',
  '| --- | ---: |',
  `| Claude Design reconciliation provenance | ${report.completion.designSyncReconciliationPercent}% |`,
  `| Mapped preview files present | ${report.completion.mappedPreviewPresencePercent}% |`,
  `| Spartan Brain ownership outside Helm | ${report.completion.brainOwnershipPercent}% |`,
  '',
  '## Counts',
  '',
  '| Metric | Count |',
  '| --- | ---: |',
  ...Object.entries(report.counts).map(([key, value]) => `| ${key} | ${value} |`),
  '',
  '## Pending Claude Design reconciliation',
  '',
  ...(report.findings.pendingReconciliationIds.length
    ? report.findings.pendingReconciliationIds.map((id) => `- \`${id}\``)
    : ['- None']),
  '',
  '## Direct Spartan Brain imports outside owned Helm',
  '',
  ...(report.findings.directBrainFilesOutsideHelm.length
    ? report.findings.directBrainFilesOutsideHelm.map((path) => `- \`${path}\``)
    : ['- None']),
  '',
  '## Missing mapped previews',
  '',
  ...(report.findings.missingPreviewPaths.length
    ? report.findings.missingPreviewPaths.map((path) => `- \`${path}\``)
    : ['- None']),
  '',
  '## Missing governance files',
  '',
  ...(report.findings.missingGovernanceFiles.length
    ? report.findings.missingGovernanceFiles.map((path) => `- \`${path}\``)
    : ['- None']),
  '',
];

const markdown = `${lines.join('\n')}\n`;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else if (process.argv.includes('--write')) {
  const reports = resolve(root, 'reports');
  mkdirSync(reports, { recursive: true });
  writeFileSync(resolve(reports, 'ux-system-health.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(reports, 'ux-system-health.md'), markdown);
  console.log('Wrote reports/ux-system-health.json and reports/ux-system-health.md');
} else {
  console.log(markdown);
}

#!/usr/bin/env node
// Deterministic Relay design audit over tokens and design previews.
//
//   node scripts/design-sync/audit-design.mjs            report to stdout
//   node scripts/design-sync/audit-design.mjs --write    also write reports/design-audit.{json,md}
//   node scripts/design-sync/audit-design.mjs --strict   exit 1 on any error-severity finding
//
// Findings are stable (rule + file + detail) so the weekly job can file de-duplicated issues.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  contrast,
  loadManifest,
  previewFiles,
  previewTokens,
  relayTokens,
  root,
  sha256,
  specimenPaths,
} from './lib.mjs';

const findings = [];
const add = (severity, rule, file, detail) =>
  findings.push({
    id: sha256(`${rule}|${file}|${detail}`).slice(0, 12),
    severity,
    rule,
    file,
    detail,
  });

// 1. Token contrast (WCAG 2.1 AA, 4.5:1 for body text) in both themes, from the runtime source.
const tokens = relayTokens();
const textPairs = [
  ['text-primary', 'surface-500'],
  ['text-secondary', 'surface-500'],
  ['text-muted', 'surface-500'],
  ['text-primary', 'surface-300'],
  ['text-secondary', 'surface-300'],
  ['text-muted', 'surface-300'],
  ['text-muted', 'surface-200'],
  ['primary-text', 'surface-500'],
  ['secondary-text', 'surface-500'],
  ['danger-text', 'surface-500'],
];
const fillPairs = ['primary', 'secondary', 'danger', 'success', 'warning', 'vip', 'accent'].map(
  (fill) => ['on-fill', fill],
);
for (const theme of ['light', 'dark']) {
  for (const [fg, bg] of [...textPairs, ...fillPairs]) {
    const a = tokens[theme][fg];
    const b = tokens[theme][bg];
    if (!a || !b) {
      add(
        'error',
        'token-missing',
        'frontend/src/styles.scss',
        `${theme}: ${fg} or ${bg} is not defined`,
      );
      continue;
    }
    const ratio = contrast(a, b);
    if (ratio < 4.5) {
      add(
        'error',
        'token-contrast',
        'frontend/src/styles.scss',
        `${theme}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (< 4.5:1)`,
      );
    }
  }
}

// 2. Preview checks.
const runtimeName = { primary: 'primary', secondary: 'secondary', shadow: 'shadow' };
const physical =
  /(?<![-\w])(margin-left|margin-right|padding-left|padding-right|border-left|border-right|left|right)\s*:|text-align:\s*(left|right)|float:\s*(left|right)/g;
const manifest = loadManifest();
const itemsByPreview = new Map(
  manifest.items.flatMap((item) => item.previewPaths.map((p) => [p, item])),
);

for (const preview of previewFiles()) {
  const html = readFileSync(resolve(root, preview), 'utf8');
  const local = previewTokens(html);

  // Token drift: preview mirrors must match runtime tokens or reviewers judge a stale palette.
  for (const theme of ['light', 'dark']) {
    for (const [name, value] of Object.entries(local[theme])) {
      const runtime = tokens[theme][runtimeName[name] ?? name];
      if (runtime && runtime.join(',') !== value.join(',')) {
        add(
          'error',
          'preview-token-drift',
          preview,
          `${theme} --${name} is ${value.join(',')} but runtime is ${runtime.join(',')}`,
        );
      }
    }
  }
  if (Object.keys(local.light).length > 0 && Object.keys(local.dark).length === 0) {
    add('warning', 'preview-no-dark-theme', preview, 'defines light tokens but no html.dark block');
  }
  if (local.light.accent && !local.dark.accent) {
    add('warning', 'preview-dark-accent-missing', preview, 'html.dark does not redefine --accent');
  }

  // Physical direction CSS breaks RTL; Relay mandates logical properties.
  const style = (html.match(/<style>([\s\S]*?)<\/style>/) ?? ['', ''])[1];
  const physicalHits = new Set([...style.matchAll(physical)].map((m) => m[0].replace(/\s+/g, '')));
  for (const hit of physicalHits)
    add('warning', 'preview-physical-css', preview, `uses ${hit} (use logical properties)`);

  // Raw colours outside the token blocks bypass the theme.
  const outsideTokens = style
    .replace(/:root\s*\{[^}]*\}/, '')
    .replace(/html\.dark\s*\{[^}]*\}/, '');
  const raw = new Set(
    outsideTokens.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+[^)]*\)/g) ?? [],
  );
  for (const colour of raw)
    add('warning', 'preview-raw-colour', preview, `hard-coded colour ${colour}`);

  // Required state coverage declared by the manifest should be demonstrable in the preview.
  const item = itemsByPreview.get(preview);
  const text = html.toLowerCase();
  const stateEvidence = {
    dark: /html\.dark|\.dark\b/,
    rtl: /dir="rtl"|data-dir="rtl"|lang="ar"|lang="he"/,
    'focus-visible': /focus-visible/,
    'reduced-motion': /prefers-reduced-motion/,
    'forced-colours': /forced-colors/,
    loading: /loading|aria-busy|skeleton|spinner/,
    error: /error|role="alert"/,
    empty: /empty|no \w+ yet|nothing/,
  };
  for (const state of item?.requiredStates ?? []) {
    const evidence = stateEvidence[state];
    if (evidence && !evidence.test(text)) {
      add(
        'warning',
        'preview-state-missing',
        preview,
        `${item.id} requires "${state}" but the preview shows no evidence of it`,
      );
    }
  }

  // Feature catalogues: each specimen should say which states it shows.
  const specimens = specimenPaths(html);
  if (specimens.length > 0) {
    const sections = html.split(/<section\b[^>]*class="specimen"/).slice(1);
    sections.forEach((section, index) => {
      if (!/<footer>/.test(section.split('</section>')[0])) {
        add(
          'info',
          'specimen-no-states',
          preview,
          `${specimens[index] ?? `#${index}`} has no states footer`,
        );
      }
    });
  }

  if (!/<meta name="viewport"/.test(html))
    add('warning', 'preview-no-viewport', preview, 'missing viewport meta');
  if (/<script[^>]+src=/.test(html))
    add(
      'warning',
      'preview-external-script',
      preview,
      'loads an external script (preview is not offline-deterministic)',
    );
}

const counts = findings.reduce(
  (acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }),
  {},
);
const summary = `Design audit: ${findings.length} finding(s) - ${counts.error ?? 0} error, ${counts.warning ?? 0} warning, ${counts.info ?? 0} info.`;
console.log(summary);
for (const f of findings.filter((x) => x.severity !== 'info'))
  console.log(`- [${f.severity}] ${f.rule} ${f.file}: ${f.detail}`);

if (process.argv.includes('--write')) {
  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(
    resolve(root, 'reports/design-audit.json'),
    `${JSON.stringify({ generated: new Date().toISOString(), counts, findings }, null, 2)}\n`,
  );
  const byRule = Object.groupBy(findings, (f) => f.rule);
  const md = [`# Design audit`, '', summary, ''];
  for (const [rule, list] of Object.entries(byRule)) {
    md.push(`## ${rule} (${list.length})`, '');
    for (const f of list) md.push(`- [${f.severity}] \`${f.file}\` - ${f.detail} <!-- ${f.id} -->`);
    md.push('');
  }
  writeFileSync(resolve(root, 'reports/design-audit.md'), md.join('\n'));
  console.log('Wrote reports/design-audit.json and reports/design-audit.md');
}

if (process.argv.includes('--strict') && (counts.error ?? 0) > 0) process.exit(1);

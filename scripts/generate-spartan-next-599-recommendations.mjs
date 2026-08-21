#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const firstId = 25;
const lastId = 623;
const expectedCount = 599;
const outputPath = 'docs/spartan-next-599-recommendations.md';

const foundationAreas = [
  'design token ownership',
  'typography and multilingual font fallback',
  'semantic colour roles',
  'surface and elevation model',
  'radius hierarchy',
  'spacing and density scale',
  'motion durations and easing',
  'iconography and icon sizing',
  'compact and comfortable density',
  'theme service integration',
  'per-user primary accent handling',
  'dark theme parity',
  'forced-colours and high-contrast mode',
  'focus ring system',
  'prefers-reduced-motion support',
  'RTL logical properties',
  'translation-safe component APIs',
  'CJK content rendering',
  'Arabic content rendering',
  'Devanagari and complex-script rendering',
  '390px mobile baseline',
  'tablet responsive breakpoints',
  'desktop responsive breakpoints',
  'touch target sizing',
  'keyboard interaction standards',
  'screen-reader naming and relationships',
  '200 percent zoom behaviour',
  '400 percent zoom and reflow behaviour',
  'SSR compatibility',
  'hydration compatibility',
  'interaction performance budget',
  'bundle-size budget',
  'Spartan tree-shaking policy',
  'lazy-loaded route integration',
  'animation performance',
  'form-field composition',
  'validation and error messaging',
  'error-state presentation',
  'loading-state presentation',
  'empty-state presentation',
  'offline-state presentation',
  'skeleton loading consistency',
  'toast and notification semantics',
  'overlay positioning',
  'z-index and layer contract',
  'portal and focus restoration',
  'Angular component test harnesses',
  'visual regression baselines',
  'Claude Design source-of-truth sync',
];

const workstreams = [
  {
    key: 'audit',
    action: 'Audit and map UI to Spartan/Relay primitives',
    recommendation: 'Inventory every control, state, overlay and bespoke utility. Map it to an existing Helm component, approved Relay primitive, or Brain behaviour before changing implementation.',
    verify: 'Record behaviour, analytics hooks, routes, tests, migration risks and prerequisite primitive work.',
  },
  {
    key: 'convert',
    action: 'Convert controls and interactions to Spartan UI',
    recommendation: 'Replace hand-rolled interaction behaviour with existing app-owned Helm components first, adding Spartan UI components through the CLI only when the capability is absent.',
    verify: 'Verify keyboard, focus, disabled and error states and remove duplicated feature-level interaction logic.',
  },
  {
    key: 'visual',
    action: 'Apply Relay tokens, responsive layout and theme parity',
    recommendation: 'Remove off-token styling and align the surface with Relay semantic colour, radius, shadow, spacing and motion roles while preserving user accent behaviour.',
    verify: 'Verify 390px mobile, tablet, desktop, light theme and dark theme without raw product colours.',
  },
  {
    key: 'a11y',
    action: 'Complete accessibility, RTL, zoom and input-method pass',
    recommendation: 'Test keyboard, screen reader semantics, logical RTL layout, touch targets, forced colours, reduced motion and high zoom/reflow.',
    verify: 'Verify deterministic focus, logical direction properties, WCAG AA and required actions at 200 and 400 percent zoom.',
  },
  {
    key: 'verify',
    action: 'Add regression tests and sync Claude Design preview',
    recommendation: 'Lock the converted surface with focused Angular tests and update the design preview so code and Claude Design represent the same contract.',
    verify: 'Cover key states/interactions and light, dark and responsive visual states, then update audit status.',
  },
];

function listSurfaceDirectories() {
  const roots = [
    'frontend/src/app/components',
    'frontend/src/app/pages',
    'frontend/src/app/audio-rooms',
  ];
  const directories = new Set();

  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    const hasUiFile = files.some(
      (file) =>
        /\.(component\.)?(ts|html|scss)$/.test(file) &&
        !file.endsWith('.spec.ts') &&
        !file.endsWith('.verification.spec.ts'),
    );
    if (hasUiFile) directories.add(directory.replaceAll('\\', '/'));
    for (const entry of entries) {
      if (entry.isDirectory()) walk(path.join(directory, entry.name));
    }
  }

  roots.forEach(walk);
  return [...directories].sort();
}

function priorityFor(id, kind) {
  if (id <= 100) return 'P0 foundation';
  if (kind === 'audit' || kind === 'convert') return 'P1 structure';
  if (kind === 'a11y') return 'P1 accessibility';
  if (kind === 'visual') return 'P2 presentation';
  return 'P2 verification';
}

function buildRecommendations() {
  const recommendations = [];
  let id = 3;

  for (const area of foundationAreas) {
    const defineId = id++;
    const gateId = id++;
    recommendations.push({
      id: defineId,
      priority: priorityFor(defineId, 'foundation'),
      target: 'cross-cutting frontend architecture',
      action: `Define architecture standard for ${area}`,
      recommendation: `Audit the current ${area} implementation and define one canonical Spartan/Relay contract with allowed patterns, prohibited patterns and migration examples.`,
      verify: 'Document ownership boundaries and identify the smallest enforceable lint or test guard.',
    });
    recommendations.push({
      id: gateId,
      priority: priorityFor(gateId, 'foundation'),
      target: 'cross-cutting frontend architecture',
      action: `Add migration verification gate for ${area}`,
      recommendation: `Make regressions in ${area} mechanically detectable during the migration rather than relying on reviewer memory.`,
      verify: 'Add the smallest effective automated check and document its expected failure mode.',
    });
  }

  for (const surface of listSurfaceDirectories()) {
    for (const workstream of workstreams) {
      recommendations.push({
        id: id++,
        priority: priorityFor(id - 1, workstream.key),
        target: surface,
        action: `${workstream.action}: ${surface.replace(/^frontend\/src\/app\//, '')}`,
        recommendation: workstream.recommendation,
        verify: workstream.verify,
      });
    }
  }

  return recommendations.filter(({ id }) => id >= firstId && id <= lastId);
}

const recommendations = buildRecommendations();
if (recommendations.length !== expectedCount) {
  throw new Error(
    `Expected ${expectedCount} recommendations for Spartan UI ${String(firstId).padStart(4, '0')} through ${String(lastId).padStart(4, '0')}, generated ${recommendations.length}. Repository surface ordering may have drifted from the seeded backlog.`,
  );
}

const lines = [
  '# Spartan UI + Claude Design: next 599 recommendations',
  '',
  `This manifest covers exactly **${expectedCount}** existing migration tickets: **[Spartan UI ${String(firstId).padStart(4, '0')}] through [Spartan UI ${String(lastId).padStart(4, '0')}]**.`,
  '',
  'It does not create duplicate issues. The numbered backlog remains the execution source of truth. This file adds a deterministic, repository-derived recommendation for each ticket so agents can execute the programme in dependency order.',
  '',
  '## Execution rules',
  '',
  '- Finish dependency-ready foundation pairs before feature surfaces.',
  '- Check open PRs and recent implementation before starting a branch.',
  '- Prefer existing app-owned Spartan Helm components. Do not edit Brain.',
  '- Use Relay semantic tokens and preserve light/dark, user accent, RTL, i18n, reduced motion, forced colours and WCAG AA behaviour.',
  '- Replace hand-built overlays, controls, feedback and form composition where Spartan already owns the behaviour.',
  '- Keep each implementation batch independently reversible and merge only after required CI is green.',
  '- Update tests and Claude Design/design-preview coverage with visual-contract changes.',
  '',
  '## Recommendations',
  '',
];

for (const item of recommendations) {
  const padded = String(item.id).padStart(4, '0');
  lines.push(`### ${padded}. ${item.action}`);
  lines.push('');
  lines.push(`- **Priority:** ${item.priority}`);
  lines.push(`- **Target:** \`${item.target}\``);
  lines.push(`- **Recommendation:** ${item.recommendation}`);
  lines.push(`- **Verification:** ${item.verify}`);
  lines.push(`- **Backlog key:** \`[Spartan UI ${padded}]\``);
  lines.push('');
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${recommendations.length} recommendations to ${outputPath}.`);

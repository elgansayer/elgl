#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPRESENTATIVE_IDS = [
  'screen.discovery',
  'screen.chat',
  'screen.vocabulary',
  'screen.moderation',
];

const REQUIRED_STATES = [
  'light',
  'dark',
  'rtl',
  'mobile-390-text-200',
  'tablet-768-text-200',
];

function hasPattern(source, pattern) {
  return pattern.test(source);
}

export function verify200PercentZoomContract(matrix, visualHarnessSource) {
  const failures = [];

  const mobile = matrix?.rendering?.viewportMobile;
  if (!mobile || mobile.width !== 390) {
    failures.push('200% zoom gate requires the canonical 390px mobile viewport.');
  }

  const tablet = matrix?.rendering?.viewportTabletMd;
  if (!tablet || tablet.width !== 768) {
    failures.push('200% zoom gate requires the canonical 768px effective tablet viewport.');
  }

  const contracts = new Map(
    (matrix?.contracts ?? []).map((contract) => [contract.designSyncId, contract]),
  );

  for (const id of REPRESENTATIVE_IDS) {
    const contract = contracts.get(id);
    if (!contract) {
      failures.push(`${id}: missing representative visual contract for 200% zoom verification.`);
      continue;
    }

    for (const state of REQUIRED_STATES) {
      if (!contract.states?.includes(state)) {
        failures.push(`${id}: 200% zoom gate is missing state: ${state}`);
      }
    }
  }

  const harnessChecks = [
    [
      /['"]mobile-390-text-200['"]\s*:\s*\{\s*mode:\s*['"]text-200['"]\s*\}/s,
      'visual harness must render the mobile 200% text-scale state.',
    ],
    [
      /['"]tablet-768-text-200['"]\s*:\s*\{\s*viewport:\s*['"]md['"]\s*,\s*mode:\s*['"]text-200['"]\s*\}/s,
      'visual harness must render the tablet 200% text-scale state.',
    ],
    [
      /style\.fontSize\s*=\s*['"]200%['"]/,
      'visual harness must apply a 200% root text scale.',
    ],
    [
      /assertNoHorizontalDocumentOverflow\(\s*state\s*,\s*['"]390px mobile layout['"]\s*\)/,
      'visual harness must reject horizontal document overflow at the mobile 200% state.',
    ],
    [
      /assertNoHorizontalDocumentOverflow\(\s*state\s*,\s*['"]tablet layout['"]\s*\)/,
      'visual harness must reject horizontal document overflow at the tablet 200% state.',
    ],
  ];

  for (const [pattern, message] of harnessChecks) {
    if (!hasPattern(visualHarnessSource, pattern)) failures.push(message);
  }

  return failures;
}

function runCli() {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const matrix = JSON.parse(
    readFileSync(resolve(root, 'visual-contract.matrix.json'), 'utf8'),
  );
  const harness = readFileSync(
    resolve(root, 'frontend/cypress/visual/design-contracts.cy.ts'),
    'utf8',
  );

  const failures = verify200PercentZoomContract(matrix, harness);
  if (failures.length > 0) {
    console.error('200 percent zoom contract verification failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `200 percent zoom contract verified across ${REPRESENTATIVE_IDS.length} representative surfaces.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}

#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function reviewedMarker(line, marker) {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const javascriptComment = new RegExp(`^\\s*//\\s*${escapedMarker}:\\s*\\S.*$`);
  const htmlComment = new RegExp(`^\\s*<!--\\s*${escapedMarker}:\\s*\\S.*-->\\s*$`);
  return javascriptComment.test(line) || htmlComment.test(line);
}

function fieldInitialiser(line) {
  return line.match(
    /^\s*(?!(?:const|let|var)\b)(?:(?:readonly|private|protected|public|static|declare|override)\s+)*(?<name>[#$\w]+)(?:\s*[?!])?(?:\s*:\s*[^=]+)?\s*=\s*(?<value>.+)$/,
  );
}

function withoutSourceComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export function hasClientHydrationProvider(source) {
  return /\bprovideClientHydration\s*\(/.test(withoutSourceComments(source));
}

export function defaultServerRouteIsServerRendered(source) {
  const routeObjects = withoutSourceComments(source).match(/\{[^{}]*\}/g) ?? [];
  return routeObjects.some(
    (route) =>
      /\bpath\s*:\s*['"]\*\*['"]/.test(route) &&
      /\brenderMode\s*:\s*RenderMode\.Server\b/.test(route),
  );
}

export function findHydrationRisks(diff) {
  const failures = [];
  let currentFile = '';
  const additionsByFile = new Map();

  for (const rawLine of diff.split('\n')) {
    if (rawLine.startsWith('+++ b/')) {
      currentFile = rawLine.slice(6);
      if (!additionsByFile.has(currentFile)) additionsByFile.set(currentFile, []);
      continue;
    }
    if (!currentFile || !rawLine.startsWith('+') || rawLine.startsWith('+++')) continue;
    additionsByFile.get(currentFile).push(rawLine.slice(1));
  }

  for (const [file, additions] of additionsByFile) {
    for (const [index, line] of additions.entries()) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      const previousLine = additions[index - 1] ?? '';
      const reviewedSkip = reviewedMarker(previousLine, 'hydration-reviewed-skip');
      const reviewedClientRender = reviewedMarker(previousLine, 'hydration-reviewed-client-render');

      if (/\bngSkipHydration\b/.test(line) && !reviewedSkip) {
        failures.push(
          `${file}: new ngSkipHydration requires a hydration-reviewed-skip exception marker`,
        );
      }

      if (
        /\.(?:innerHTML|outerHTML)\s*=|\.(?:appendChild|insertBefore|removeChild|replaceChild|append|prepend|before|after|replaceWith|replaceChildren|insertAdjacentHTML|insertAdjacentElement)\s*\(/.test(
          line,
        )
      ) {
        failures.push(`${file}: new render-time native DOM mutation requires hydration review`);
      }

      if (/renderMode\s*:\s*RenderMode\.Client\b/.test(line) && !reviewedClientRender) {
        failures.push(
          `${file}: new RenderMode.Client route requires a hydration-reviewed-client-render marker`,
        );
      }

      const initialiser = fieldInitialiser(line);
      const fieldName = initialiser?.groups?.name ?? '';
      const fieldValue = initialiser?.groups?.value ?? '';
      if (/\b(?:window\.|document\.|localStorage\b|sessionStorage\b)/.test(fieldValue)) {
        failures.push(`${file}: browser global used directly in a field initializer`);
      }

      if (/(?:id)/i.test(fieldName) && /(?:Math\.random\s*\(|Date\.now\s*\()/.test(fieldValue)) {
        failures.push(`${file}: nondeterministic value used to initialise an id`);
      }
    }
  }

  return failures;
}

export function verifyRepositoryContract() {
  const failures = [];
  const angular = JSON.parse(read('frontend/angular.json'));
  const build = angular.projects?.frontend?.architect?.build?.options;
  if (build?.browser !== 'src/main.ts')
    failures.push('frontend/angular.json must retain the browser entrypoint');
  if (build?.server !== 'src/main.server.ts')
    failures.push('frontend/angular.json must retain the server entrypoint');
  if (build?.outputMode !== 'server')
    failures.push('frontend/angular.json must retain outputMode: server');
  if (build?.ssr?.entry !== 'server.ts')
    failures.push('frontend/angular.json must retain the SSR server entrypoint');

  const appConfig = read('frontend/src/app/app.config.ts');
  if (!hasClientHydrationProvider(appConfig)) {
    failures.push('provideClientHydration() is missing from shared application providers');
  }

  const serverConfig = read('frontend/src/app/app.config.server.ts');
  if (!/provideServerRendering\s*\(/.test(serverConfig)) {
    failures.push('server bootstrap must provide server rendering');
  }
  if (!/mergeApplicationConfig\s*\(\s*appConfig\s*,\s*serverConfig\s*\)/.test(serverConfig)) {
    failures.push('server bootstrap must merge the shared appConfig');
  }

  const serverRoutes = read('frontend/src/app/app.routes.server.ts');
  if (!defaultServerRouteIsServerRendered(serverRoutes)) {
    failures.push('default server route policy must remain RenderMode.Server');
  }

  const matrix = JSON.parse(read('visual-contract.matrix.json'));
  const requiredStates = [
    'mobile-390-light',
    'mobile-390-dark',
    'mobile-390-rtl',
    'mobile-390-text-400',
  ];
  const representativeIds = [
    'screen.discovery',
    'screen.chat',
    'screen.vocabulary',
    'screen.moderation',
  ];
  const byId = new Map(
    (matrix.contracts ?? []).map((contract) => [contract.designSyncId, contract]),
  );
  for (const id of representativeIds) {
    const contract = byId.get(id);
    if (!contract) {
      failures.push(`${id}: representative hydration visual contract is missing`);
      continue;
    }
    for (const state of requiredStates) {
      if (!contract.states?.includes(state))
        failures.push(`${id}: hydration gate is missing visual state ${state}`);
    }
  }

  const playwright = read('e2e/playwright.config.ts');
  for (const project of ['desktop-english', 'rtl-arabic']) {
    if (!playwright.includes(`name: '${project}'`))
      failures.push(`Playwright hydration coverage is missing ${project}`);
  }

  return failures;
}

function changedSourceFailures() {
  const base = process.env.HYDRATION_BASE_REF?.trim();
  if (!base) return [];
  try {
    const diff = execFileSync(
      'git',
      ['diff', '--unified=0', `${base}...HEAD`, '--', 'frontend/src'],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return findHydrationRisks(diff);
  } catch (error) {
    return [
      `unable to compare hydration-sensitive frontend changes against ${base}: ${error.message}`,
    ];
  }
}

function main() {
  const failures = [...verifyRepositoryContract(), ...changedSourceFailures()];
  if (failures.length > 0) {
    console.error('Hydration compatibility contract failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('Hydration compatibility contract verified.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

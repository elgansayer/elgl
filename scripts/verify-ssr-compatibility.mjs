#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');

export const SSR_CONTRACT_PATHS = Object.freeze({
  angular: 'frontend/angular.json',
  appConfig: 'frontend/src/app/app.config.ts',
  serverConfig: 'frontend/src/app/app.config.server.ts',
  serverRoutes: 'frontend/src/app/app.routes.server.ts',
  mainServer: 'frontend/src/main.server.ts',
  visualMatrix: 'visual-contract.matrix.json',
});

const EXPECTED_CLIENT_ROUTES = new Set([
  'active-call',
  'video-call',
  'audio-rooms/**',
  'device-transfer',
]);

const SSR_VISUAL_REPRESENTATIVES = [
  'screen.discovery',
  'screen.chat',
  'screen.vocabulary',
  'screen.moderation',
];

const REQUIRED_VISUAL_STATES = ['light', 'dark', 'rtl', 'mobile-390-text-200'];

function parseJson(name, source, failures) {
  try {
    return JSON.parse(source);
  } catch {
    failures.push(`${name}: must remain valid JSON`);
    return null;
  }
}

function requireMatch(source, pattern, message, failures) {
  if (!pattern.test(source)) failures.push(message);
}

function parseServerRoutes(source, failures) {
  const routePattern = /\{\s*path:\s*(['"])(.*?)\1,\s*renderMode:\s*RenderMode\.(Client|Server),?\s*\}/g;
  const routes = [];
  let match;

  while ((match = routePattern.exec(source)) !== null) {
    routes.push({ path: match[2], mode: match[3] });
  }

  if (routes.length === 0) {
    failures.push('app.routes.server.ts: could not parse any explicit server render-mode routes');
  }

  return routes;
}

export function collectSsrCompatibilityFailures(files) {
  const failures = [];
  const angular = parseJson('frontend/angular.json', files.angular ?? '', failures);
  const visualMatrix = parseJson('visual-contract.matrix.json', files.visualMatrix ?? '', failures);
  const appConfig = files.appConfig ?? '';
  const serverConfig = files.serverConfig ?? '';
  const serverRoutes = files.serverRoutes ?? '';
  const mainServer = files.mainServer ?? '';

  const buildOptions = angular?.projects?.frontend?.architect?.build?.options;
  if (buildOptions?.server !== 'src/main.server.ts') {
    failures.push('frontend/angular.json: build.options.server must remain src/main.server.ts');
  }
  if (buildOptions?.outputMode !== 'server') {
    failures.push('frontend/angular.json: build.options.outputMode must remain server');
  }
  if (buildOptions?.ssr?.entry !== 'server.ts') {
    failures.push('frontend/angular.json: build.options.ssr.entry must remain server.ts');
  }

  requireMatch(
    appConfig,
    /provideClientHydration\s*\(/,
    'app.config.ts: provideClientHydration() is required for the shared SSR/browser application',
    failures,
  );
  requireMatch(
    appConfig,
    /isPlatformServer\s*\(\s*platformId\s*\)/,
    'app.config.ts: browser-only configuration loading must retain an isPlatformServer(platformId) boundary',
    failures,
  );

  for (const globalPattern of [
    [/\bwindow\s*\./, 'window'],
    [/\blocalStorage\b/, 'localStorage'],
    [/\bsessionStorage\b/, 'sessionStorage'],
  ]) {
    if (globalPattern[0].test(appConfig)) {
      failures.push(`app.config.ts: raw ${globalPattern[1]} access is not allowed in shared bootstrap code`);
    }
  }

  requireMatch(
    serverConfig,
    /mergeApplicationConfig\s*\(\s*appConfig\s*,\s*serverConfig\s*,?\s*\)/,
    'app.config.server.ts: server configuration must merge the shared appConfig',
    failures,
  );
  requireMatch(
    serverConfig,
    /provideServerRendering\s*\(\s*withRoutes\s*\(\s*serverRoutes\s*\)\s*,?\s*\)/,
    'app.config.server.ts: provideServerRendering(withRoutes(serverRoutes)) is required',
    failures,
  );

  requireMatch(
    mainServer,
    /bootstrapApplication\s*\(\s*AppComponent\s*,\s*config\s*,\s*context\s*\)/,
    'main.server.ts: SSR must bootstrap the shared AppComponent with the server config and BootstrapContext',
    failures,
  );
  requireMatch(
    mainServer,
    /export\s+default\s+bootstrap/,
    'main.server.ts: the Angular SSR bootstrap must remain the default export',
    failures,
  );

  for (const [sourceName, source] of [
    ['app.config.server.ts', serverConfig],
    ['app.routes.server.ts', serverRoutes],
    ['main.server.ts', mainServer],
  ]) {
    if (/\b(?:window|document|navigator|localStorage|sessionStorage)\s*[.[]/.test(source)) {
      failures.push(`${sourceName}: direct browser-global access is forbidden in server bootstrap/configuration code`);
    }
  }

  const parsedRoutes = parseServerRoutes(serverRoutes, failures);
  const clientRoutes = new Set(parsedRoutes.filter((route) => route.mode === 'Client').map((route) => route.path));

  for (const expected of EXPECTED_CLIENT_ROUTES) {
    if (!clientRoutes.has(expected)) {
      failures.push(`app.routes.server.ts: documented client-only route is missing or no longer explicit: ${expected}`);
    }
  }
  for (const actual of clientRoutes) {
    if (!EXPECTED_CLIENT_ROUTES.has(actual)) {
      failures.push(
        `app.routes.server.ts: new client-only route requires SSR architecture review before allowlisting: ${actual}`,
      );
    }
  }

  const wildcard = parsedRoutes.find((route) => route.path === '**');
  if (!wildcard || wildcard.mode !== 'Server') {
    failures.push('app.routes.server.ts: the ** fallback must remain RenderMode.Server');
  }
  const preview = parsedRoutes.find((route) => route.path === 'preview/room/:id');
  if (!preview || preview.mode !== 'Server') {
    failures.push('app.routes.server.ts: preview/room/:id must remain explicitly server-rendered');
  }

  const contracts = Array.isArray(visualMatrix?.contracts) ? visualMatrix.contracts : [];
  const visualById = new Map(contracts.map((contract) => [contract.designSyncId, contract]));
  for (const id of SSR_VISUAL_REPRESENTATIVES) {
    const contract = visualById.get(id);
    if (!contract) {
      failures.push(`visual-contract.matrix.json: missing SSR representative visual contract: ${id}`);
      continue;
    }

    const states = new Set(Array.isArray(contract.states) ? contract.states : []);
    for (const state of REQUIRED_VISUAL_STATES) {
      if (!states.has(state)) {
        failures.push(`${id}: SSR representative must retain ${state} visual/accessibility coverage`);
      }
    }
  }

  return failures;
}

export function readRepositorySsrContract() {
  return Object.fromEntries(
    Object.entries(SSR_CONTRACT_PATHS).map(([key, path]) => [
      key,
      readFileSync(resolve(root, path), 'utf8'),
    ]),
  );
}

export function verifyRepositorySsrCompatibility() {
  return collectSsrCompatibilityFailures(readRepositorySsrContract());
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const failures = verifyRepositorySsrCompatibility();
  if (failures.length > 0) {
    console.error('SSR compatibility verification failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `SSR compatibility verified: server bootstrap, render-mode allowlist, hydration, and ${SSR_VISUAL_REPRESENTATIVES.length} theme/accessibility representatives.`,
  );
}

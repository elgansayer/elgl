import assert from 'node:assert/strict';
import test from 'node:test';

import { collectSsrCompatibilityFailures } from './verify-ssr-compatibility.mjs';

function validFiles() {
  const states = ['light', 'dark', 'rtl', 'mobile-390-text-200'];
  return {
    angular: JSON.stringify({
      projects: {
        frontend: {
          architect: {
            build: {
              options: {
                server: 'src/main.server.ts',
                outputMode: 'server',
                ssr: { entry: 'server.ts' },
              },
            },
          },
        },
      },
    }),
    appConfig: `
      import { provideClientHydration } from '@angular/platform-browser';
      import { isPlatformServer } from '@angular/common';
      export function initConfig(configService, platformId) {
        return () => isPlatformServer(platformId) ? Promise.resolve() : configService.loadConfiguration();
      }
      export const config = { providers: [provideClientHydration()] };
    `,
    serverConfig: `
      const serverConfig = {
        providers: [
          provideServerRendering(
            withRoutes(serverRoutes),
          ),
        ],
      };
      export const config = mergeApplicationConfig(
        appConfig,
        serverConfig,
      );
    `,
    serverRoutes: `
      export const serverRoutes = [
        { path: 'active-call', renderMode: RenderMode.Client },
        { path: 'video-call', renderMode: RenderMode.Client },
        { path: 'audio-rooms/**', renderMode: RenderMode.Client },
        { path: 'device-transfer', renderMode: RenderMode.Client },
        { path: 'preview/room/:id', renderMode: RenderMode.Server },
        { path: '**', renderMode: RenderMode.Server },
      ];
    `,
    mainServer: `
      const bootstrap = (context) => bootstrapApplication(AppComponent, config, context);
      export default bootstrap;
    `,
    visualMatrix: JSON.stringify({
      contracts: [
        { designSyncId: 'screen.discovery', states },
        { designSyncId: 'screen.chat', states },
        { designSyncId: 'screen.vocabulary', states },
        { designSyncId: 'screen.moderation', states },
      ],
    }),
  };
}

function expectFailure(files, fragment) {
  const failures = collectSsrCompatibilityFailures(files);
  assert.ok(
    failures.some((failure) => failure.includes(fragment)),
    `expected a failure containing ${JSON.stringify(fragment)}, got:\n${failures.join('\n')}`,
  );
}

test('accepts the canonical shared SSR/browser architecture', () => {
  assert.deepEqual(collectSsrCompatibilityFailures(validFiles()), []);
});

test('rejects accidental loss of the Angular server build', () => {
  const files = validFiles();
  const angular = JSON.parse(files.angular);
  angular.projects.frontend.architect.build.options.outputMode = 'static';
  files.angular = JSON.stringify(angular);

  expectFailure(files, 'build.options.outputMode must remain server');
});

test('rejects loss of hydration from the shared application config', () => {
  const files = validFiles();
  files.appConfig = files.appConfig.replace('provideClientHydration()', '/* hydration removed */');

  expectFailure(files, 'provideClientHydration() is required');
});

test('rejects browser globals in shared bootstrap code', () => {
  const files = validFiles();
  files.appConfig += '\nconst initialWidth = window.innerWidth;\n';

  expectFailure(files, 'raw window access is not allowed');
});

test('rejects browser globals in server-only bootstrap files', () => {
  const files = validFiles();
  files.mainServer += '\nconst language = navigator.language;\n';

  expectFailure(files, 'direct browser-global access is forbidden');
});

test('rejects new blanket client-only routes until architecture review', () => {
  const files = validFiles();
  files.serverRoutes = files.serverRoutes.replace(
    "{ path: 'preview/room/:id', renderMode: RenderMode.Server },",
    "{ path: 'settings', renderMode: RenderMode.Client },\n{ path: 'preview/room/:id', renderMode: RenderMode.Server },",
  );

  expectFailure(files, 'new client-only route requires SSR architecture review before allowlisting: settings');
});

test('requires the wildcard route to remain server-rendered', () => {
  const files = validFiles();
  files.serverRoutes = files.serverRoutes.replace(
    "{ path: '**', renderMode: RenderMode.Server },",
    "{ path: '**', renderMode: RenderMode.Client },",
  );

  expectFailure(files, 'the ** fallback must remain RenderMode.Server');
});

test('requires light, dark, RTL and zoom coverage for SSR representatives', () => {
  const files = validFiles();
  const matrix = JSON.parse(files.visualMatrix);
  matrix.contracts[0].states = ['light', 'rtl', 'mobile-390-text-200'];
  files.visualMatrix = JSON.stringify(matrix);

  expectFailure(files, 'screen.discovery: SSR representative must retain dark');
});

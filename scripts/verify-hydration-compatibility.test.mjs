import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultServerRouteIsServerRendered,
  findHydrationRisks,
  hasClientHydrationProvider,
  verifyRepositoryContract,
} from './verify-hydration-compatibility.mjs';

test('repository keeps the canonical SSR and hydration bootstrap plus visual accessibility states', () => {
  assert.deepEqual(verifyRepositoryContract(), []);
});

test('flags newly-added broad hydration skips and client-render escape hatches', () => {
  const failures = findHydrationRisks(
    `+++ b/frontend/src/app/app.routes.server.ts\n+    renderMode: RenderMode.Client,\n+++ b/frontend/src/app/pages/example/example.component.html\n+<section ngSkipHydration>Example</section>`,
  );
  assert.equal(failures.length, 2);
  assert.match(failures[0], /RenderMode\.Client/);
  assert.match(failures[1], /ngSkipHydration/);
});

test('permits explicitly reviewed narrow hydration exceptions', () => {
  const failures = findHydrationRisks(
    `+++ b/frontend/src/app/app.routes.server.ts\n+// hydration-reviewed-client-render: browser-only media device route\n+    renderMode: RenderMode.Client,\n+++ b/frontend/src/app/components/vendor-host/vendor-host.component.html\n+<!-- hydration-reviewed-skip: third-party widget owns this isolated subtree -->\n+<vendor-widget ngSkipHydration />`,
  );
  assert.deepEqual(failures, []);
});

test('does not let one exception marker approve later exceptions in the same file', () => {
  const failures = findHydrationRisks(`+++ b/frontend/src/app/app.routes.server.ts
+// hydration-reviewed-client-render: browser-only media device route
+    renderMode: RenderMode.Client,
+    { path: 'ordinary', renderMode: RenderMode.Server },
+    renderMode: RenderMode.Client,
+++ b/frontend/src/app/pages/example/example.component.html
+<!-- hydration-reviewed-skip: third-party widget owns this isolated subtree -->
+<vendor-widget ngSkipHydration />
+<section>Ordinary content</section>
+<another-widget ngSkipHydration />`);

  assert.equal(failures.length, 2);
  assert.match(failures[0], /RenderMode\.Client/);
  assert.match(failures[1], /ngSkipHydration/);
});

test('requires a standalone adjacent exception marker with a rationale', () => {
  const failures = findHydrationRisks(`+++ b/frontend/src/app/app.routes.server.ts
+// hydration-reviewed-client-render
+    renderMode: RenderMode.Client,
+    renderMode: RenderMode.Client, // hydration-reviewed-client-render: inline bypass
+++ b/frontend/src/app/pages/example/example.component.html
+<!-- hydration-reviewed-skip -->
+<vendor-widget ngSkipHydration />
+<another-widget ngSkipHydration hydration-reviewed-skip />`);

  assert.equal(failures.length, 4);
  assert.equal(failures.filter((failure) => failure.includes('RenderMode.Client')).length, 2);
  assert.equal(failures.filter((failure) => failure.includes('ngSkipHydration')).length, 2);
});

test('flags high-confidence render-time DOM mutation and nondeterministic IDs', () => {
  const failures = findHydrationRisks(
    `+++ b/frontend/src/app/pages/example/example.component.ts\n+  readonly descriptionId = 'description-' + Math.random();\n+  readonly storedTheme = localStorage.getItem('theme');\n+  this.host.nativeElement.innerHTML = html;\n+  this.host.nativeElement.appendChild(node);`,
  );
  assert.equal(failures.length, 4);
  assert.ok(failures.some((failure) => failure.includes('nondeterministic')));
  assert.ok(failures.some((failure) => failure.includes('field initializer')));
  assert.equal(failures.filter((failure) => failure.includes('DOM mutation')).length, 2);
});

test('does not reject browser capability usage inside guarded runtime methods', () => {
  const failures = findHydrationRisks(
    `+++ b/frontend/src/app/services/example.service.ts\n+  if (!isPlatformBrowser(this.platformId)) return;\n+  const width = window.innerWidth;\n+  const value = localStorage.getItem('example');`,
  );
  assert.deepEqual(failures, []);
});

test('flags unmodified class fields and additional native DOM tree mutations', () => {
  const failures = findHydrationRisks(`+++ b/frontend/src/app/pages/example/example.component.ts
+  descriptionId = 'description-' + Date.now();
+  storedTheme = localStorage.getItem('theme');
+  this.host.nativeElement.replaceChildren(node);
+  this.host.nativeElement.insertAdjacentHTML('beforeend', html);`);

  assert.equal(failures.length, 4);
  assert.ok(failures.some((failure) => failure.includes('nondeterministic')));
  assert.ok(failures.some((failure) => failure.includes('field initializer')));
  assert.equal(failures.filter((failure) => failure.includes('DOM mutation')).length, 2);
});

test('binds the server-render policy to the wildcard route object', () => {
  assert.equal(
    defaultServerRouteIsServerRendered(`[
      { path: '**', renderMode: RenderMode.Client },
      { path: 'later', renderMode: RenderMode.Server },
    ]`),
    false,
  );
  assert.equal(
    defaultServerRouteIsServerRendered(`[{ path: '**', renderMode: RenderMode.Server }]`),
    true,
  );
});

test('allows supported client hydration features while rejecting comment-only declarations', () => {
  assert.equal(hasClientHydrationProvider('provideClientHydration(withEventReplay())'), true);
  assert.equal(hasClientHydrationProvider('// provideClientHydration()'), false);
});

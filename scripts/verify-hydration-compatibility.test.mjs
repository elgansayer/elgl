import assert from 'node:assert/strict';
import test from 'node:test';
import { findHydrationRisks, verifyRepositoryContract } from './verify-hydration-compatibility.mjs';

test('repository keeps the canonical SSR and hydration bootstrap plus visual accessibility states', () => {
  assert.deepEqual(verifyRepositoryContract(), []);
});

test('flags newly-added broad hydration skips and client-render escape hatches', () => {
  const failures = findHydrationRisks(`+++ b/frontend/src/app/app.routes.server.ts\n+    renderMode: RenderMode.Client,\n+++ b/frontend/src/app/pages/example/example.component.html\n+<section ngSkipHydration>Example</section>`);
  assert.equal(failures.length, 2);
  assert.match(failures[0], /RenderMode\.Client/);
  assert.match(failures[1], /ngSkipHydration/);
});

test('permits explicitly reviewed narrow hydration exceptions', () => {
  const failures = findHydrationRisks(`+++ b/frontend/src/app/app.routes.server.ts\n+// hydration-reviewed-client-render: browser-only media device route\n+    renderMode: RenderMode.Client,\n+++ b/frontend/src/app/components/vendor-host/vendor-host.component.html\n+<!-- hydration-reviewed-skip: third-party widget owns this isolated subtree -->\n+<vendor-widget ngSkipHydration />`);
  assert.deepEqual(failures, []);
});

test('flags high-confidence render-time DOM mutation and nondeterministic IDs', () => {
  const failures = findHydrationRisks(`+++ b/frontend/src/app/pages/example/example.component.ts\n+  readonly descriptionId = 'description-' + Math.random();\n+  readonly storedTheme = localStorage.getItem('theme');\n+  this.host.nativeElement.innerHTML = html;\n+  this.host.nativeElement.appendChild(node);`);
  assert.equal(failures.length, 4);
  assert.ok(failures.some((failure) => failure.includes('nondeterministic')));
  assert.ok(failures.some((failure) => failure.includes('field initializer')));
  assert.equal(failures.filter((failure) => failure.includes('DOM mutation')).length, 2);
});

test('does not reject browser capability usage inside guarded runtime methods', () => {
  const failures = findHydrationRisks(`+++ b/frontend/src/app/services/example.service.ts\n+  if (!isPlatformBrowser(this.platformId)) return;\n+  const width = window.innerWidth;\n+  const value = localStorage.getItem('example');`);
  assert.deepEqual(failures, []);
});

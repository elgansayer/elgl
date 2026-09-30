# Bundle-size budget architecture standard

Status: canonical frontend architecture contract for the Spartan UI + Relay migration.

Related issues: #5531 defines this contract. #5532 owns the migration verification gate that should enforce the measurable parts of it.

## 1. Purpose

Bundle size is a product-performance constraint, not a cosmetic optimisation. HelloTalk must remain usable on mobile networks, low-memory devices, high-latency connections, and devices where JavaScript parse and execution cost matters as much as transfer size.

This document defines the repository contract for browser JavaScript, component styles, lazy feature boundaries, optional third-party capabilities, and the verification evidence required when bundle cost changes.

The standard applies to the Angular frontend and to frontend changes made during the Spartan UI + Relay migration. It does not change the visual contract, theme contract, route contract, or user-facing behaviour by itself.

## 2. Current implementation audit

### 2.1 Angular production budgets already exist

`frontend/angular.json` currently configures the Angular production build with these budgets:

| Budget | Warning | Error | Meaning |
| --- | ---: | ---: | --- |
| `initial` | 2.5 MB | 3 MB | Browser code required by the initial application load |
| `anyComponentStyle` | 4 kB | 8 kB | Per-component stylesheet budget |

These values are the current migration ceilings. They are not targets that feature work should try to fill.

The production build also enables output hashing and uses Angular's application builder. The application has server rendering enabled, so browser and server output must not be treated as the same performance artefact.

### 2.2 The canonical CI build already enforces Angular hard limits

The canonical CI workflow runs `npm run build` in `frontend/`. Angular's configured production budgets therefore already fail CI when the hard `initial` or `anyComponentStyle` error threshold is exceeded.

This is useful but incomplete. A hard ceiling alone can allow many small regressions to accumulate before CI finally fails. Follow-up #5532 should add migration-safe regression evidence without duplicating Angular's existing budget mechanism.

### 2.3 Route-level lazy loading is already the repository default

The root application routes use dynamic `loadComponent` imports and delegate groups of routes to focused route collections. This is the correct Angular 22 standalone architecture.

Non-critical feature surfaces should remain lazy. A migration from one Relay/Spartan component to another is not a reason to move feature code into the initial chunk.

### 2.4 The frontend contains intentionally substantial optional dependencies

The frontend includes packages for capabilities such as LiveKit, Firebase, charts, Lottie, image cropping, Joyride, Centrifugo, Supabase, and translation. These packages are legitimate when the owning feature needs them, but they make import boundaries important.

The presence of a dependency in `package.json` does not mean it belongs in the initial browser graph. Feature code should load optional capability packages only from the routes, components, or services that own those capabilities when Angular can preserve that boundary.

### 2.5 Existing design-system checks do not measure JavaScript growth

Relay and Spartan verification currently checks interaction ownership, tokens, directionality, typography, motion, density, forced colours, design sync, and related design contracts. Those checks are complementary to bundle-size verification. They must not be weakened to save bytes, and bundle optimisation must not bypass them.

## 3. Canonical ownership model

### 3.1 Angular owns compilation and chunking

Angular's production builder is the authority for emitted browser chunks, optimisation, dead-code removal, hashing, and production build budgets.

Do not introduce a second bundler for normal application code solely to manage bundle size.

### 3.2 Route definitions own major lazy boundaries

Route-level `loadComponent` and `loadChildren` boundaries are the preferred mechanism for keeping non-critical surfaces out of the initial graph.

A feature should be eagerly loaded only when it is genuinely part of the application's first useful interaction or when measurement shows that a separate request causes a worse result.

### 3.3 Feature code owns optional capability imports

Feature/domain code decides when optional packages enter the dependency graph.

Examples:

- LiveKit belongs with live audio/video flows.
- Chart.js belongs with charting surfaces.
- `ngx-image-cropper` belongs with image-cropping flows.
- Lottie belongs with the surfaces that actually render Lottie animation.
- Firebase messaging belongs with notification setup and messaging integration.

A shared utility must not import a large optional package merely for convenience if that makes the package part of the initial graph for unrelated routes.

### 3.4 Relay owns presentation tokens, not feature payloads

Relay tokens and shared presentation primitives should stay lightweight and broadly reusable. They must not become a place to import feature-specific SDKs, media engines, chart packages, or other optional capability code.

Theme parity is mandatory. Do not create separate light and dark component implementations or separate theme-specific feature bundles. Theme differences should continue to resolve through shared semantic tokens and CSS variables.

### 3.5 Spartan owns interaction primitives, not application-wide feature aggregation

Spartan Brain/Helm primitives should be imported at the smallest practical ownership boundary. Do not create an application-wide barrel that eagerly imports every Spartan primitive if a route uses only a subset.

Tree-shaking assumptions must be verified through the production build rather than inferred from package structure alone.

### 3.6 Server rendering is a separate budget domain

The server bundle exists to render Angular on the server. Its byte size does not substitute for browser evidence.

A change can reduce a server artefact while increasing browser JavaScript, or the reverse. Browser initial size remains the primary bundle-size user experience metric for this standard.

## 4. Budget contract

### 4.1 Existing Angular ceilings stay authoritative

Until a deliberate architecture change replaces them, keep these production budgets at least as strict as the current values:

```json
{
  "type": "initial",
  "maximumWarning": "2.5MB",
  "maximumError": "3MB"
}
```

and:

```json
{
  "type": "anyComponentStyle",
  "maximumWarning": "4kB",
  "maximumError": "8kB"
}
```

Do not raise either threshold to make a failing feature PR green.

Any proposal to change a threshold must include:

1. the before and after production-build evidence;
2. the specific code or dependency responsible for the change;
3. why lazy loading, import narrowing, code deletion, or package replacement cannot keep the existing budget;
4. expected user benefit that justifies the additional cost;
5. a rollback plan; and
6. an explicit architecture review in the same PR.

### 4.2 A hard ceiling is not a growth allowance

A bundle at 2.0 MB does not grant a feature 1.0 MB of discretionary growth simply because the error threshold is 3 MB.

Normal feature PRs should be non-regressive or explain measurable growth. The migration verification gate in #5532 should compare appropriate browser-build evidence against a trusted base rather than waiting for the hard ceiling to be reached.

### 4.3 Initial JavaScript has the strictest ownership rule

Code belongs in the initial browser graph only when one of these is true:

- it is necessary to bootstrap Angular safely;
- it is necessary to establish core routing/authentication/application shell state;
- it is shared by enough first-interaction routes that eager loading is demonstrably cheaper; or
- production measurements justify eager loading.

Large optional SDKs and route-specific feature implementations do not belong in the initial graph by default.

### 4.4 Lazy chunks must remain bounded by feature responsibility

A lazy chunk is not exempt from performance review merely because it is not initial.

When a route gains a large dependency, reviewers should ask whether:

- the dependency is used on every state of that route;
- a sub-feature can load it on demand;
- a smaller maintained package or native platform API can satisfy the requirement;
- duplicate functionality is already provided elsewhere; and
- the import accidentally crosses a shared-service or barrel boundary.

Do not create dozens of microscopic chunks solely to optimise a byte report. Request overhead, caching, execution order, and interaction latency still matter.

### 4.5 Component styles remain locally bounded

The existing 4 kB warning and 8 kB error limits for any component style remain the local style contract.

Prefer Relay semantic tokens and reusable Spartan/Relay primitives over duplicating large feature-owned CSS blocks. Do not minify readability by hand or move feature CSS into a global stylesheet merely to evade the per-component budget.

### 4.6 Static assets have a separate policy

Images, fonts, audio, video, design-preview captures, and service-worker assets are not equivalent to JavaScript initial bundle bytes.

They must still be optimised and cached appropriately, but they should not be folded into the JavaScript budget metric. A future asset-budget ticket may add separate limits where evidence supports them.

## 5. Import rules

### 5.1 Prefer direct, owned imports

Prefer imports that make the capability boundary obvious.

Good:

```ts
export const mediaRoutes: Routes = [
  {
    path: 'audio-rooms',
    loadComponent: () =>
      import('../audio-rooms/audio-rooms.component').then((m) => m.AudioRoomsComponent),
  },
];
```

The optional route stays behind a dynamic import.

### 5.2 Avoid eager aggregation barrels

Prohibited pattern:

```ts
// app-features.ts
export * from './audio-rooms/audio-rooms.component';
export * from './charts/stats-dashboard.component';
export * from './media/image-cropper.component';
```

followed by:

```ts
import { AudioRoomsComponent } from './app-features';
```

A barrel is acceptable when it does not destroy useful lazy boundaries. The production build is the evidence.

### 5.3 Do not import a whole SDK for a trivial helper

Before adding a dependency to shared code, check whether the platform or an existing repository dependency already provides the required capability.

Do not duplicate maintained parsing, formatting, accessibility, or utility functionality merely to avoid a small import either. Bundle size is one engineering constraint, not permission to create brittle local implementations.

### 5.4 Type-only imports must remain type-only where applicable

Use TypeScript type-only imports when a dependency is required only for static typing. This makes intent clear and avoids accidental runtime edges when package/module semantics change.

Example:

```ts
import type { SomeProviderResult } from './provider-types';
```

## 6. Spartan and Relay migration rules

### 6.1 Migrations should not duplicate old and new primitives in production graphs

During a component conversion, remove obsolete production imports when the Spartan/Relay replacement is complete.

Do not keep both a legacy feature primitive and its replacement eagerly referenced as a temporary safety net unless both are genuinely required at runtime.

### 6.2 Design-preview code is not production application code

Claude Design/design-preview assets exist to verify visual contracts. They must not be imported into the production Angular application graph.

A visual-only migration does not need a design-preview change when the rendered contract is unchanged. Follow the design-sync manifest rules for actual visual contract changes.

### 6.3 Light/dark and dynamic accent must share implementation

Bundle optimisation must preserve first-class light and dark themes and per-user primary accent behaviour.

Prohibited approaches include:

- separate light and dark component classes;
- route-level duplication solely for theme variants;
- shipping theme-specific JavaScript implementations when semantic CSS tokens suffice; and
- hardcoded product colours to avoid importing the shared Relay contract.

### 6.4 RTL and accessibility code is not optional weight

Do not remove logical-direction handling, accessible names/relationships, keyboard support, reduced-motion support, high-zoom reflow, or screen-reader states to reduce byte size.

When accessibility code can be moved into an existing shared primitive without changing behaviour, consolidation is encouraged. The result must retain or improve the tested contract.

## 7. Performance-aware dependency review

Before adding a new frontend runtime dependency:

1. confirm the capability is not already available from Angular, the browser platform, or an existing maintained dependency;
2. verify the package is maintained and compatible with Angular 22/TypeScript 6;
3. identify which route or feature owns the dependency;
4. ensure it can remain outside the initial graph when it is not boot-critical;
5. inspect the production build after integration;
6. check for duplicate transitive packages where useful; and
7. document material bundle impact in the PR.

Package popularity is not evidence that a dependency is free. Package byte size alone is also not enough: parse/execute cost, tree-shaking behaviour, browser support, correctness, maintenance, and security all matter.

## 8. Migration examples

### 8.1 Moving a non-critical feature behind a route boundary

Before:

```ts
import { HeavyFeatureComponent } from './heavy-feature/heavy-feature.component';

export const routes: Routes = [
  { path: 'heavy', component: HeavyFeatureComponent },
];
```

After:

```ts
export const routes: Routes = [
  {
    path: 'heavy',
    loadComponent: () =>
      import('./heavy-feature/heavy-feature.component').then((m) => m.HeavyFeatureComponent),
  },
];
```

Use this when the feature is not needed for first interaction and when the dynamic boundary is measurable in the production build.

### 8.2 Keeping an optional SDK out of a shared service

Before:

```ts
// shared/app.service.ts
import { OptionalMediaSdk } from 'optional-media-sdk';
```

Every consumer of the shared service can now inherit a runtime edge to that SDK.

After:

```ts
// media/media.service.ts
import { OptionalMediaSdk } from 'optional-media-sdk';
```

The package remains owned by the feature that needs it.

### 8.3 Reusing Relay styles instead of copying CSS

Before:

```scss
.feature-button {
  /* repeated control geometry, state, focus and theme rules */
}
```

After: use the repository-owned Spartan button plus Relay semantic tokens and keep only feature-specific layout in the feature.

This reduces duplicate CSS while preserving interaction ownership and theme parity.

## 9. Prohibited patterns

The following are prohibited unless an explicit measured exception is documented:

1. Raising Angular bundle thresholds merely to make CI pass.
2. Converting a lazy route to an eager component import without performance evidence.
3. Importing optional feature SDKs from the root application shell or broadly shared utilities.
4. Application-wide barrels that accidentally aggregate lazy features into the initial graph.
5. Shipping duplicate legacy and Spartan/Relay implementations after migration is complete.
6. Moving component CSS into global CSS solely to evade `anyComponentStyle` budgets.
7. Replacing tested accessibility, RTL, theme, or high-zoom behaviour with smaller but less capable code.
8. Hand-written minification, unreadable aliases, or generated source checked in solely to reduce measured source size.
9. Treating server-render bundle size as proof that the browser bundle is healthy.
10. Treating compressed transfer size as the only cost while ignoring parse, compile, and execution work.
11. Adding route preloading globally without measuring its network and execution effect.
12. Eagerly initialising media, realtime, charting, animation, or notification SDKs before the owning feature needs them.

## 10. Verification contract

### 10.1 Existing command

The current authoritative production build is:

```bash
cd frontend
npm run build
```

Expected failure mode today:

- Angular exits non-zero when the 3 MB initial error budget is exceeded.
- Angular exits non-zero when any component style exceeds 8 kB.
- Warning thresholds remain visible in build output before the hard error limit.

CI already runs this command for application-affecting pull requests.

### 10.2 Follow-up migration gate for #5532

#5532 should add the smallest reliable automated regression check on top of the existing Angular budgets. The preferred design is:

1. build the frontend in production mode with stable build settings;
2. extract browser output sizes from Angular's build output or a machine-readable build artefact;
3. compare the relevant initial-browser total against a trusted base-branch measurement;
4. fail only on meaningful regression outside a small deterministic tolerance;
5. still fail absolutely when Angular's configured hard budget fails;
6. report which initial/lazy artefact changed enough to investigate; and
7. keep the gate read-only, deterministic, and independent from visual theme state.

The gate should not attempt to maintain separate light and dark JavaScript budgets because themes share the same application graph. Instead, verification must assert that bundle optimisation did not fork theme implementations. Accessibility states similarly share the graph and should be protected by existing behavioural/accessibility tests rather than duplicated builds.

If Angular's emitted metadata is not stable enough for a reliable base comparison, prefer a small repository-owned script that normalises emitted file names and byte counts. Do not scrape human-formatted console output when a machine-readable source is available.

### 10.3 Expected migration-gate failure message

A useful failure should identify:

- base initial browser bytes;
- PR initial browser bytes;
- absolute and percentage delta;
- configured warning/error ceiling; and
- the largest changed emitted chunks when available.

A failure should tell the author to inspect imports and lazy boundaries. It should not suggest raising the budget as the default remedy.

## 11. Review checklist

For a frontend PR that materially changes dependencies, routes, or shared primitives, reviewers should verify:

- [ ] `npm run build` passes without increasing configured Angular ceilings.
- [ ] Non-critical routes remain lazy.
- [ ] New optional dependencies are owned by the feature that uses them.
- [ ] Shared Relay/Spartan code does not import feature SDKs.
- [ ] Obsolete production imports are removed after migration.
- [ ] Browser and server bundle concerns are not conflated.
- [ ] Theme, accent, RTL, accessibility, responsive, and zoom contracts remain intact.
- [ ] Material size growth is documented with before/after evidence.
- [ ] Rollback does not depend on preserving a second production implementation.

## 12. Exceptions

An exception is acceptable only when there is measured user benefit and no reasonable lower-cost architecture.

The PR must record:

- affected emitted bundle/chunk;
- before/after evidence;
- why the code must load at that boundary;
- alternatives considered;
- impact on low-end/mobile users;
- whether the cost is temporary or permanent; and
- rollback/removal criteria.

A temporary exception must have a tracking issue and should not silently become the new default budget.

## 13. Rollout and rollback

This document changes architecture policy only. It has no runtime rollout requirement.

Future bundle-size changes should roll out through normal production builds. If a dependency or import-boundary change causes unacceptable startup/interaction cost, rollback by reverting the feature/import change, not by weakening Angular's budget thresholds.

## 14. Definition of done for bundle-sensitive frontend work

A bundle-sensitive change is complete when:

- the production build passes the existing Angular budgets;
- non-critical capability code is lazy where appropriate;
- no accidental shared import pulls route-specific SDKs into the initial graph;
- component-style budgets pass without moving CSS elsewhere to hide growth;
- Relay/Spartan, theme, accent, RTL, accessibility, responsive, and zoom behaviour remain correct;
- material growth is measured and justified;
- #5532's migration verification gate passes once implemented; and
- the PR records verification and rollback when the size impact is material.

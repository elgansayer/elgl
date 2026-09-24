# Spartan / Relay mapping: components / admin offline banner

Issue: [#5816](https://github.com/elgansayer/elgl/issues/5816)

Target: `frontend/src/app/components/admin-offline-banner`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                                               | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [admin-offline-banner.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.spec.ts) | `bd79dc9df2369e08ed5827691ab3422e1275d6ec1b0e8610c036fe7b53e12822` |
| [admin-offline-banner.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts)           | `ecea9d35758ed25d382f441b9a09f8c6f2f45ae3db9a10153941df06b2e3bca6` |

## Complete template element and control map

4 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                                          | Element and presentation owner                  | Current attributes and bindings                                                                                                                       | Events and visible content                                | Migration target and constraint                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [admin-offline-banner.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L10) | `div`; Native structure and Relay presentation  | `class=flex items-center justify-center gap-2 bg-warning text-on-fill px-4 py-2 text-sm font-semibold shadow-md`; `role=alert`; `aria-live=assertive` | None                                                      | `Keep semantic div; use Relay colour, radius and spacing tokens`; Preserve alert semantics and associated ARIA relationships.   |
| [admin-offline-banner.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L15) | `span`; Native structure and Relay presentation | `class=text-base leading-none`; `aria-hidden=true`                                                                                                    | Content: `⚠️`                                             | `Keep semantic span; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |
| [admin-offline-banner.component.ts:16](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L16) | `span`; Native structure and Relay presentation | None                                                                                                                                                  | Content: `{{ 'admin.offline.banner' \| t }}`              | `Keep semantic span; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |
| [admin-offline-banner.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L18) | `span`; Native structure and Relay presentation | `class=text-on-fill/80`                                                                                                                               | Content: `{{ 'admin.offline.cachedDataAvailable' \| t }}` | `Keep semantic span; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                                                          | Block           | Condition or collection | Identity contract                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------- | -------------------------------------------- |
| [admin-offline-banner.component.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L9)   | `IfBlockBranch` | `!isOnline()`           | Preserve branch identity and rendering order |
| [admin-offline-banner.component.ts:17](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L17) | `IfBlockBranch` | `cachedDataAvailable()` | Preserve branch identity and rendering order |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                                          | Member                                            | Type       | Initialiser / binding summary             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------- | ----------------------------------------- |
| [admin-offline-banner.component.ts:27](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L27) | `AdminOfflineBannerComponent.offlineStorage`      | `inferred` | `inject(OfflineAdminStorageService)`      |
| [admin-offline-banner.component.ts:29](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L29) | `AdminOfflineBannerComponent.isOnline`            | `inferred` | `this.offlineStorage.isOnline`            |
| [admin-offline-banner.component.ts:30](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L30) | `AdminOfflineBannerComponent.cachedDataAvailable` | `inferred` | `this.offlineStorage.cachedDataAvailable` |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

No local methods or accessors are declared.

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

| Reference                                                                                                                                                                            | Current expression                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [moderation-queue.component.html:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/moderation/moderation-queue.component.html#L2) | `<app-admin-offline-banner />`                                                                                        |
| [moderation-queue.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/moderation/moderation-queue.component.ts#L11)   | `import { AdminOfflineBannerComponent } from '../components/admin-offline-banner/admin-offline-banner.component';`    |
| [moderation-queue.component.ts:29](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/moderation/moderation-queue.component.ts#L29)   | `AdminOfflineBannerComponent,`                                                                                        |
| [admin-users.component.html:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/pages/admin/admin-users.component.html#L2)          | `<app-admin-offline-banner />`                                                                                        |
| [admin-users.component.ts:8](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/pages/admin/admin-users.component.ts#L8)              | `import { AdminOfflineBannerComponent } from '../../components/admin-offline-banner/admin-offline-banner.component';` |
| [admin-users.component.ts:25](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/pages/admin/admin-users.component.ts#L25)            | `AdminOfflineBannerComponent,`                                                                                        |

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                                        | Imported API                     | Module                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| [admin-offline-banner.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L1) | `{ Component, inject }`          | `@angular/core`                                |
| [admin-offline-banner.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L2) | `{ TranslatePipe }`              | `../../services/translate.pipe`                |
| [admin-offline-banner.component.ts:3](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L3) | `{ OfflineAdminStorageService }` | `../../services/offline-admin-storage.service` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                                          | Declaration                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [admin-offline-banner.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L11) | `class="flex items-center justify-center gap-2 bg-warning text-on-fill px-4 py-2 text-sm font-semibold shadow-md"` |
| [admin-offline-banner.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L15) | `<span class="text-base leading-none" aria-hidden="true">⚠️</span>`                                                |
| [admin-offline-banner.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.ts#L18) | `<span class="text-on-fill/80">`                                                                                   |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                                                    | Suite or case | Stated contract                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| [admin-offline-banner.component.spec.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.spec.ts#L9)   | `describe`    | AdminOfflineBannerComponent                                       |
| [admin-offline-banner.component.spec.ts:42](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.spec.ts#L42) | `it`          | should create                                                     |
| [admin-offline-banner.component.spec.ts:46](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.spec.ts#L46) | `it`          | should hide the banner when online                                |
| [admin-offline-banner.component.spec.ts:53](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.spec.ts#L53) | `it`          | should show the banner when offline                               |
| [admin-offline-banner.component.spec.ts:61](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.spec.ts#L61) | `it`          | should show cached data available message when offline with cache |
| [admin-offline-banner.component.spec.ts:69](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.spec.ts#L69) | `it`          | should have aria-live assertive                                   |
| [admin-offline-banner.component.spec.ts:76](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-offline-banner/admin-offline-banner.component.spec.ts#L76) | `it`          | should update visibility when connectivity changes                |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

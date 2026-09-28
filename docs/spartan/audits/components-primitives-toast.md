# Spartan / Relay mapping: components / primitives / toast

Issue: [#5613](https://github.com/elgansayer/elgl/issues/5613)

Target: `frontend/src/app/components/primitives/toast`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                             | SHA-256                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [toast.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.spec.ts) | `18290ee65533eab7e13ef15f14562dd9b802934ad5eb64e11e484c2cf913ef79` |
| [toast.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts)           | `8a130123b2f11c32d7390a5b61c825df80e004426468c800875c38f9ade84caa` |

## Complete template element and control map

2 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                        | Element and presentation owner                 | Current attributes and bindings                                                                                                                                                                                                                                                                                                                                                                                                                          | Events and visible content     | Migration target and constraint                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| [toast.component.ts:8](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L8)   | `div`; Native structure and Relay presentation | `class=fixed top-10 inset-x-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none p-4`                                                                                                                                                                                                                                                                                                                                                         | None                           | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |
| [toast.component.ts:12](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L12) | `div`; Native structure and Relay presentation | `class=px-4 py-2 rounded-card shadow-lift font-bold text-sm pointer-events-auto transition-all duration-base ease-app animate-slide-down border border-surface-100`; `[class.bg-surface-200]="toast.type === 'info'"`; `[class.text-text-primary]="toast.type === 'info'"`; `[class.bg-danger]="toast.type === 'error'"`; `[class.text-on-fill]="toast.type === 'error' \|\| toast.type === 'success'"`; `[class.bg-success]="toast.type === 'success'"` | Content: `{{ toast.message }}` | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                        | Block          | Condition or collection | Identity contract |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------- | ----------------- |
| [toast.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L11) | `ForLoopBlock` | `toastsSignal()`        | `track toast.id`  |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                        | Member                        | Type       | Initialiser / binding summary |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------- | ----------------------------- |
| [toast.component.ts:49](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L49) | `ToastComponent.toastsSignal` | `inferred` | `toastsSignal`                |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

No local methods or accessors are declared.

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

| Reference                                                                                                                                           | Current expression                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [app.component.html:113](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/app.component.html#L113) | `<app-toast />`                                                                   |
| [app.component.ts:24](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/app.component.ts#L24)       | `import { ToastComponent } from './components/primitives/toast/toast.component';` |
| [app.component.ts:60](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/app.component.ts#L60)       | `ToastComponent,`                                                                 |

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                      | Imported API                             | Module                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------- |
| [toast.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L1) | `{ Component, ChangeDetectionStrategy }` | `@angular/core`                   |
| [toast.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L2) | `{ toastsSignal }`                       | `../../../services/toast.service` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                        | Declaration                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [toast.component.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L9)   | `class="fixed top-10 inset-x-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none p-4"`                                                                    |
| [toast.component.ts:13](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L13) | `class="px-4 py-2 rounded-card shadow-lift font-bold text-sm pointer-events-auto transition-all duration-base ease-app animate-slide-down border border-surface-100"` |
| [toast.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L14) | `[class.bg-surface-200]="toast.type === 'info'"`                                                                                                                      |
| [toast.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L15) | `[class.text-text-primary]="toast.type === 'info'"`                                                                                                                   |
| [toast.component.ts:16](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L16) | `[class.bg-danger]="toast.type === 'error'"`                                                                                                                          |
| [toast.component.ts:17](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L17) | `[class.text-on-fill]="toast.type === 'error' \|\| toast.type === 'success'"`                                                                                         |
| [toast.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L18) | `[class.bg-success]="toast.type === 'success'"`                                                                                                                       |
| [toast.component.ts:27](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L27) | `@keyframes slide-down {`                                                                                                                                             |
| [toast.component.ts:38](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L38) | `animation: slide-down var(--app-motion-base) var(--app-ease-standard) forwards;`                                                                                     |
| [toast.component.ts:42](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.ts#L42) | `animation: none;`                                                                                                                                                    |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                  | Suite or case | Stated contract                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| [toast.component.spec.ts:5](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.spec.ts#L5)   | `describe`    | ToastComponent                                                    |
| [toast.component.spec.ts:26](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.spec.ts#L26) | `it`          | should render no toasts when the signal is empty                  |
| [toast.component.spec.ts:30](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.spec.ts#L30) | `it`          | should render an info toast using the surface/text-primary tokens |
| [toast.component.spec.ts:42](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.spec.ts#L42) | `it`          | should render an error toast using the danger/on-fill tokens      |
| [toast.component.spec.ts:51](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.spec.ts#L51) | `it`          | should render a success toast using the success/on-fill tokens    |
| [toast.component.spec.ts:60](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.spec.ts#L60) | `it`          | should render multiple toasts tracked by id                       |
| [toast.component.spec.ts:73](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/toast/toast.component.spec.ts#L73) | `it`          | should react to the signal updating after removal                 |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

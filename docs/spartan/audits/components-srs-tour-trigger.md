# Spartan / Relay mapping: components / srs tour trigger

Issue: [#5900](https://github.com/elgansayer/elgl/issues/5900)

Target: `frontend/src/app/components/srs-tour-trigger`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                         | SHA-256                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [srs-tour-trigger.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/srs-tour-trigger/srs-tour-trigger.component.ts) | `e43b87c3c951993200dd14d4ffecc5edf8b29cbbe360f8b6c05fc40933cc683a` |

## Complete template element and control map

1 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                              | Element and presentation owner                   | Current attributes and bindings                                                                | Events and visible content                                                     | Migration target and constraint                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [srs-tour-trigger.component.ts:12](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/srs-tour-trigger/srs-tour-trigger.component.ts#L12) | `app-button-primary`; Existing product component | `customClass=ps-4 pe-4 pt-2 pb-2 text-xs`; `[attr.aria-label]="'srsTour.startAriaLabel' \| t"` | `(clicked)="tourService.startTour()"` Content: `{{ 'srsTour.startBtn' \| t }}` | `AppButtonPrimaryComponent (frontend/src/app/components/primitives/button-primary/button-primary.component.ts)`; Keep its input/output boundary; migrate generic interaction inside its owner. |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                                              | Block           | Condition or collection           | Identity contract                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------- | -------------------------------------------- |
| [srs-tour-trigger.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/srs-tour-trigger/srs-tour-trigger.component.ts#L11) | `IfBlockBranch` | `!tourService.hasCompletedTour()` | Preserve branch identity and rendering order |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                              | Member                                | Type       | Initialiser / binding summary |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------- | ----------------------------- |
| [srs-tour-trigger.component.ts:23](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/srs-tour-trigger/srs-tour-trigger.component.ts#L23) | `SrsTourTriggerComponent.tourService` | `inferred` | `inject(SrsTourService)`      |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

No local methods or accessors are declared.

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

No class-name or selector reference was found outside this target in frontend source. Treat integration as unproven and verify reachability before a product migration.

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                            | Imported API                    | Module                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| [srs-tour-trigger.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/srs-tour-trigger/srs-tour-trigger.component.ts#L1) | `{ Component, inject }`         | `@angular/core`                                         |
| [srs-tour-trigger.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/srs-tour-trigger/srs-tour-trigger.component.ts#L2) | `{ TranslatePipe }`             | `../../services/translate.pipe`                         |
| [srs-tour-trigger.component.ts:3](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/srs-tour-trigger/srs-tour-trigger.component.ts#L3) | `{ SrsTourService }`            | `../../services/srs-tour.service`                       |
| [srs-tour-trigger.component.ts:4](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/srs-tour-trigger/srs-tour-trigger.component.ts#L4) | `{ AppButtonPrimaryComponent }` | `../primitives/button-primary/button-primary.component` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                              | Declaration                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [srs-tour-trigger.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/srs-tour-trigger/srs-tour-trigger.component.ts#L14) | `customClass="ps-4 pe-4 pt-2 pb-2 text-xs"` |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Existing product component`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

No adjacent unit spec was found. Add behavioural coverage before changing this surface.

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

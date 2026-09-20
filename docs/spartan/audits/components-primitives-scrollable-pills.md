# Spartan / Relay mapping: components / primitives / scrollable pills

Issue: [#5592](https://github.com/elgansayer/elgl/issues/5592)

Target: `frontend/src/app/components/primitives/scrollable-pills`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                                              | SHA-256                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [scrollable-pills.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.spec.ts) | `dcdba63d656ac1f45c120ea42f02156842cc389a1636b5b1ca47483e8694d861` |
| [scrollable-pills.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts)           | `b2842fd96d1bdb670c2c1a81ee089e23e916faf8f62d6e581de79ef60ef7fa4b` |

## Complete template element and control map

2 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                                         | Element and presentation owner                 | Current attributes and bindings                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Events and visible content                                       | Migration target and constraint                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [scrollable-pills.component.ts:8](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L8)   | `div`; Native structure and Relay presentation | `class=hide-scrollbar flex gap-2 overflow-x-auto bg-surface-500 px-4 py-2`; `role=radiogroup`; `[attr.aria-label]="ariaLabel() \|\| null"`                                                                                                                                                                                                                                                                                                                                                                | None                                                             | `Keep semantic div; use Relay colour, radius and spacing tokens`; Preserve radiogroup semantics and associated ARIA relationships. |
| [scrollable-pills.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L14) | `button`; Installed Helm/Brain composition     | `hlmBtn=`; `type=button`; `variant=ghost`; `size=sm`; `class=whitespace-nowrap rounded-full`; `role=radio`; `[class.bg-primary]="selected() === pill.id"`; `[class.text-on-fill]="selected() === pill.id"`; `[class.bg-surface-300]="selected() !== pill.id"`; `[class.text-text-secondary]="selected() !== pill.id"`; `[class.border]="selected() !== pill.id"`; `[class.border-surface-200]="selected() !== pill.id"`; `[attr.aria-checked]="selected() === pill.id"`; `[attr.aria-label]="pill.label"` | `(click)="pillPicked.emit(pill.id)"` Content: `{{ pill.label }}` | `button, hlmBtn`; Preserve the existing primitive inputs and event order.                                                          |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                                                         | Block          | Condition or collection | Identity contract |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------- | ----------------- |
| [scrollable-pills.component.ts:13](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L13) | `ForLoopBlock` | `pills()`               | `track pill.id`   |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                                         | Member                                | Type       | Initialiser / binding summary                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------- | --------------------------------------------------- |
| [scrollable-pills.component.ts:49](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L49) | `ScrollablePillsComponent.pills`      | `inferred` | `input.required<{ id: string; label: string }[]>()` |
| [scrollable-pills.component.ts:50](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L50) | `ScrollablePillsComponent.selected`   | `inferred` | `input.required<string>()`                          |
| [scrollable-pills.component.ts:51](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L51) | `ScrollablePillsComponent.ariaLabel`  | `inferred` | `input<string>('')`                                 |
| [scrollable-pills.component.ts:52](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L52) | `ScrollablePillsComponent.pillPicked` | `inferred` | `output<string>()`                                  |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

No local methods or accessors are declared.

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

| Reference                                                                                                                                                                                                    | Current expression                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| [chat-list.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-list/chat-list.component.ts#L14)                               | `import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';` |
| [chat-list.component.ts:44](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-list/chat-list.component.ts#L44)                               | `ScrollablePillsComponent,`                                                                             |
| [discovery.component.ts:33](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/discovery/discovery.component.ts#L33)                               | `import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';` |
| [discovery.component.ts:74](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/discovery/discovery.component.ts#L74)                               | `ScrollablePillsComponent,`                                                                             |
| [moments-feed.component.ts:30](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/moments-feed/moments-feed.component.ts#L30)                      | `import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';` |
| [moments-feed.component.ts:62](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/moments-feed/moments-feed.component.ts#L62)                      | `ScrollablePillsComponent,`                                                                             |
| [notifications-inbox.component.ts:13](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/notifications-inbox/notifications-inbox.component.ts#L13) | `import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';` |
| [notifications-inbox.component.ts:19](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/notifications-inbox/notifications-inbox.component.ts#L19) | `imports: [HlmButton, TranslatePipe, ScrollablePillsComponent],`                                        |

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                                       | Imported API                   | Module                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------- |
| [scrollable-pills.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L1) | `{ Component, input, output }` | `@angular/core`           |
| [scrollable-pills.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L2) | `{ HlmButtonImports }`         | `@spartan-ng/helm/button` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                                         | Declaration                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [scrollable-pills.component.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L9)   | `class="hide-scrollbar flex gap-2 overflow-x-auto bg-surface-500 px-4 py-2"` |
| [scrollable-pills.component.ts:19](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L19) | `class="whitespace-nowrap rounded-full"`                                     |
| [scrollable-pills.component.ts:21](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L21) | `[class.bg-primary]="selected() === pill.id"`                                |
| [scrollable-pills.component.ts:22](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L22) | `[class.text-on-fill]="selected() === pill.id"`                              |
| [scrollable-pills.component.ts:23](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L23) | `[class.bg-surface-300]="selected() !== pill.id"`                            |
| [scrollable-pills.component.ts:24](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L24) | `[class.text-text-secondary]="selected() !== pill.id"`                       |
| [scrollable-pills.component.ts:25](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L25) | `[class.border]="selected() !== pill.id"`                                    |
| [scrollable-pills.component.ts:26](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L26) | `[class.border-surface-200]="selected() !== pill.id"`                        |
| [scrollable-pills.component.ts:43](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.ts#L43) | `scrollbar-width: none;`                                                     |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`, `Installed Helm/Brain composition`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                                                   | Suite or case | Stated contract                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------- |
| [scrollable-pills.component.spec.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.spec.ts#L10) | `describe`    | ScrollablePillsComponent                                         |
| [scrollable-pills.component.spec.ts:23](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.spec.ts#L23) | `it`          | renders accessible radio buttons for every pill                  |
| [scrollable-pills.component.spec.ts:36](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.spec.ts#L36) | `it`          | reacts to selected input changes and retains RTL-neutral spacing |
| [scrollable-pills.component.spec.ts:48](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/scrollable-pills/scrollable-pills.component.spec.ts#L48) | `it`          | emits the stable pill identity when a native button is clicked   |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

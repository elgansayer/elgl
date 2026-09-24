# Spartan / Relay mapping: components / primitives / audio equalizer

Issue: [#6411](https://github.com/elgansayer/elgl/issues/6411)

Target: `frontend/src/app/components/primitives/audio-equalizer`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                                           | SHA-256                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [audio-equalizer.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.spec.ts) | `1f1c6847ccdbaf70c2a4c8fa62365ffdc91b63209be46ad59a8b809844056cb4` |
| [audio-equalizer.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts)           | `a3de449a45f7711bf5841697f9d95fe32a0658d8c12e88c44a94a1260ade71a1` |

## Complete template element and control map

2 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                                      | Element and presentation owner                 | Current attributes and bindings                                                                                                                                  | Events and visible content | Migration target and constraint                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [audio-equalizer.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L10) | `div`; Native structure and Relay presentation | `class=flex items-end justify-center gap-0.5 h-5`; `[class.opacity-40]="!isActive()"`                                                                            | None                       | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |
| [audio-equalizer.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L15) | `div`; Native structure and Relay presentation | `class=w-1 rounded-t-sm bg-current`; `[class.animate-eq]="isActive()"`; `[style.animation-delay]="bar.delay"`; `[style.height]="isActive() ? undefined : '4px'"` | None                       | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                                                      | Block          | Condition or collection | Identity contract |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------- | ----------------- |
| [audio-equalizer.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L14) | `ForLoopBlock` | `bars()`                | `track $index`    |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                                      | Member                                  | Type               | Initialiser / binding summary                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [audio-equalizer.component.ts:45](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L45) | `AudioEqualizerComponent.isActive`      | `inferred`         | `input<boolean>(false)`                                                                                                                       |
| [audio-equalizer.component.ts:48](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L48) | `AudioEqualizerComponent.barCount`      | `inferred`         | `input<number>(4)`                                                                                                                            |
| [audio-equalizer.component.ts:51](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L51) | `AudioEqualizerComponent.customClass`   | `inferred`         | `input<string>('')`                                                                                                                           |
| [audio-equalizer.component.ts:54](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L54) | `AudioEqualizerComponent.bars`          | `inferred`         | `computed(() => { const count = this.barCount(); return Array.from({ length: count }).map((_, i) => ({ delay: '-${(i * 0.18) % 1}s', })); })` |
| [audio-equalizer.component.ts:6](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L6)   | `AudioEqualizerComponent host bindings` | Component metadata | `{ '[class]': 'customClass()', }`                                                                                                             |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

No local methods or accessors are declared.

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

| Reference                                                                                                                                                                               | Current expression                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [audio-room.component.html:198](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/audio-room/audio-room.component.html#L198) | `<app-audio-equalizer [isActive]="true" customClass="mt-2"></app-audio-equalizer>`                   |
| [audio-room.component.ts:16](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/audio-room/audio-room.component.ts#L16)       | `import { AudioEqualizerComponent } from '../primitives/audio-equalizer/audio-equalizer.component';` |
| [audio-room.component.ts:55](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/audio-room/audio-room.component.ts#L55)       | `AudioEqualizerComponent,`                                                                           |

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                                    | Imported API                     | Module          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------- |
| [audio-equalizer.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L1) | `{ Component, input, computed }` | `@angular/core` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                                      | Declaration                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [audio-equalizer.component.ts:7](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L7)   | `'[class]': 'customClass()',`                       |
| [audio-equalizer.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L11) | `class="flex items-end justify-center gap-0.5 h-5"` |
| [audio-equalizer.component.ts:12](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L12) | `[class.opacity-40]="!isActive()"`                  |
| [audio-equalizer.component.ts:16](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L16) | `class="w-1 rounded-t-sm bg-current"`               |
| [audio-equalizer.component.ts:17](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L17) | `[class.animate-eq]="isActive()"`                   |
| [audio-equalizer.component.ts:29](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L29) | `@keyframes eq {`                                   |
| [audio-equalizer.component.ts:31](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L31) | `height: 20%;`                                      |
| [audio-equalizer.component.ts:34](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L34) | `height: 100%;`                                     |
| [audio-equalizer.component.ts:38](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.ts#L38) | `animation: eq 0.6s ease-in-out infinite;`          |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                                                | Suite or case | Stated contract                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| [audio-equalizer.component.spec.ts:5](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.spec.ts#L5)   | `describe`    | AudioEqualizerComponent                                            |
| [audio-equalizer.component.spec.ts:19](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.spec.ts#L19) | `it`          | should create                                                      |
| [audio-equalizer.component.spec.ts:23](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.spec.ts#L23) | `it`          | should render 4 bars with default barCount                         |
| [audio-equalizer.component.spec.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.spec.ts#L28) | `it`          | should render each bar at 4px height when inactive (default)       |
| [audio-equalizer.component.spec.ts:36](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.spec.ts#L36) | `it`          | should not apply animate-eq class when isActive is false (default) |
| [audio-equalizer.component.spec.ts:41](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.spec.ts#L41) | `it`          | should compute bars with correct count from component API          |
| [audio-equalizer.component.spec.ts:46](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.spec.ts#L46) | `it`          | should default isActive to false                                   |
| [audio-equalizer.component.spec.ts:50](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/audio-equalizer/audio-equalizer.component.spec.ts#L50) | `it`          | should default customClass to empty string                         |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

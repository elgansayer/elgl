# Spartan / Relay mapping: components / primitives / lottie player

Issue: [#5577](https://github.com/elgansayer/elgl/issues/5577)

Target: `frontend/src/app/components/primitives/lottie-player`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                                     | SHA-256                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [lottie-player.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.spec.ts) | `892bb3b7793d4dde1184f81bc415b77c362b7060d4cd44fc4e649a6e746a2954` |
| [lottie-player.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts)           | `20eea554a7ea8220ef92a2ca753f4764f4a8f6c3bc018a28bbf9e244b2027f88` |

## Complete template element and control map

1 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                                | Element and presentation owner                 | Current attributes and bindings | Events and visible content | Migration target and constraint                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [lottie-player.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L14) | `div`; Native structure and Relay presentation | `class=w-full h-full`           | None                       | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |

## Conditional, repeated and deferred states

No Angular conditional/repeated/deferred block is declared in the inspected templates.

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                                | Member                                    | Type                    | Initialiser / binding summary     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------- | --------------------------------- |
| [lottie-player.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L18) | `LottiePlayerComponent.elRef`             | `inferred`              | `inject(ElementRef<HTMLElement>)` |
| [lottie-player.component.ts:19](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L19) | `LottiePlayerComponent.destroyRef`        | `inferred`              | `inject(DestroyRef)`              |
| [lottie-player.component.ts:21](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L21) | `LottiePlayerComponent.animationData`     | `inferred`              | `input.required<unknown>()`       |
| [lottie-player.component.ts:22](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L22) | `LottiePlayerComponent.loop`              | `inferred`              | `input<boolean>(true)`            |
| [lottie-player.component.ts:23](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L23) | `LottiePlayerComponent.autoplay`          | `inferred`              | `input<boolean>(true)`            |
| [lottie-player.component.ts:24](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L24) | `LottiePlayerComponent.speed`             | `inferred`              | `input<number>(1)`                |
| [lottie-player.component.ts:26](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L26) | `LottiePlayerComponent.animationComplete` | `inferred`              | `output<void>()`                  |
| [lottie-player.component.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L28) | `LottiePlayerComponent.animation`         | `AnimationItem \| null` | `null`                            |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

| Source                                                                                                                                                                                                | Method / accessor                          | Calls and delegated behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [lottie-player.component.ts:30](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L30) | `LottiePlayerComponent.constructor()`      | `this.destroyRef.onDestroy(() => this.destroyAnimation())`; `this.destroyAnimation()`; `afterNextRender({ read: () => { this.loadAnimation(); }, })`; `this.loadAnimation()`                                                                                                                                                                                                                                                                                       |
| [lottie-player.component.ts:40](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L40) | `LottiePlayerComponent.getAnimation()`     | No direct calls; inspect the linked body for local assignments/returns.                                                                                                                                                                                                                                                                                                                                                                                            |
| [lottie-player.component.ts:44](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L44) | `LottiePlayerComponent.loadAnimation()`    | `this.destroyAnimation()`; `this.elRef.nativeElement.querySelector('div')`; `this.animationData()`; `lottie.loadAnimation({ container: el as Element, renderer: 'svg', loop: this.loop(), autoplay: this.autoplay(), animationData: data, })`; `this.loop()`; `this.autoplay()`; `this.animation.setSpeed(this.speed())`; `this.speed()`; `this.animation.addEventListener('complete', () => { this.animationComplete.emit(); })`; `this.animationComplete.emit()` |
| [lottie-player.component.ts:66](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L66) | `LottiePlayerComponent.destroyAnimation()` | `this.animation.destroy()`                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

No class-name or selector reference was found outside this target in frontend source. Treat integration as unproven and verify reachability before a product migration.

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                                | Imported API                                                                     | Module          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------- |
| [lottie-player.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L1)   | `{ Component, input, inject, DestroyRef, ElementRef, output, afterNextRender, }` | `@angular/core` |
| [lottie-player.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L10) | `lottie, { AnimationItem }`                                                      | `lottie-web`    |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                                | Declaration                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [lottie-player.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L14) | `template: '<div class="w-full h-full"></div>',`                    |
| [lottie-player.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L15) | `styles: [':host { display: block; width: 100%; height: 100%; }'],` |
| [lottie-player.component.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.ts#L28) | `private animation: AnimationItem \| null = null;`                  |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                                          | Suite or case | Stated contract                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------- |
| [lottie-player.component.spec.ts:36](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.spec.ts#L36) | `describe`    | LottiePlayerComponent                                                       |
| [lottie-player.component.spec.ts:48](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.spec.ts#L48) | `it`          | should create and render a host container                                   |
| [lottie-player.component.spec.ts:54](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.spec.ts#L54) | `it`          | should load the animation with the provided data, loop, and autoplay inputs |
| [lottie-player.component.spec.ts:66](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.spec.ts#L66) | `it`          | should not call loadAnimation when animationData is not provided            |
| [lottie-player.component.spec.ts:74](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/lottie-player/lottie-player.component.spec.ts#L74) | `it`          | should destroy the previous animation instance on component destroy         |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

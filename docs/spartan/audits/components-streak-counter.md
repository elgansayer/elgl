# Spartan / Relay mapping: components / streak counter

Issue: [#5925](https://github.com/elgansayer/elgl/issues/5925)

Target: `frontend/src/app/components/streak-counter`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                             | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [streak-counter.component.html](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html)       | `43e6e49d19cd449e610aa62332864ffdee1973a7164206aca387ab5f65d36314` |
| [streak-counter.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.spec.ts) | `0da5f3c73f9addaef98c3f9276ee9776abeba588083f2933d091d44c964383dc` |
| [streak-counter.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.ts)           | `5a86f0e3bb96c28bb1f405500d505fabb2d6e0ba08867914b63822a6f7034c22` |

## Complete template element and control map

5 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                            | Element and presentation owner                     | Current attributes and bindings                                                                            | Events and visible content           | Migration target and constraint                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [streak-counter.component.html:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html#L1)   | `section`; Native structure and Relay presentation | `class=bg-surface-300 rounded-xl p-4 space-y-2`; `role=region`; `aria-label="{{ 'streak.counter' \| t }}"` | None                                 | `Keep semantic section; use Relay colour, radius and spacing tokens`; Preserve region semantics and associated ARIA relationships. |
| [streak-counter.component.html:6](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html#L6)   | `h2`; Native structure and Relay presentation      | `class=text-sm uppercase tracking-wider text-text-muted font-medium`                                       | Content: `{{ 'streak.title' \| t }}` | `Keep semantic h2; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.      |
| [streak-counter.component.html:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html#L9)   | `div`; Native structure and Relay presentation     | `class=flex items-center gap-3`                                                                            | None                                 | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.     |
| [streak-counter.component.html:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html#L10) | `span`; Native structure and Relay presentation    | `class=text-3xl font-bold text-accent`                                                                     | Content: `{{ streak() }}`            | `Keep semantic span; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.    |
| [streak-counter.component.html:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html#L11) | `span`; Native structure and Relay presentation    | `class=text-lg text-text-secondary`                                                                        | Content: `{{ 'streak.days' \| t }}`  | `Keep semantic span; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.    |

## Conditional, repeated and deferred states

No Angular conditional/repeated/deferred block is declared in the inspected templates.

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                        | Member                                   | Type       | Initialiser / binding summary |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------- | ----------------------------- |
| [streak-counter.component.ts:12](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.ts#L12) | `StreakCounterComponent.supabaseService` | `inferred` | `inject(SupabaseService)`     |
| [streak-counter.component.ts:13](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.ts#L13) | `StreakCounterComponent.authService`     | `inferred` | `inject(AuthService)`         |
| [streak-counter.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.ts#L14) | `StreakCounterComponent.streak`          | `inferred` | `signal<number>(0)`           |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

| Source                                                                                                                                                                                        | Method / accessor                      | Calls and delegated behaviour                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [streak-counter.component.ts:16](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.ts#L16) | `StreakCounterComponent.constructor()` | `this.loadStreak()`                                                                                             |
| [streak-counter.component.ts:20](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.ts#L20) | `StreakCounterComponent.loadStreak()`  | `this.authService.currentUser()`; `this.supabaseService.getDailyStreak(userId)`; `this.streak.set(streakCount)` |

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

No class-name or selector reference was found outside this target in frontend source. Treat integration as unproven and verify reachability before a product migration.

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                      | Imported API                    | Module                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------- |
| [streak-counter.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.ts#L1) | `{ Component, inject, signal }` | `@angular/core`                   |
| [streak-counter.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.ts#L2) | `{ SupabaseService }`           | `../../services/supabase.service` |
| [streak-counter.component.ts:3](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.ts#L3) | `{ AuthService }`               | `../../services/auth.service`     |
| [streak-counter.component.ts:4](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.ts#L4) | `{ TranslatePipe }`             | `../../services/translate.pipe`   |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                            | Declaration                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [streak-counter.component.html:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html#L2)   | `class="bg-surface-300 rounded-xl p-4 space-y-2"`                           |
| [streak-counter.component.html:6](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html#L6)   | `<h2 class="text-sm uppercase tracking-wider text-text-muted font-medium">` |
| [streak-counter.component.html:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html#L9)   | `<div class="flex items-center gap-3">`                                     |
| [streak-counter.component.html:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html#L10) | `<span class="text-3xl font-bold text-accent">{{ streak() }}</span>`        |
| [streak-counter.component.html:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.html#L11) | `<span class="text-lg text-text-secondary">{{ 'streak.days' \| t }}</span>` |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                                  | Suite or case | Stated contract                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------- |
| [streak-counter.component.spec.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.spec.ts#L15) | `describe`    | StreakCounterComponent                                |
| [streak-counter.component.spec.ts:44](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.spec.ts#L44) | `it`          | should create                                         |
| [streak-counter.component.spec.ts:52](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.spec.ts#L52) | `it`          | should display the daily streak                       |
| [streak-counter.component.spec.ts:62](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/streak-counter/streak-counter.component.spec.ts#L62) | `it`          | should not fetch the streak when no user is signed in |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

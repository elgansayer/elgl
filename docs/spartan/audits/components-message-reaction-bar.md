# Spartan / Relay mapping: components / message reaction bar

Issue: [#6343](https://github.com/elgansayer/elgl/issues/6343)

Target: `frontend/src/app/components/message-reaction-bar`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                                               | SHA-256                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [message-reaction-bar.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.spec.ts) | `5bdea48125220644f86cfa4920f21a9e266770f800897f205b4825bcc1dd5a5c` |
| [message-reaction-bar.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts)           | `e25234ad4d7fd365a0f49e37a7db6645d5549d881248f9c55b5d0a4e24d0827f` |

## Complete template element and control map

7 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                                          | Element and presentation owner                  | Current attributes and bindings                                                                                                                                                                                                                                                                                                                         | Events and visible content                 | Migration target and constraint                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| [message-reaction-bar.component.ts:8](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L8)   | `div`; Native structure and Relay presentation  | `class=mt-1 flex flex-wrap gap-1`                                                                                                                                                                                                                                                                                                                       | None                                       | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.  |
| [message-reaction-bar.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L10) | `button`; Installed Helm/Brain composition      | `hlmBtn=`; `type=button`; `variant=ghost`; `size=xs`; `class=rounded-full`; `[class.bg-primary/20]="reaction.users.includes(currentUserId())"`; `[class.text-primary]="reaction.users.includes(currentUserId())"`; `[attr.aria-pressed]="reaction.users.includes(currentUserId())"`; `[attr.aria-label]="reaction.emoji + ' ' + reaction.users.length"` | `(click)="toggleReaction(reaction.emoji)"` | `button, hlmBtn`; Preserve the existing primitive inputs and event order.                                                       |
| [message-reaction-bar.component.ts:22](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L22) | `span`; Native structure and Relay presentation | `aria-hidden=true`                                                                                                                                                                                                                                                                                                                                      | Content: `{{ reaction.emoji }}`            | `Keep semantic span; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |
| [message-reaction-bar.component.ts:23](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L23) | `span`; Native structure and Relay presentation | None                                                                                                                                                                                                                                                                                                                                                    | Content: `{{ reaction.users.length }}`     | `Keep semantic span; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |
| [message-reaction-bar.component.ts:26](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L26) | `div`; Native structure and Relay presentation  | `class=ms-1 flex gap-1`                                                                                                                                                                                                                                                                                                                                 | None                                       | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.  |
| [message-reaction-bar.component.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L28) | `button`; Installed Helm/Brain composition      | `hlmBtn=`; `type=button`; `variant=ghost`; `size=icon-xs`; `class=rounded-full opacity-60 hover:opacity-100`; `[attr.aria-label]="emoji"`                                                                                                                                                                                                               | `(click)="toggleReaction(emoji)"`          | `button, hlmBtn`; Preserve the existing primitive inputs and event order.                                                       |
| [message-reaction-bar.component.ts:37](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L37) | `span`; Native structure and Relay presentation | `aria-hidden=true`                                                                                                                                                                                                                                                                                                                                      | Content: `{{ emoji }}`                     | `Keep semantic span; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                                                          | Block          | Condition or collection | Identity contract      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------- | ---------------------- |
| [message-reaction-bar.component.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L9)   | `ForLoopBlock` | `getReactionEntries()`  | `track reaction.emoji` |
| [message-reaction-bar.component.ts:27](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L27) | `ForLoopBlock` | `quickEmojis`           | `track emoji`          |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                                          | Member                                      | Type       | Initialiser / binding summary                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| [message-reaction-bar.component.ts:45](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L45) | `MessageReactionBarComponent.reactions`     | `inferred` | `input<Record<string, string[]>>({})`                            |
| [message-reaction-bar.component.ts:46](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L46) | `MessageReactionBarComponent.currentUserId` | `inferred` | `input('')`                                                      |
| [message-reaction-bar.component.ts:47](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L47) | `MessageReactionBarComponent.messageId`     | `inferred` | `input('')`                                                      |
| [message-reaction-bar.component.ts:48](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L48) | `MessageReactionBarComponent.reacted`       | `inferred` | `output<{ messageId: string; emoji: string; added: boolean }>()` |
| [message-reaction-bar.component.ts:50](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L50) | `MessageReactionBarComponent.quickEmojis`   | `inferred` | `['❤️', '😂', '👍', '😮', '😢', '🙏']`                           |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

| Source                                                                                                                                                                                                          | Method / accessor                                           | Calls and delegated behaviour                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [message-reaction-bar.component.ts:52](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L52) | `MessageReactionBarComponent.getReactionEntries()`          | `this.reactions()`; `Object.entries(this.reactions()).map(([emoji, users]) => ({ emoji, users }))`; `Object.entries(this.reactions())`                                     |
| [message-reaction-bar.component.ts:57](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L57) | `MessageReactionBarComponent.toggleReaction(emoji: string)` | `this.reactions()`; `users.includes(this.currentUserId())`; `this.currentUserId()`; `this.reacted.emit({ messageId: this.messageId(), emoji, added })`; `this.messageId()` |

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

No class-name or selector reference was found outside this target in frontend source. Treat integration as unproven and verify reachability before a product migration.

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                                        | Imported API                   | Module                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------- |
| [message-reaction-bar.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L1) | `{ Component, input, output }` | `@angular/core`           |
| [message-reaction-bar.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L2) | `{ HlmButtonImports }`         | `@spartan-ng/helm/button` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                                          | Declaration                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [message-reaction-bar.component.ts:8](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L8)   | `<div class="mt-1 flex flex-wrap gap-1">`                          |
| [message-reaction-bar.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L15) | `class="rounded-full"`                                             |
| [message-reaction-bar.component.ts:17](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L17) | `[class.bg-primary/20]="reaction.users.includes(currentUserId())"` |
| [message-reaction-bar.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L18) | `[class.text-primary]="reaction.users.includes(currentUserId())"`  |
| [message-reaction-bar.component.ts:26](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L26) | `<div class="ms-1 flex gap-1">`                                    |
| [message-reaction-bar.component.ts:33](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.ts#L33) | `class="rounded-full opacity-60 hover:opacity-100"`                |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`, `Installed Helm/Brain composition`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                                                    | Suite or case | Stated contract             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------- |
| [message-reaction-bar.component.spec.ts:4](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.spec.ts#L4)   | `describe`    | MessageReactionBarComponent |
| [message-reaction-bar.component.spec.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/message-reaction-bar/message-reaction-bar.component.spec.ts#L18) | `it`          | should create               |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

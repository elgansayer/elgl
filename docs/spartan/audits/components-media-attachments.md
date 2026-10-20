# Spartan / Relay mapping: components / media attachments

Issue: [#6338](https://github.com/elgansayer/elgl/issues/6338)

Target: `frontend/src/app/components/media-attachments`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                                      | SHA-256                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [media-attachments.component.html](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html)       | `4004a372a6f3105478cb5afd87072a630d91e1c33dc9563c0809c03a4fec1488` |
| [media-attachments.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts) | `4962affba170a06e2c4b3fa30e9b336a07b58c2517484467c8b41c9ddb4156bf` |
| [media-attachments.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts)           | `98d4bc30faf8bf113ed39641278a751107999bb6f224fde3ef97161b56b6dbcf` |

## Complete template element and control map

5 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                                     | Element and presentation owner                 | Current attributes and bindings                                                  | Events and visible content      | Migration target and constraint                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [media-attachments.component.html:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L2)   | `p`; Native structure and Relay presentation   | `class=mt-2 whitespace-pre-wrap`                                                 | Content: `{{ message().text }}` | `Keep semantic p; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                                               |
| [media-attachments.component.html:6](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L6)   | `div`; Native structure and Relay presentation | `class=mt-2 mb-2`                                                                | None                            | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                                             |
| [media-attachments.component.html:7](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L7)   | `app-audio-player`; Existing product component | `[src]="voice.url"`; `[durationSec]="voice.durationSec"`                         | None                            | `AudioPlayerComponent (frontend/src/app/components/audio-player/audio-player.component.ts)`; Keep its input/output boundary; migrate generic interaction inside its owner. |
| [media-attachments.component.html:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L11) | `div`; Native structure and Relay presentation | `class=media-grid mt-2`                                                          | None                            | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                                             |
| [media-attachments.component.html:13](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L13) | `img`; Native structure and Relay presentation | `class=media-image`; `loading=lazy`; `[src]="img"`; `[alt]="'media.image' \| t"` | None                            | `Keep semantic img; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                                             |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                                                     | Block           | Condition or collection | Identity contract                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------- | -------------------------------------------- |
| [media-attachments.component.html:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L1)   | `IfBlockBranch` | `hasText()`             | Preserve branch identity and rendering order |
| [media-attachments.component.html:5](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L5)   | `IfBlockBranch` | `voiceNote()`           | Preserve branch identity and rendering order |
| [media-attachments.component.html:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L10) | `IfBlockBranch` | `showImages()`          | Preserve branch identity and rendering order |
| [media-attachments.component.html:12](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L12) | `ForLoopBlock`  | `images()`              | `track img`                                  |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                                 | Member                                 | Type       | Initialiser / binding summary                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ---------- | --------------------------------------------------------------- |
| [media-attachments.component.ts:37](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L37) | `MediaAttachmentsComponent.message`    | `inferred` | `input.required<MultiMediaMessage>()`                           |
| [media-attachments.component.ts:39](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L39) | `MediaAttachmentsComponent.images`     | `inferred` | `computed(() => (this.message().images ?? []).slice(0, 9))`     |
| [media-attachments.component.ts:40](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L40) | `MediaAttachmentsComponent.hasText`    | `inferred` | `computed(() => Boolean(this.message().text))`                  |
| [media-attachments.component.ts:41](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L41) | `MediaAttachmentsComponent.voiceNote`  | `inferred` | `computed(() => this.message().voiceNote ?? undefined)`         |
| [media-attachments.component.ts:42](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L42) | `MediaAttachmentsComponent.showImages` | `inferred` | `computed(() => !this.voiceNote() && this.images().length > 0)` |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

No local methods or accessors are declared.

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

No class-name or selector reference was found outside this target in frontend source. Treat integration as unproven and verify reachability before a product migration.

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                               | Imported API                     | Module                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------- |
| [media-attachments.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L1) | `{ Component, computed, input }` | `@angular/core`                          |
| [media-attachments.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L2) | `{ TranslatePipe }`              | `../../services/translate.pipe`          |
| [media-attachments.component.ts:3](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L3) | `{ AudioPlayerComponent }`       | `../audio-player/audio-player.component` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                                     | Declaration                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [media-attachments.component.html:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L2)   | `<p class="mt-2 whitespace-pre-wrap">{{ message().text }}</p>` |
| [media-attachments.component.html:6](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L6)   | `<div class="mt-2 mb-2">`                                      |
| [media-attachments.component.html:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L11) | `<div class="media-grid mt-2">`                                |
| [media-attachments.component.html:16](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.html#L16) | `class="media-image"`                                          |
| [media-attachments.component.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L28)     | `width: 100%;`                                                 |
| [media-attachments.component.ts:29](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L29)     | `height: 100%;`                                                |
| [media-attachments.component.ts:31](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.ts#L31)     | `border-radius: 0.5rem;`                                       |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`, `Existing product component`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                                             | Suite or case | Stated contract                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | -------------------------------------------------------------------- |
| [media-attachments.component.spec.ts:13](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L13)   | `describe`    | MediaAttachmentsComponent                                            |
| [media-attachments.component.spec.ts:33](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L33)   | `it`          | should create                                                        |
| [media-attachments.component.spec.ts:37](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L37)   | `it`          | should render text only                                              |
| [media-attachments.component.spec.ts:42](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L42)   | `it`          | should render images grid                                            |
| [media-attachments.component.spec.ts:51](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L51)   | `it`          | should not render text paragraph when text is absent                 |
| [media-attachments.component.spec.ts:60](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L60)   | `it`          | should cap the images grid at 9 images                               |
| [media-attachments.component.spec.ts:70](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L70)   | `it`          | should set the src and alt attributes on each rendered image         |
| [media-attachments.component.spec.ts:80](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L80)   | `it`          | should render a voice note with an audio player showing its duration |
| [media-attachments.component.spec.ts:95](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L95)   | `it`          | should not render the images grid when a voice note is present       |
| [media-attachments.component.spec.ts:106](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L106) | `it`          | should render text alongside a voice note                            |
| [media-attachments.component.spec.ts:117](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/media-attachments/media-attachments.component.spec.ts#L117) | `it`          | should render nothing when the message is empty                      |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

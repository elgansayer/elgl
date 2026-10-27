# Spartan / Relay mapping: components / primitives / input

Issue: [#5567](https://github.com/elgansayer/elgl/issues/5567)

Target: `frontend/src/app/components/primitives/input`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                             | SHA-256                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [input.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.spec.ts) | `b289848d5e31fb10d2917e7e030b7354bb18c2af357a91601e690fb292298172` |
| [input.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts)           | `3b2a064a36b0a4060594771eb39ca7200ab1f6ea66285d1be287c7797feed736` |

## Complete template element and control map

2 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                        | Element and presentation owner                   | Current attributes and bindings                                                                                                                                                                      | Events and visible content                                                          | Migration target and constraint                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [input.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L11) | `label`; Native structure and Relay presentation | `class=mb-1 block text-xs font-bold text-text-primary`; `[for]="inputId()"`                                                                                                                          | Content: `{{ label() \| t }}`                                                       | `Keep semantic label; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |
| [input.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L15) | `input`; Installed Helm/Brain composition        | `hlmInput=`; `[id]="inputId()"`; `[type]="type()"`; `[value]="value() ?? ''"`; `[placeholder]="placeholder() \| t"`; `[disabled]="disabled()"`; `[readOnly]="readonly()"`; `[class]="customClass()"` | `(input)="onInput($event)"`; `(blur)="onBlur($event)"`; `(focus)="onFocus($event)"` | `input, hlmInput`; Preserve the existing primitive inputs and event order.                                                       |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                        | Block           | Condition or collection | Identity contract                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------- | -------------------------------------------- |
| [input.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L10) | `IfBlockBranch` | `label()`               | Preserve branch identity and rendering order |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                        | Member                            | Type               | Initialiser / binding summary                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------ | --------------------------------------------------------------------- |
| [input.component.ts:34](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L34) | `AppInputComponent.value`         | `inferred`         | `input<string \| null \| undefined>('')`                              |
| [input.component.ts:35](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L35) | `AppInputComponent.placeholder`   | `inferred`         | `input<string>('')`                                                   |
| [input.component.ts:36](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L36) | `AppInputComponent.type`          | `inferred`         | `input<'text' \| 'email' \| 'password' \| 'number' \| 'url'>('text')` |
| [input.component.ts:37](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L37) | `AppInputComponent.disabled`      | `inferred`         | `input<boolean>(false)`                                               |
| [input.component.ts:38](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L38) | `AppInputComponent.readonly`      | `inferred`         | `input<boolean>(false)`                                               |
| [input.component.ts:39](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L39) | `AppInputComponent.label`         | `inferred`         | `input<string>('')`                                                   |
| [input.component.ts:40](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L40) | `AppInputComponent.inputId`       | `inferred`         | `input<string>('app-input-' + crypto.randomUUID())`                   |
| [input.component.ts:41](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L41) | `AppInputComponent.customClass`   | `inferred`         | `input<string>('')`                                                   |
| [input.component.ts:43](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L43) | `AppInputComponent.valueChange`   | `inferred`         | `output<string>()`                                                    |
| [input.component.ts:44](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L44) | `AppInputComponent.blurred`       | `inferred`         | `output<FocusEvent>()`                                                |
| [input.component.ts:45](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L45) | `AppInputComponent.focused`       | `inferred`         | `output<FocusEvent>()`                                                |
| [input.component.ts:29](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L29) | `AppInputComponent host bindings` | Component metadata | `{ '[class]': "'block w-full'", }`                                    |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

| Source                                                                                                                                                                        | Method / accessor                              | Calls and delegated behaviour                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| [input.component.ts:47](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L47) | `AppInputComponent.onInput(event: Event)`      | `this.disabled()`; `this.valueChange.emit(target.value)` |
| [input.component.ts:54](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L54) | `AppInputComponent.onBlur(event: FocusEvent)`  | `this.blurred.emit(event)`                               |
| [input.component.ts:58](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L58) | `AppInputComponent.onFocus(event: FocusEvent)` | `this.focused.emit(event)`                               |

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

| Reference                                                                                                                                                                                                    | Current expression                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [chat-room.component.ts:38](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-room/chat-room.component.ts#L38)                               | `import { AppInputComponent } from '../primitives/input/input.component';` |
| [chat-room.component.ts:67](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-room/chat-room.component.ts#L67)                               | `AppInputComponent,`                                                       |
| [developer-dashboard.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/developer-dashboard/developer-dashboard.component.ts#L14) | `import { AppInputComponent } from '../primitives/input/input.component';` |
| [developer-dashboard.component.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/developer-dashboard/developer-dashboard.component.ts#L28) | `AppInputComponent,`                                                       |
| [flashcard-deck.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/flashcard-deck/flashcard-deck.component.ts#L15)                | `import { AppInputComponent } from '../primitives/input/input.component';` |
| [flashcard-deck.component.ts:58](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/flashcard-deck/flashcard-deck.component.ts#L58)                | `AppInputComponent,`                                                       |
| [profile.component.ts:31](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/profile/profile.component.ts#L31)                                     | `import { AppInputComponent } from '../primitives/input/input.component';` |
| [profile.component.ts:62](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/profile/profile.component.ts#L62)                                     | `AppInputComponent,`                                                       |

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                      | Imported API                                            | Module                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| [input.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L1) | `{ Component, ChangeDetectionStrategy, input, output }` | `@angular/core`                    |
| [input.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L2) | `{ HlmInputImports }`                                   | `@spartan-ng/helm/input`           |
| [input.component.ts:3](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L3) | `{ TranslatePipe }`                                     | `../../../services/translate.pipe` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                        | Declaration                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [input.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L11) | `<label [for]="inputId()" class="mb-1 block text-xs font-bold text-text-primary">` |
| [input.component.ts:23](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L23) | `[class]="customClass()"`                                                          |
| [input.component.ts:30](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.ts#L30) | `'[class]': "'block w-full'",`                                                     |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`, `Installed Helm/Brain composition`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                    | Suite or case | Stated contract                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| [input.component.spec.ts:49](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.spec.ts#L49)   | `describe`    | AppInputComponent                                                                 |
| [input.component.spec.ts:65](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.spec.ts#L65)   | `it`          | should create and render label and input with correct attributes                  |
| [input.component.spec.ts:78](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.spec.ts#L78)   | `it`          | should generate a secure default input ID when none is provided                   |
| [input.component.spec.ts:89](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.spec.ts#L89)   | `it`          | should emit valueChange on input event when not disabled                          |
| [input.component.spec.ts:95](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.spec.ts#L95)   | `it`          | should emit focused and blurred events                                            |
| [input.component.spec.ts:103](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.spec.ts#L103) | `it`          | should apply owned Helm disabled semantics and not emit valueChange when disabled |
| [input.component.spec.ts:116](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/input/input.component.spec.ts#L116) | `it`          | should hide label when label signal is empty string                               |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

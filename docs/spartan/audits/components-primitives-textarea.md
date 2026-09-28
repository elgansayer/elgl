# Spartan / Relay mapping: components / primitives / textarea

Issue: [#5608](https://github.com/elgansayer/elgl/issues/5608)

Target: `frontend/src/app/components/primitives/textarea`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                      | SHA-256                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [textarea.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.spec.ts) | `456cea4a20b109cf48fae8293535eb3bbcde5aab06f61cee9c1d1d570f25fefc` |
| [textarea.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts)           | `2601fb21e963342a8787173b76646f3ac5026e434e5de334b5115c98535e5b6d` |

## Complete template element and control map

2 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                 | Element and presentation owner                   | Current attributes and bindings                                                                                                                                                                 | Events and visible content                                                          | Migration target and constraint                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [textarea.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L10) | `label`; Native structure and Relay presentation | `class=mb-1 block text-xs font-bold text-text-primary`; `[for]="textareaId()"`                                                                                                                  | Content: `{{ label() }}`                                                            | `Keep semantic label; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |
| [textarea.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L14) | `textarea`; Installed Helm/Brain composition     | `hlmTextarea=`; `[id]="textareaId()"`; `[rows]="rows()"`; `[value]="value()"`; `[placeholder]="placeholder()"`; `[disabled]="disabled()"`; `[readOnly]="readonly()"`; `[class]="customClass()"` | `(input)="onInput($event)"`; `(blur)="onBlur($event)"`; `(focus)="onFocus($event)"` | `textarea, hlmTextarea`; Preserve the existing primitive inputs and event order.                                                 |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                               | Block           | Condition or collection | Identity contract                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ----------------------- | -------------------------------------------- |
| [textarea.component.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L9) | `IfBlockBranch` | `label()`               | Preserve branch identity and rendering order |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                 | Member                               | Type               | Initialiser / binding summary                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------ | ------------------------------------------------------ |
| [textarea.component.ts:33](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L33) | `AppTextareaComponent.value`         | `inferred`         | `input<string>('')`                                    |
| [textarea.component.ts:34](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L34) | `AppTextareaComponent.placeholder`   | `inferred`         | `input<string>('')`                                    |
| [textarea.component.ts:35](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L35) | `AppTextareaComponent.rows`          | `inferred`         | `input<number>(3)`                                     |
| [textarea.component.ts:36](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L36) | `AppTextareaComponent.disabled`      | `inferred`         | `input<boolean>(false)`                                |
| [textarea.component.ts:37](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L37) | `AppTextareaComponent.readonly`      | `inferred`         | `input<boolean>(false)`                                |
| [textarea.component.ts:38](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L38) | `AppTextareaComponent.label`         | `inferred`         | `input<string>('')`                                    |
| [textarea.component.ts:39](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L39) | `AppTextareaComponent.textareaId`    | `inferred`         | `input<string>('app-textarea-' + crypto.randomUUID())` |
| [textarea.component.ts:40](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L40) | `AppTextareaComponent.customClass`   | `inferred`         | `input<string>('')`                                    |
| [textarea.component.ts:42](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L42) | `AppTextareaComponent.valueChange`   | `inferred`         | `output<string>()`                                     |
| [textarea.component.ts:43](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L43) | `AppTextareaComponent.blurred`       | `inferred`         | `output<FocusEvent>()`                                 |
| [textarea.component.ts:44](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L44) | `AppTextareaComponent.focused`       | `inferred`         | `output<FocusEvent>()`                                 |
| [textarea.component.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L28) | `AppTextareaComponent host bindings` | Component metadata | `{ '[class]': "'block w-full'", }`                     |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

| Source                                                                                                                                                                                 | Method / accessor                                 | Calls and delegated behaviour                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| [textarea.component.ts:46](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L46) | `AppTextareaComponent.onInput(event: Event)`      | `this.disabled()`; `this.valueChange.emit(target.value)` |
| [textarea.component.ts:53](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L53) | `AppTextareaComponent.onBlur(event: FocusEvent)`  | `this.blurred.emit(event)`                               |
| [textarea.component.ts:57](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L57) | `AppTextareaComponent.onFocus(event: FocusEvent)` | `this.focused.emit(event)`                               |

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

| Reference                                                                                                                                                                                                 | Current expression                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [profile.component.ts:32](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/profile/profile.component.ts#L32)                                  | `import { AppTextareaComponent } from '../primitives/textarea/textarea.component';` |
| [profile.component.ts:63](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/profile/profile.component.ts#L63)                                  | `AppTextareaComponent,`                                                             |
| [suggest-flashcards.component.ts:21](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/suggest-flashcards/suggest-flashcards.component.ts#L21) | `import { AppTextareaComponent } from '../primitives/textarea/textarea.component';` |
| [suggest-flashcards.component.ts:32](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/suggest-flashcards/suggest-flashcards.component.ts#L32) | `AppTextareaComponent,`                                                             |

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                               | Imported API                                            | Module                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------- |
| [textarea.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L1) | `{ Component, ChangeDetectionStrategy, input, output }` | `@angular/core`             |
| [textarea.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L2) | `{ HlmTextareaImports }`                                | `@spartan-ng/helm/textarea` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                 | Declaration                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [textarea.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L10) | `<label [for]="textareaId()" class="mb-1 block text-xs font-bold text-text-primary">` |
| [textarea.component.ts:22](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L22) | `[class]="customClass()"`                                                             |
| [textarea.component.ts:29](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.ts#L29) | `'[class]': "'block w-full'",`                                                        |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`, `Installed Helm/Brain composition`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                             | Suite or case | Stated contract                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| [textarea.component.spec.ts:49](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.spec.ts#L49)   | `describe`    | AppTextareaComponent                                                              |
| [textarea.component.spec.ts:65](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.spec.ts#L65)   | `it`          | should create and render label and textarea with correct attributes               |
| [textarea.component.spec.ts:78](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.spec.ts#L78)   | `it`          | should generate a secure default textarea ID when none is provided                |
| [textarea.component.spec.ts:90](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.spec.ts#L90)   | `it`          | should emit valueChange on input event when not disabled                          |
| [textarea.component.spec.ts:96](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.spec.ts#L96)   | `it`          | should emit focused and blurred events                                            |
| [textarea.component.spec.ts:104](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.spec.ts#L104) | `it`          | should apply owned Helm disabled semantics and not emit valueChange when disabled |
| [textarea.component.spec.ts:117](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/textarea/textarea.component.spec.ts#L117) | `it`          | should hide label when label signal is empty string                               |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

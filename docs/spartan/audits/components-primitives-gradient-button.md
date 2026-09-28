# Spartan / Relay mapping: components / primitives / gradient button

Issue: [#5562](https://github.com/elgansayer/elgl/issues/5562)

Target: `frontend/src/app/components/primitives/gradient-button`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                                           | SHA-256                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [gradient-button.component.spec.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.spec.ts) | `2d8ebeddbae2bddbe88ac3f44ccc3ec8e2385dd9ab48de620c54d3afe000b0c3` |
| [gradient-button.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts)           | `c2cc6e227859e73b48d2a56ece99b118b0f4b129391212c8a0e6464c18bc1be4` |

## Complete template element and control map

2 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                                      | Element and presentation owner             | Current attributes and bindings                                                                                                                        | Events and visible content  | Migration target and constraint                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------- |
| [gradient-button.component.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L9)   | `button`; Installed Helm/Brain composition | `hlmBtn=`; `variant=ghost`; `[size]="helmSize()"`; `[disabled]="disabled()"`; `[class]="buttonClasses()"`; `[attr.aria-label]="ariaLabel() \|\| null"` | `(click)="onClick($event)"` | `button, hlmBtn`; Preserve the existing primitive inputs and event order.                   |
| [gradient-button.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L18) | `ng-content`; Angular composition boundary | None                                                                                                                                                   | None                        | `Retain projection/template contract`; Projected content retains its own interaction owner. |

## Conditional, repeated and deferred states

No Angular conditional/repeated/deferred block is declared in the inspected templates.

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                                      | Member                                     | Type               | Initialiser / binding summary                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [gradient-button.component.ts:26](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L26) | `AppGradientButtonComponent.size`          | `inferred`         | `input<'sm' \| 'md' \| 'icon'>('md')`                                                                                                                                                                                                                                                      |
| [gradient-button.component.ts:27](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L27) | `AppGradientButtonComponent.disabled`      | `inferred`         | `input<boolean>(false)`                                                                                                                                                                                                                                                                    |
| [gradient-button.component.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L28) | `AppGradientButtonComponent.customClass`   | `inferred`         | `input<string>('')`                                                                                                                                                                                                                                                                        |
| [gradient-button.component.ts:29](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L29) | `AppGradientButtonComponent.ariaLabel`     | `inferred`         | `input<string>('')`                                                                                                                                                                                                                                                                        |
| [gradient-button.component.ts:30](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L30) | `AppGradientButtonComponent.clicked`       | `inferred`         | `output<MouseEvent>()`                                                                                                                                                                                                                                                                     |
| [gradient-button.component.ts:32](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L32) | `AppGradientButtonComponent.helmSize`      | `inferred`         | `computed(() => { if (this.size() === 'icon') return 'icon-touch' as const; return this.size() === 'md' ? ('touch' as const) : ('sm' as const); })`                                                                                                                                        |
| [gradient-button.component.ts:37](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L37) | `AppGradientButtonComponent.buttonClasses` | `inferred`         | `computed(() => { const product = this.disabled() ? 'rounded-pill bg-surface-300 text-text-muted opacity-50' : 'rounded-pill bg-gradient-to-r from-vip to-accent text-on-fill hover:opacity-90 shadow-lift'; return '${product}${this.customClass() ? ' ${this.customClass()}' : ''}'; })` |
| [gradient-button.component.ts:21](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L21) | `AppGradientButtonComponent host bindings` | Component metadata | `{ '[class]': "'inline-block'", }`                                                                                                                                                                                                                                                         |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

| Source                                                                                                                                                                                                      | Method / accessor                                       | Calls and delegated behaviour                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| [gradient-button.component.ts:44](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L44) | `AppGradientButtonComponent.onClick(event: MouseEvent)` | `this.disabled()`; `this.clicked.emit(event)` |

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

| Reference                                                                                                                                                                                      | Current expression                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [discovery.component.ts:35](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/discovery/discovery.component.ts#L35)                 | `import { AppGradientButtonComponent } from '../primitives/gradient-button/gradient-button.component';`               |
| [discovery.component.ts:76](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/discovery/discovery.component.ts#L76)                 | `AppGradientButtonComponent,`                                                                                         |
| [video-call.component.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/video-call/video-call.component.ts#L28)              | `import { AppGradientButtonComponent } from '../primitives/gradient-button/gradient-button.component';`               |
| [video-call.component.ts:38](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/video-call/video-call.component.ts#L38)              | `AppGradientButtonComponent,`                                                                                         |
| [subscription-page.component.ts:8](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/pages/subscription/subscription-page.component.ts#L8)     | `import { AppGradientButtonComponent } from '../../components/primitives/gradient-button/gradient-button.component';` |
| [subscription-page.component.ts:25](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/pages/subscription/subscription-page.component.ts#L25)   | `AppGradientButtonComponent,`                                                                                         |
| [vip-subscription.component.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/pages/vip-subscription/vip-subscription.component.ts#L9)   | `import { AppGradientButtonComponent } from '../../components/primitives/gradient-button/gradient-button.component';` |
| [vip-subscription.component.ts:21](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/pages/vip-subscription/vip-subscription.component.ts#L21) | `AppGradientButtonComponent,`                                                                                         |

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                                    | Imported API                                                      | Module                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------- |
| [gradient-button.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L1) | `{ Component, ChangeDetectionStrategy, input, output, computed }` | `@angular/core`           |
| [gradient-button.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L2) | `{ HlmButtonImports }`                                            | `@spartan-ng/helm/button` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                                      | Declaration                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [gradient-button.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L14) | `[class]="buttonClasses()"`                                                                       |
| [gradient-button.component.ts:22](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L22) | `'[class]': "'inline-block'",`                                                                    |
| [gradient-button.component.ts:39](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L39) | `? 'rounded-pill bg-surface-300 text-text-muted opacity-50'`                                      |
| [gradient-button.component.ts:40](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L40) | `: 'rounded-pill bg-gradient-to-r from-vip to-accent text-on-fill hover:opacity-90 shadow-lift';` |

## Migration risks and prerequisite work

| Evidence                                                                                                                                                                                                  | Observed pattern            | Required decision / safeguard                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| [gradient-button.component.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.ts#L9) | Button has no explicit type | Check host form context before migration; avoid introducing implicit submit actions. |

The mapping uses these ownership categories: `Installed Helm/Brain composition`, `Angular composition boundary`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

| Source                                                                                                                                                                                                                | Suite or case | Stated contract                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- |
| [gradient-button.component.spec.ts:31](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.spec.ts#L31) | `describe`    | AppGradientButtonComponent                                            |
| [gradient-button.component.spec.ts:47](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.spec.ts#L47) | `it`          | should create and render projected content inside inner button        |
| [gradient-button.component.spec.ts:52](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.spec.ts#L52) | `it`          | should apply product gradient styles on the owned Helm touch size     |
| [gradient-button.component.spec.ts:62](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.spec.ts#L62) | `it`          | should emit clicked event when clicked and not disabled               |
| [gradient-button.component.spec.ts:67](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.spec.ts#L67) | `it`          | should not emit clicked when disabled                                 |
| [gradient-button.component.spec.ts:75](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.spec.ts#L75) | `it`          | should expose native and product disabled semantics                   |
| [gradient-button.component.spec.ts:84](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.spec.ts#L84) | `it`          | should not set an aria-label attribute by default                     |
| [gradient-button.component.spec.ts:88](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/primitives/gradient-button/gradient-button.component.spec.ts#L88) | `it`          | should expose an accessible name via aria-label for icon-only buttons |

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.

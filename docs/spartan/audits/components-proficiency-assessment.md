# Spartan / Relay mapping: components / proficiency assessment

Issue: [#5629](https://github.com/elgansayer/elgl/issues/5629)

Target: `frontend/src/app/components/proficiency-assessment`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                                           | SHA-256                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [proficiency-assessment.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts) | `9645352b3484e705c26c943e07fa93dc3210c675ac91255adeb854fa7ced80b8` |

## Complete template element and control map

8 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                                                | Element and presentation owner                    | Current attributes and bindings                                                                   | Events and visible content                                                | Migration target and constraint                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [proficiency-assessment.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L11) | `div`; Native structure and Relay presentation    | `class=ps-4 pe-4 pt-4 pb-4 bg-surface-200 text-text-primary rounded-lg`                           | None                                                                      | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                    |
| [proficiency-assessment.component.ts:12](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L12) | `h2`; Native structure and Relay presentation     | `class=text-xl font-bold mb-4`                                                                    | Content: `{{ 'proficiency.title' \| t }}`                                 | `Keep semantic h2; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                     |
| [proficiency-assessment.component.ts:13](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L13) | `p`; Native structure and Relay presentation      | `class=mb-3`                                                                                      | Content: `{{ 'proficiency.instruction' \| t }}`                           | `Keep semantic p; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                      |
| [proficiency-assessment.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L15) | `label`; Native structure and Relay presentation  | `class=block mb-2`; `for=scoreSlider`                                                             | Content: `{{ 'proficiency.scoreLabel' \| t }}: {{ scoreValue() }}`        | `Keep semantic label; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                  |
| [proficiency-assessment.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L18) | `input`; Native field / Spartan slider capability | `id=scoreSlider`; `type=range`; `min=0`; `max=100`; `class=w-full mb-4`; `[value]="scoreValue()"` | `(input)="scoreValue.set(+$any($event.target).value)"`                    | `Confirm slider via Spartan CLI with field/label composition`; Preserve value type, change timing, validation and accessible field relationships. |
| [proficiency-assessment.component.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L28) | `button`; Installed Helm/Brain composition        | `hlmBtn=`; `class=bg-primary text-on-fill px-6 py-2 rounded-lg`                                   | `(click)="submitAssessment()"` Content: `{{ 'proficiency.submit' \| t }}` | `button, hlmBtn`; Preserve the existing primitive inputs and event order.                                                                         |
| [proficiency-assessment.component.ts:37](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L37) | `div`; Native structure and Relay presentation    | `class=mt-4 p-3 bg-surface-100 rounded`                                                           | None                                                                      | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                    |
| [proficiency-assessment.component.ts:38](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L38) | `p`; Native structure and Relay presentation      | None                                                                                              | Content: `{{ 'proficiency.result' \| t: { level: level } }}`              | `Keep semantic p; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                      |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                                                                | Block           | Condition or collection | Identity contract                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------- | -------------------------------------------- |
| [proficiency-assessment.component.ts:36](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L36) | `IfBlockBranch` | `resultLevel()`         | Preserve branch identity and rendering order |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                                                | Member                                       | Type       | Initialiser / binding summary  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------- | ------------------------------ |
| [proficiency-assessment.component.ts:46](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L46) | `ProficiencyAssessmentComponent.userService` | `inferred` | `inject(UserService)`          |
| [proficiency-assessment.component.ts:48](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L48) | `ProficiencyAssessmentComponent.scoreValue`  | `inferred` | `signal<number>(50)`           |
| [proficiency-assessment.component.ts:49](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L49) | `ProficiencyAssessmentComponent.resultLevel` | `inferred` | `signal<string \| null>(null)` |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

| Source                                                                                                                                                                                                                | Method / accessor                                   | Calls and delegated behaviour                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [proficiency-assessment.component.ts:51](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L51) | `ProficiencyAssessmentComponent.submitAssessment()` | `this.userService.assessProficiency(this.scoreValue())`; `this.scoreValue()`; `this.resultLevel.set(level)` |

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

| Reference                                                                                                                                                | Current expression                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [learning.routes.ts:55](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/routes/learning.routes.ts#L55) | `(m) => m.ProficiencyAssessmentComponent,` |

Declared route entries below record local path segments and their guards/data. Parent lazy-route mounts may add a prefix; retain the route composition in the linked source.

| Route source                                                                                                                                             | Declared contract                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [learning.routes.ts:51](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/routes/learning.routes.ts#L51) | `path: 'proficiency'`; `loadComponent: () => import('../components/proficiency-assessment/proficiency-assessment.component').then( (m) => m.ProficiencyAssessmentComponent, )` |

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                                              | Imported API                    | Module                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------- |
| [proficiency-assessment.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L1) | `{ HlmButton }`                 | `@spartan-ng/helm/button`       |
| [proficiency-assessment.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L2) | `{ Component, inject, signal }` | `@angular/core`                 |
| [proficiency-assessment.component.ts:3](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L3) | `{ FormsModule }`               | `@angular/forms`                |
| [proficiency-assessment.component.ts:4](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L4) | `{ TranslatePipe }`             | `../../services/translate.pipe` |
| [proficiency-assessment.component.ts:5](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L5) | `{ UserService }`               | `../../services/user.service`   |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                                                | Declaration                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [proficiency-assessment.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L11) | `<div class="ps-4 pe-4 pt-4 pb-4 bg-surface-200 text-text-primary rounded-lg">` |
| [proficiency-assessment.component.ts:12](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L12) | `<h2 class="text-xl font-bold mb-4">{{ 'proficiency.title' \| t }}</h2>`        |
| [proficiency-assessment.component.ts:13](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L13) | `<p class="mb-3">{{ 'proficiency.instruction' \| t }}</p>`                      |
| [proficiency-assessment.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L15) | `<label class="block mb-2" for="scoreSlider">`                                  |
| [proficiency-assessment.component.ts:25](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L25) | `class="w-full mb-4"`                                                           |
| [proficiency-assessment.component.ts:30](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L30) | `class="bg-primary text-on-fill px-6 py-2 rounded-lg"`                          |
| [proficiency-assessment.component.ts:37](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L37) | `<div class="mt-4 p-3 bg-surface-100 rounded">`                                 |

## Migration risks and prerequisite work

| Evidence                                                                                                                                                                                                              | Observed pattern            | Required decision / safeguard                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| [proficiency-assessment.component.ts:28](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/proficiency-assessment/proficiency-assessment.component.ts#L28) | Button has no explicit type | Check host form context before migration; avoid introducing implicit submit actions. |

The mapping uses these ownership categories: `Native structure and Relay presentation`, `Native field / Spartan slider capability`, `Installed Helm/Brain composition`.

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

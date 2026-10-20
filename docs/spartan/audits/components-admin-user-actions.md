# Spartan / Relay mapping: components / admin user actions

Issue: [#5826](https://github.com/elgansayer/elgl/issues/5826)

Target: `frontend/src/app/components/admin-user-actions`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                               | SHA-256                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [admin-user-actions.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts) | `ba6598eb2457ebb8b516c374e019e14c66f3751af08487f2d8308eb0f7a34ea8` |

## Complete template element and control map

3 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                                    | Element and presentation owner                 | Current attributes and bindings    | Events and visible content               | Migration target and constraint                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [admin-user-actions.component.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L9)   | `div`; Native structure and Relay presentation | `class=flex gap-2`                 | None                                     | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |
| [admin-user-actions.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L10) | `button`; Installed Helm/Brain composition     | `hlmBtn=`; `class=btn btn-danger`  | `(click)="handleBan()"` Content: `Ban`   | `button, hlmBtn`; Preserve the existing primitive inputs and event order.                                                      |
| [admin-user-actions.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L11) | `button`; Installed Helm/Brain composition     | `hlmBtn=`; `class=btn btn-warning` | `(click)="handleWarn()"` Content: `Warn` | `button, hlmBtn`; Preserve the existing primitive inputs and event order.                                                      |

## Conditional, repeated and deferred states

No Angular conditional/repeated/deferred block is declared in the inspected templates.

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                                    | Member                                   | Type       | Initialiser / binding summary |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------- | ----------------------------- |
| [admin-user-actions.component.ts:16](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L16) | `AdminUserActionsComponent.userId`       | `inferred` | `input.required<string>()`    |
| [admin-user-actions.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L18) | `AdminUserActionsComponent.adminService` | `inferred` | `inject(AdminService)`        |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

| Source                                                                                                                                                                                                    | Method / accessor                        | Calls and delegated behaviour                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [admin-user-actions.component.ts:20](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L20) | `AdminUserActionsComponent.handleBan()`  | `this.userId()`; `this.adminService.banUser(this.userId())`; `console.warn('Ban failed', error)`   |
| [admin-user-actions.component.ts:30](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L30) | `AdminUserActionsComponent.handleWarn()` | `this.userId()`; `this.adminService.warnUser(this.userId())`; `console.warn('Warn failed', error)` |

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

No class-name or selector reference was found outside this target in frontend source. Treat integration as unproven and verify reachability before a product migration.

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                                  | Imported API                   | Module                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| [admin-user-actions.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L1) | `{ HlmButton }`                | `@spartan-ng/helm/button`      |
| [admin-user-actions.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L2) | `{ Component, input, inject }` | `@angular/core`                |
| [admin-user-actions.component.ts:3](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L3) | `{ AdminService }`             | `../../services/admin.service` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                                    | Declaration                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [admin-user-actions.component.ts:9](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L9)   | `<div class="flex gap-2">`                                                    |
| [admin-user-actions.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L10) | `<button hlmBtn (click)="handleBan()" class="btn btn-danger">Ban</button>`    |
| [admin-user-actions.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L11) | `<button hlmBtn (click)="handleWarn()" class="btn btn-warning">Warn</button>` |

## Migration risks and prerequisite work

| Evidence                                                                                                                                                                                                  | Observed pattern              | Required decision / safeguard                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [admin-user-actions.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L10) | Literal visible text or label | `Ban` requires an i18n/content review. Translate product copy; preserve intentional user data and technical values.  |
| [admin-user-actions.component.ts:10](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L10) | Button has no explicit type   | Check host form context before migration; avoid introducing implicit submit actions.                                 |
| [admin-user-actions.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L11) | Literal visible text or label | `Warn` requires an i18n/content review. Translate product copy; preserve intentional user data and technical values. |
| [admin-user-actions.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-user-actions/admin-user-actions.component.ts#L11) | Button has no explicit type   | Check host form context before migration; avoid introducing implicit submit actions.                                 |

The mapping uses these ownership categories: `Native structure and Relay presentation`, `Installed Helm/Brain composition`.

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

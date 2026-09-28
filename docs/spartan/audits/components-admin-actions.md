# Spartan / Relay mapping: components / admin actions

Issue: [#5806](https://github.com/elgansayer/elgl/issues/5806)

Target: `frontend/src/app/components/admin-actions`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                                | SHA-256                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [admin-actions.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts) | `bbb8814915cdcdffacd3da84bf417ae04e32e1d33f0bef838fbcb8225e89a6e9` |

## Complete template element and control map

7 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                                     | Element and presentation owner                  | Current attributes and bindings                                                                                                                    | Events and visible content                                      | Migration target and constraint                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [admin-actions.component.ts:13](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L13) | `div`; Native structure and Relay presentation  | `class=m-4`; `role=region`; `[attr.aria-label]="'admin.quickModerationAria' \| t"`                                                                 | None                                                            | `Keep semantic div; use Relay colour, radius and spacing tokens`; Preserve region semantics and associated ARIA relationships.  |
| [admin-actions.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L14) | `h2`; Native structure and Relay presentation   | None                                                                                                                                               | Content: `{{ 'admin.quickModeration' \| t }}`                   | `Keep semantic h2; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.   |
| [admin-actions.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L15) | `ul`; Native structure and Relay presentation   | `role=list`; `class=space-y-2`                                                                                                                     | None                                                            | `Keep semantic ul; use Relay colour, radius and spacing tokens`; Preserve list semantics and associated ARIA relationships.     |
| [admin-actions.component.ts:17](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L17) | `li`; Native structure and Relay presentation   | `class=flex flex-wrap items-center gap-2`                                                                                                          | None                                                            | `Keep semantic li; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.   |
| [admin-actions.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L18) | `span`; Native structure and Relay presentation | `class=me-auto`                                                                                                                                    | Content: `{{ (user.display_name ?? user.id) \| sanitiseHtml }}` | `Keep semantic span; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone. |
| [admin-actions.component.ts:19](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L19) | `button`; Installed Helm/Brain composition      | `hlmBtn=`; `type=button`; `variant=destructive`; `size=sm`; `[attr.aria-label]="'admin.banUserAria' \| t: { name: user.display_name ?? user.id }"` | `(click)="ban(user.id)"` Content: `{{ 'admin.banBtn' \| t }}`   | `button, hlmBtn`; Preserve the existing primitive inputs and event order.                                                       |
| [admin-actions.component.ts:29](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L29) | `button`; Installed Helm/Brain composition      | `hlmBtn=`; `type=button`; `variant=secondary`; `size=sm`; `[attr.aria-label]="'admin.warnUserAria' \| t: { name: user.display_name ?? user.id }"`  | `(click)="warn(user.id)"` Content: `{{ 'admin.warnBtn' \| t }}` | `button, hlmBtn`; Preserve the existing primitive inputs and event order.                                                       |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                                     | Block          | Condition or collection | Identity contract |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ----------------------- | ----------------- |
| [admin-actions.component.ts:16](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L16) | `ForLoopBlock` | `users()`               | `track user.id`   |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                                     | Member                                | Type       | Initialiser / binding summary                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [admin-actions.component.ts:46](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L46) | `AdminActionsComponent.adminService`  | `inferred` | `inject(AdminService)`                                                                                                                                                   |
| [admin-actions.component.ts:47](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L47) | `AdminActionsComponent.i18n`          | `inferred` | `inject(I18nService)`                                                                                                                                                    |
| [admin-actions.component.ts:49](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L49) | `AdminActionsComponent.usersResource` | `inferred` | `resource({ params: () => ({ page: 1, pageSize: 10, search: '' }), loader: ({ params }) => this.adminService.listUsers(params.search, params.page, params.pageSize), })` |
| [admin-actions.component.ts:54](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L54) | `AdminActionsComponent.users`         | `inferred` | `computed(() => this.usersResource.value()?.users ?? [])`                                                                                                                |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

| Source                                                                                                                                                                                     | Method / accessor                            | Calls and delegated behaviour                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [admin-actions.component.ts:56](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L56) | `AdminActionsComponent.ban(userId: string)`  | `this.adminService.banUser(userId)`; `showToast(this.i18n.translate('admin.userBanned'), 'success')`; `this.i18n.translate('admin.userBanned')`; `showErrorToast(this.i18n.translate('admin.banFailed'))`; `this.i18n.translate('admin.banFailed')`                |
| [admin-actions.component.ts:65](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L65) | `AdminActionsComponent.warn(userId: string)` | `this.adminService.warnUser(userId)`; `showToast(this.i18n.translate('admin.warningIssued'), 'success')`; `this.i18n.translate('admin.warningIssued')`; `showErrorToast(this.i18n.translate('admin.warningFailed'))`; `this.i18n.translate('admin.warningFailed')` |

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

No class-name or selector reference was found outside this target in frontend source. Treat integration as unproven and verify reachability before a product migration.

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                                   | Imported API                                | Module                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------- |
| [admin-actions.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L1) | `{ Component, inject, resource, computed }` | `@angular/core`                  |
| [admin-actions.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L2) | `{ HlmButtonImports }`                      | `@spartan-ng/helm/button`        |
| [admin-actions.component.ts:3](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L3) | `{ TranslatePipe }`                         | `../../services/translate.pipe`  |
| [admin-actions.component.ts:4](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L4) | `{ SanitiseHtmlPipe }`                      | `../../pipes/sanitise-html.pipe` |
| [admin-actions.component.ts:5](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L5) | `{ AdminService }`                          | `../../services/admin.service`   |
| [admin-actions.component.ts:6](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L6) | `{ I18nService }`                           | `../../services/i18n.service`    |
| [admin-actions.component.ts:7](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L7) | `{ showToast, showErrorToast }`             | `../../services/toast.service`   |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                                     | Declaration                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [admin-actions.component.ts:13](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L13) | `<div class="m-4" role="region" [attr.aria-label]="'admin.quickModerationAria' \| t">` |
| [admin-actions.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L15) | `<ul role="list" class="space-y-2">`                                                   |
| [admin-actions.component.ts:17](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L17) | `<li class="flex flex-wrap items-center gap-2">`                                       |
| [admin-actions.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/admin-actions/admin-actions.component.ts#L18) | `<span class="me-auto">{{ (user.display_name ?? user.id) \| sanitiseHtml }}</span>`    |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

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

# Escrow payments Spartan / Relay audit

Issue: #6173 (`Spartan UI 0391`)

Target: `frontend/src/app/components/escrow-payments`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for the `components/escrow-payments` Spartan UI + Relay migration sequence (#6174 through #6177).

The audit covers every current control, state, side effect, route relationship, accessibility concern, RTL/i18n requirement, theme/responsive requirement and migration risk in `EscrowPaymentsComponent`. It also records a major ownership concern discovered during the audit: the production `/escrow` route currently lazy-loads `pages/escrow/EscrowComponent`, while repository search finds no production consumer of `app-escrow-payments` or `EscrowPaymentsComponent` outside this target and its spec.

The migration must therefore avoid creating a second fully maintained escrow list experience by accident. Before #6174 changes runtime behavior, confirm whether this target is intentionally retained. If it is dead compatibility code, deletion/consolidation into the canonical `/escrow` page is preferable to independently migrating two surfaces. If it is retained for a future embedding contract, use the mappings below and keep its feature/service behavior aligned with the canonical page.

This audit does not change escrow APIs, offline queue semantics, financial authorization rules, route ownership, onboarding product behavior or visual output.

## Current surface and ownership context

`EscrowPaymentsComponent` is an Angular standalone component with external HTML and no component stylesheet.

It imports:

- Spartan Helm `HlmButton`;
- Angular `FormsModule` and `DatePipe`;
- the repository `TranslatePipe`;
- `EscrowService` for escrow reads/mutations and offline synchronization;
- `NetworkStatusService` for connectivity state;
- `Location` for browser-history Back behavior;
- `EscrowOnboardingService` for the Help/onboarding action;
- `I18nService` for imperative success/error strings;
- `showToast()` for the automatic onboarding hint.

It also injects `HttpClient` and `AuthService`, but neither is used by the component. Authentication and HTTP ownership are already encapsulated by `EscrowService`.

The target renders:

1. an optional offline alert banner;
2. an optional Sync pending operations button;
3. a Back icon button;
4. the page heading;
5. a Help/onboarding icon button;
6. six status-filter pill buttons;
7. a loading spinner state;
8. an empty state;
9. a list of escrow transaction cards;
10. a status badge and coin amount per card;
11. Release, Refund and Dispute action buttons for pending escrows;
12. no dialog, popover, menu, select, combobox or form field;
13. no rendered success message despite `successMessage` state;
14. no rendered error message despite `error` state.

## Canonical route and duplicate-surface finding

The current route table defines:

- `/escrow` -> lazy-loaded `frontend/src/app/pages/escrow/escrow.component.ts`;
- `/escrow/:id` -> lazy-loaded escrow-detail page.

The target `components/escrow-payments` component is not the component loaded for `/escrow`. Repository search also finds no current use of its `app-escrow-payments` selector or class outside its own source/spec.

The canonical `/escrow` page already uses several approved Relay primitives:

- `AppCardComponent`;
- `AppEmptyStateComponent`;
- `AppSkeletonLoaderComponent`;
- `AppPillComponent`;
- `AppButtonSecondaryComponent`;
- Spartan `hlmBtn` for direct feature-specific buttons.

It also already implements real status filtering, count badges, an explicit error/retry state and navigation to `/escrow/:id`.

### Required migration decision

Before implementing #6174, choose one of these explicit paths:

1. **Preferred if the target is dead code:** remove/deprecate `EscrowPaymentsComponent` and its duplicate tests after confirming no dynamic/private consumer exists, then treat the routed `EscrowComponent` as canonical.
2. **If the target is intentionally reusable:** keep it, but converge its shared presentation and interaction contracts with the canonical page instead of introducing a parallel set of escrow-specific primitives.
3. **Do not:** wire a second route to the target merely to justify migrating it.

The rest of this audit records the target exactly as it exists so follow-up tickets remain actionable if the component is retained.

## Complete control and state inventory

| Element / behavior      | Current implementation                                | Current owner                            | Target owner                                                                      | Audit action                                                              |
| ----------------------- | ----------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Page shell              | `min-h-screen bg-surface-500 text-text-primary`       | Feature composition                      | Relay/app screen composition                                                      | Converge with canonical `app-screen`/page composition if retained         |
| Offline banner          | native `div`, `role="alert"`, semantic warning tokens | Feature + network state                  | Relay status/banner presentation                                                  | Keep behavior; reuse approved feedback primitive if one exists            |
| Sync pending operations | native `button` + `hlmBtn`                            | Feature async state + Spartan Button     | Relay Button or direct Helm if no wrapper fits                                    | Preserve; add correct busy semantics and duplicate guard                  |
| Back action             | native icon `button` + `hlmBtn`, `Location.back()`    | Browser history + Spartan Button         | Native button + approved icon-button presentation                                 | Preserve route/history contract                                           |
| Page heading            | translated native `h1`                                | Feature content                          | Native semantics + Relay typography                                               | Keep                                                                      |
| Help action             | native `button` + `hlmBtn`                            | Feature/onboarding service               | Native Button + feature product behavior                                          | Do not invent a new tour primitive                                        |
| Status filter strip     | six native `button` + `hlmBtn` pills                  | Feature signal + manual selected classes | Spartan accessible single-selection primitive + Relay pill/segmented presentation | Replace manual selection semantics if target retained                     |
| Selected status state   | `selectedStatus` signal                               | Feature                                  | Feature value, Spartan selection mechanics                                        | Keep value; fix behavior gap                                              |
| Loading state           | custom spinner `div` with `role="status"`             | Feature/resource                         | Relay loading/skeleton presentation                                               | Prefer shared loading primitive                                           |
| Empty state             | custom icon/text block                                | Feature                                  | `AppEmptyStateComponent`                                                          | Replace if target retained                                                |
| Transaction surface     | bespoke `div` card                                    | Feature                                  | `AppCardComponent`                                                                | Replace/converge                                                          |
| Status badge            | bespoke `span` with dynamic classes                   | Feature                                  | `AppPillComponent`/Relay status badge                                             | Replace/converge                                                          |
| Coin amount             | text with `text-vip`                                  | Feature presentation                     | Relay semantic currency presentation                                              | Preserve meaning, review VIP token usage                                  |
| Metadata row            | native spans + bullets                                | Feature content                          | Native semantics + Relay typography                                               | Keep; localize service type if required                                   |
| Release action          | native `button` + `hlmBtn`                            | Feature mutation + Spartan Button        | Button plus explicit high-impact confirmation policy                              | Preserve API boundary; strengthen pending/confirmation semantics          |
| Refund action           | native `button` + `hlmBtn`                            | Feature mutation + Spartan Button        | Button plus explicit high-impact confirmation policy                              | Preserve API boundary; strengthen pending/confirmation semantics          |
| Dispute action          | native `button` + `hlmBtn`                            | Feature mutation + Spartan Button        | Button plus dispute-reason flow owned by feature/Dialog/form primitives           | Current empty-reason call is a product gap                                |
| Error state             | `error` signal only                                   | Feature                                  | Relay error/status presentation                                                   | Must become visible/announced if target retained                          |
| Success state           | `successMessage` signal only                          | Feature                                  | Relay toast/status presentation                                                   | Must become visible/announced if target retained                          |
| Offline operation count | `EscrowService.pendingOperationCount`                 | Service/offline store                    | Service state surfaced by feature                                                 | Preserve                                                                  |
| Escrow list loading     | Angular `resource()`                                  | Feature/service                          | Feature resource state                                                            | Preserve or converge with canonical page                                  |
| Onboarding hint         | `afterNextRender` + `showToast()` + onboarding shim   | Feature                                  | Feature product behavior + Relay toast                                            | Re-evaluate dead behavior; do not move into Spartan                       |
| Analytics               | none                                                  | N/A                                      | N/A                                                                               | Do not add as incidental migration work                                   |
| Overlay behavior        | none in current target                                | N/A                                      | N/A                                                                               | Only add Dialog for an explicit product need such as dispute/confirmation |

Every currently rendered interactive element is classified above.

## Spartan ownership

### Buttons

All current actions are native `<button>` elements enhanced with `hlmBtn`. That is a sound semantic base. No feature should replace them with clickable `div`/`span` elements or custom keyboard handlers.

The migration should prefer an existing Relay button wrapper when its product API fits. Direct Helm use remains acceptable for feature-specific icon/action composition where no Relay wrapper exists, consistent with `docs/spartan-relay-architecture.md`.

Buttons requiring special attention:

- **Back:** navigation/history action, not a submit action.
- **Help:** feature action whose current service has no visible tour.
- **Sync:** async network mutation of queued operations.
- **Release/Refund/Dispute:** financially meaningful state transitions.

All should use explicit `type="button"` so future embedding in a form cannot accidentally submit a parent form.

### Status filters: single-selection interaction

The six filter pills are mutually exclusive. Today each button owns its selected visuals through feature classes, but the group exposes no selected-state semantics such as `aria-pressed` and does not use a single-selection Brain primitive.

If this component remains, migrate the filter group to a proper accessible single-selection contract. Spartan Radio Group is already available in the repository and is a suitable Brain-level owner for one-of-many selection when the product semantics are "choose one status". Relay may continue to present the options as compact pills/segmented controls.

Required behavior:

- one selected value at a time;
- deterministic keyboard behavior provided by the primitive;
- selected state exposed to assistive technology;
- horizontal overflow remains usable on mobile;
- focus ring remains visible while scrolled;
- selection state is not conveyed by color alone.

Do not add a bespoke roving-tabindex implementation.

### High-impact mutations and confirmation

Release and Refund materially change escrow ownership/balance state. Dispute changes the transaction workflow and normally requires a reason.

The current target executes all three immediately from the card button. The UI migration must not hide this risk behind styling changes.

If product policy requires confirmation, use the existing shared confirmation/Dialog stack rather than implementing a custom overlay. Spartan should own generic focus trapping, Escape handling, backdrop behavior and focus restoration. Feature code should own:

- which action is being confirmed;
- escrow identity/context;
- translated consequence text;
- whether the action is permitted;
- mutation execution and result handling.

Do not add confirmation solely to satisfy Spartan usage. Treat confirmation as an explicit product/accessibility hardening decision because it changes the interaction flow.

### Dispute reason

`handleDispute()` currently calls `escrowService.disputeEscrow(escrowId, '')` with an empty reason.

This is not a primitive problem. It is a product/data-contract gap. If the backend expects a meaningful dispute reason, #6174 should not preserve the empty string by wrapping the same button in nicer styling. A follow-up implementation should either:

- route to an existing dispute-detail flow; or
- use an approved Dialog/form composition to collect and validate the reason before the service call.

Feature validation and API semantics remain outside Spartan Brain.

## Relay ownership

Relay should own reusable product presentation rather than duplicating utility stacks in this target.

### Existing primitives to reuse

The canonical routed escrow page demonstrates suitable existing components:

- `AppCardComponent` for transaction/error surfaces;
- `AppEmptyStateComponent` for all/filtered-empty states;
- `AppSkeletonLoaderComponent` for list loading;
- `AppPillComponent` for status display;
- existing Relay button wrappers for product-level button variants where appropriate.

If `EscrowPaymentsComponent` is retained, converging on these primitives reduces design drift between two views of the same escrow data.

### Presentation that should remain feature composition

These do not need a new Brain primitive:

- page heading and explanatory copy;
- transaction description;
- amount and date metadata;
- service-type text;
- offline status wording;
- overall responsive page/list composition.

### Feedback presentation

The component already records translated `error` and `successMessage` values, but the template never renders them.

If retained:

- failures must be visible and announced;
- successes must be visible/announced without relying only on color;
- feedback must not expose raw server errors;
- use the repository's approved toast/status/error presentation rather than a new custom banner for each mutation.

The initial list-loading failure is particularly misleading today: the loader sets `error`, returns an empty array, and the template then shows the normal empty state because it never renders `error`.

## Current state model

The target currently has these state sources:

- network online/offline signal;
- pending offline operation count;
- `selectedStatus`;
- resource loading/value state;
- global `actionInProgress`;
- `error` string;
- `successMessage` string;
- onboarding completed/in-progress state.

### Load states

| State                  | Trigger                         | Current UI                         | Required follow-up if retained                                                   |
| ---------------------- | ------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| Loading                | `escrowsResource` loader active | custom spinner                     | shared loading/skeleton state                                                    |
| Load success with rows | `listEscrows()` returns rows    | all rows                           | preserve                                                                         |
| Load success empty     | returns `[]`                    | empty state                        | preserve with shared empty primitive                                             |
| Load failure           | service throws                  | `error` set, resource returns `[]` | show true error/retry instead of empty state                                     |
| Offline load           | service reads IndexedDB cache   | offline banner + cached rows/empty | preserve and distinguish stale/cache semantics only if product contract requires |

### Filter state bug

`setStatusFilter()` updates `selectedStatus`, and the filter pills update their visual classes, but `escrows()` is never filtered by `selectedStatus`.

Therefore the target currently displays the same complete escrow list for every selected filter.

This is a real behavior defect. The canonical routed `EscrowComponent` already has a `filteredEscrows` computed signal and status counts. If the target is retained, reuse/converge that behavior rather than introducing another filtering implementation.

### Async mutation state

`actionInProgress` is global. Any Release, Refund, Dispute, Sync or initial list operation can disable all mutation buttons at once.

Benefits:

- it prevents some duplicate mutation attempts while one operation is active.

Risks:

- it does not identify which row/action is busy;
- the button text does not expose pending state;
- `aria-busy` is absent;
- Back, Help and filters remain interactive while a mutation is active;
- one row mutation unnecessarily blocks unrelated pending rows;
- resource reload is started after success but not awaited before `actionInProgress` clears.

A follow-up should use explicit operation identity if per-row state is required, for example `{ escrowId, action } | null`, while keeping actual business state in the feature layer.

### Success/error lifetime

`successMessage` is never cleared at the beginning of later actions, and `error` is not cleared consistently in `handleSync()` before the request starts.

Because neither is currently rendered, this is latent state drift rather than a visible bug. Once feedback is surfaced, define a deterministic lifetime:

- clear stale conflicting feedback at action start;
- announce one final result;
- do not let an earlier success remain visible after a later failure;
- avoid stale completion from an older request overwriting a newer one.

## Service, API and offline contract

`EscrowService` owns network and offline behavior. The UI migration must preserve this boundary.

### Read contract

`listEscrows()` aliases `listUserEscrows(status?)`.

Online it:

- sends authenticated `GET /escrow`;
- optionally passes a status query;
- caches the result into the offline store;
- updates the service `escrows` signal.

Offline it returns cached escrows from IndexedDB.

The target currently calls `listEscrows()` with no status and should filter the already-loaded result locally if matching the canonical page, unless a deliberate server-filtered pagination contract is introduced separately.

### Release

`releaseEscrow(escrowId)`:

- POSTs to `/escrow/release` online;
- queues a release operation offline;
- returns an optimistic placeholder result offline.

### Refund

`refundEscrow(escrowId, reason?)`:

- POSTs to `/escrow/refund` online;
- queues a refund operation offline;
- accepts an optional reason.

The target currently supplies no refund reason.

### Dispute

`disputeEscrow(escrowId, reason, evidence?)`:

- POSTs to `/escrow/dispute` online;
- queues a dispute operation offline;
- requires a reason in its TypeScript signature.

The target currently passes `''`.

### Sync

`syncOfflineOperations()` replays queued operations sequentially when an access token exists. It:

- removes successful operations;
- increments retry count for failures;
- removes an operation after five failed replay attempts;
- refreshes the user escrow list when at least one operation succeeds;
- returns `{ sent, failed }`.

The target then triggers another `escrowsResource.reload()`, so a successful sync can cause a service-level refresh and a component-level refresh. This duplication should be reviewed before #6174 adds more loading UI.

### Authorization

The target should not replicate authorization checks in presentation code. Backend/API enforcement remains authoritative for release/refund/dispute eligibility.

The UI may hide or disable actions based on returned state, but it must handle server denial safely because the rendered state can become stale or be manipulated.

## Onboarding behavior

The target calls `maybeStartTour()` after the first render.

Current `EscrowOnboardingService` is explicitly a compatibility shim: the Joyride tour has been removed, and `startTour()` immediately marks onboarding complete in local storage.

Consequences:

- first render for a user without the completion flag shows an onboarding hint toast, then immediately marks the tour complete;
- the Help button calls `startTour()` but displays no actual tour;
- service step metadata still describes a Create Payment step that the target does not render;
- `isTourInProgress` is never set true by `startTour()`.

This is dead/legacy product behavior, not a missing Spartan primitive. Do not build a new tour system inside #6174. Either remove the inert Help affordance through a dedicated behavior decision or connect it to a deliberate supported onboarding experience.

## Navigation and route contracts

### Back

`goBack()` calls `Location.back()`.

This preserves browser-history semantics rather than routing to a fixed destination. Migration must not silently replace it with a hard-coded route unless product requirements change.

The icon is decorative and the button already receives a translated accessible name through `common.back`.

### Transaction details

Unlike the canonical `/escrow` page, the target transaction card is not a link and does not navigate to `/escrow/:id`.

Do not add card navigation as incidental primitive work. If the target is retained, decide whether it is intentionally an action-centric embedded list or should converge with the routed page's detail-navigation contract.

### Route ownership

No production route currently points to `EscrowPaymentsComponent`.

This is the highest-priority migration risk because visual/interaction changes to this target may have no user-visible effect while the canonical `/escrow` page continues evolving separately.

## Analytics and observability

No analytics hook is present in `EscrowPaymentsComponent`.

Do not add analytics simply because controls are migrated.

If telemetry is introduced later, do not include sensitive free-text dispute reasons or unnecessary transaction descriptions. Mutation failures should be diagnosable through service/backend observability without logging authentication tokens or private content.

The onboarding hint currently uses `showToast`, not analytics.

## Accessibility audit

### Existing strengths

- actions are native buttons;
- Back and Help icon-only controls have translated accessible names;
- the offline banner uses `role="alert"` and assertive live semantics;
- the loading spinner uses `role="status"` with screen-reader-only loading text;
- direction-sensitive spacing uses logical `ps`/`pe`/`ms` utilities;
- list actions become stacked on small screens, avoiding cramped horizontal button rows;
- user-facing labels use translation keys rather than hard-coded English in the template.

### Filter semantics

The visual selected state of the status pills is not exposed to assistive technology.

If retained, the migrated group must expose one selected option through the chosen selection primitive. Do not rely on primary background color alone.

### Loading and busy semantics

Mutation buttons become disabled during `actionInProgress`, but no button exposes `aria-busy` or text indicating which operation is running.

A follow-up should provide deterministic busy feedback for the active action without creating duplicate live announcements.

### Error and success feedback

The component stores feedback but never renders it. Screen-reader and keyboard users therefore receive no result after many failures, and successes are also silent.

Use a shared status/toast pattern with appropriate live-region policy. Avoid `role="alert"` for routine success messages unless urgency justifies it.

### High-impact actions

Release, Refund and Dispute are adjacent actions with similar visual weight. At high zoom and for screen magnification users, action naming and consequence clarity must remain explicit.

If confirmation is added, focus must move into and return from the Dialog through Spartan, not custom focus code.

### Status and amount

Status is expressed by translated text as well as color, which is good.

The amount currently uses `text-vip`, even though an escrow coin amount is not necessarily a VIP entitlement or celebratory state. #6175 should evaluate whether `vip` is semantically correct or whether `primary`/neutral currency styling better matches Relay's token taxonomy.

### Transaction descriptions

Descriptions may be user-generated or backend-provided content. Keep them on the system body font and allow wrapping at 200%/400% zoom. Do not apply display-only typography that may lack international glyph coverage.

### Touch targets

Back and Help are 40px square (`w-10 h-10`), below the repository's preferred approximately 44px mobile target. Follow-up work should use the approved touch-size button treatment.

Filter pills and row actions also need touch-target verification at the 390px baseline.

## RTL and internationalization

### Existing direction safety

The target generally uses logical spacing utilities:

- `ps-*` / `pe-*`;
- `ms-auto`;
- flex/gap rather than left/right margin utilities.

The Back SVG currently draws a fixed left-pointing arrow path. In an RTL document, browser-history Back is commonly mirrored to follow the reading/navigation direction. The follow-up accessibility/RTL ticket should explicitly verify the repository's icon policy rather than assuming the current glyph is direction-neutral.

### Translation behavior

Visible labels use `TranslatePipe`.

`statusFilters` stores translation keys, which is appropriate. `sanitisedStatusFilters` imperatively translates those same labels through `I18nService`, but the template does not use that computed value. It is dead code today and can be removed if the component remains.

Long translations must be tested for:

- filter pill overflow;
- action button wrapping;
- heading plus Back/Help controls;
- sync banner/button copy;
- success/error feedback.

The status strip already scrolls horizontally. Ensure focus remains visible and the scrollbar-hiding treatment does not make overflow undiscoverable.

## Theme and token audit

The target uses Relay semantic color tokens rather than literal hex values, which is a good base:

- `surface-*`;
- `text-*`;
- `primary`;
- `danger`;
- `success`;
- `warning`;
- `on-fill`;
- `vip`.

However, it still assembles most presentation directly in the feature template and uses several generic radii:

- `rounded-xl` for buttons;
- `rounded-2xl` for cards;
- `rounded-full` for status/filter pills.

Follow #6175 by moving reusable surface/radius/shadow ownership to Relay primitives rather than mechanically replacing class names in every card/button.

### Per-user accent

Selected filters, Help and Sync use `primary`, so they automatically inherit the per-user primary accent. Preserve this behavior.

Do not hard-code the fallback Ember value.

### Semantic colors

- warning is appropriate for connectivity warning state;
- danger is appropriate for dispute/destructive feedback;
- success is appropriate for release/success state;
- `text-on-fill` is correctly used on saturated fills;
- `vip` for ordinary coin value needs semantic review as noted above.

## Responsive and zoom audit

Current layout is mobile-first in several places:

- page padding increases at `sm`;
- text scales at `sm`/`lg`;
- transaction actions stack vertically on mobile and become a row at `sm`;
- filter pills use horizontal overflow.

Follow-up verification must cover:

- 390px width;
- tablet width;
- desktop width;
- 200% zoom;
- 400% zoom/reflow;
- long translated labels;
- large transaction descriptions;
- multiple pending rows;
- offline banner + sync control combinations.

At 400% zoom, do not force three financial action buttons into an unusable horizontal row simply because the viewport's CSS width crosses a breakpoint under browser zoom. Required actions must remain reachable without two-dimensional page scrolling where avoidable.

## Security and financial-action boundary

This is a money-like/coin escrow surface. UI migration must not weaken the service/backend boundary.

Preserve these rules:

- never build API URLs from transaction descriptions or other untrusted text;
- never log access tokens;
- do not treat a disabled button as authorization;
- handle stale/server-denied mutations cleanly;
- prevent accidental duplicate submissions while a mutation is in flight;
- do not claim Release/Refund/Dispute succeeded until the service resolves;
- surface sync partial failures accurately using `{ sent, failed }`;
- do not expose raw backend error bodies to the user;
- do not turn transaction cards into unsafe HTML rendering.

If a confirmation or dispute-reason Dialog is added, issue content/transaction descriptions remain untrusted display text and must render as text, not interpolated HTML.

## Known implementation defects and migration risks

### P0: duplicate/orphaned surface

The production `/escrow` route points to `pages/escrow/EscrowComponent`, not this target, and no current consumer of this target is found.

Risk: spending four migration tickets on dead duplicate UI while the production surface remains different.

Mitigation: confirm canonical ownership before #6174. Prefer consolidation/deletion over parallel migration.

### P0: filters do not filter

`selectedStatus` changes selected styling only. The rendered list is never filtered.

Risk: users believe they filtered transactions when all rows remain visible.

Mitigation: if retained, converge with the canonical page's computed filtering contract and add regression tests.

### P0: financial result feedback is invisible

`error` and `successMessage` are never rendered.

Risk: users cannot tell whether mutations failed/succeeded, and a load failure is presented as a legitimate empty state.

Mitigation: use shared Relay feedback with appropriate announcement semantics.

### P1: dispute sends an empty reason

`handleDispute()` passes `''` to a service whose method requires `reason: string`.

Risk: invalid or meaningless disputes can be created if the backend accepts the empty value, or users receive an unexplained server failure if it does not.

Mitigation: connect to a proper dispute-reason flow or validated form contract.

### P1: inert onboarding Help action

The onboarding service is a compatibility shim whose `startTour()` only marks completion.

Risk: Help looks actionable but does not provide help.

Mitigation: remove or deliberately replace in a separate behavior decision. Do not fake a Spartan tour primitive.

### P1: global busy state

A single boolean gates Sync and all row mutations.

Risk: poor feedback, unnecessary cross-row blocking, difficult stale-request reasoning.

Mitigation: explicit active operation identity if target remains.

### P1: duplicate refresh after offline sync

`EscrowService.syncOfflineOperations()` may refresh internally, then `handleSync()` reloads the component resource again.

Risk: unnecessary network/cache churn and confusing loading state.

Mitigation: define one refresh owner.

### P2: touch-size icon buttons

Back and Help are 40px square.

Risk: below preferred mobile touch target.

Mitigation: approved touch-size button treatment.

### P2: unused/dead code

- injected `HttpClient` is unused;
- injected `AuthService` is unused;
- `sanitisedStatusFilters` is unused;
- the spec contains an empty `should toggle create form` test despite no create form in the target.

Risk: misleading ownership and false test confidence.

Mitigation: remove during retained-surface cleanup or delete with the component if canonicalized away.

## Tests: current coverage and required regression plan

The existing `escrow-payments.component.spec.ts` covers only a narrow subset:

- component creation;
- initial signal values;
- setting the selected filter signal;
- status badge class mapping;
- status-filter data shape;
- a weak onboarding-completed check;
- an empty placeholder test named `should toggle create form`.

It does not prove the feature's critical interaction or failure behavior.

If the target is retained, #6177 should cover at minimum:

1. successful initial list rendering;
2. loading semantics;
3. load failure renders error rather than empty state;
4. retry behavior if provided;
5. all six filter options and actual list filtering;
6. selected filter accessibility semantics and keyboard behavior;
7. Back calls the existing browser-history contract;
8. Help behavior matches the decided onboarding contract;
9. offline banner visibility;
10. sync button visibility only when online with queued operations;
11. sync disabled/busy behavior;
12. sync success with sent/failed counts;
13. sync failure feedback;
14. Release success, failure and duplicate-submit prevention;
15. Refund success, failure and duplicate-submit prevention;
16. Dispute reason validation/flow if retained;
17. resource refresh happens exactly as intended after successful mutation;
18. mutation feedback clears stale state deterministically;
19. pending row actions remain correctly labelled and focusable;
20. action buttons are explicit `type="button"`;
21. Back/Help touch target contract;
22. RTL filter/order and Back icon behavior;
23. long translation reflow;
24. 200%/400% zoom action availability;
25. light/dark token ownership;
26. no hard-coded physical directional utilities;
27. no synthetic button roles/tabindex behavior;
28. no analytics calls are introduced by primitive conversion;
29. if the component is deleted, route/component tests prove the canonical `/escrow` page remains the sole supported surface.

## Design preview / Claude Design contract

This audit changes documentation only, so it does not require a design-preview change.

If the target is retained and later visual/interaction tickets modify the surface, preview coverage should include representative states rather than every transaction permutation:

- light theme, 390px, pending escrow with stacked actions;
- dark theme, wider viewport, mixed status list;
- offline banner state;
- queued-operation Sync state;
- loading state;
- true error/retry state;
- empty all state;
- filtered-empty state;
- mutation pending/feedback state;
- dispute/confirmation Dialog if product flow introduces one;
- RTL sample with long translated labels.

If the target is removed as dead duplicate UI, do not add a new preview for it. Keep the canonical routed `/escrow` page as the design-system mirror.

## Recommended implementation sequence

### Before #6174

1. Confirm whether `EscrowPaymentsComponent` has any runtime consumer outside repository-search visibility.
2. Confirm `/escrow` page ownership with product/route tests.
3. Prefer deletion/consolidation if the target is obsolete.

### #6174: controls and interactions

If retained:

1. remove dead injections/computed state;
2. make all buttons explicit `type="button"`;
3. move filter selection to an approved single-selection primitive;
4. implement actual filtering by selected status;
5. define per-operation pending state;
6. surface success/error feedback through approved Relay primitives;
7. resolve dispute-reason behavior deliberately;
8. avoid custom Dialog/focus behavior.

### #6175: Relay tokens/theme/responsive

If retained:

1. converge page shell with canonical app-screen composition;
2. use Relay Card, Empty State, Skeleton/Loading and Pill primitives;
3. consolidate product button variants where wrappers exist;
4. review `vip` use for coin amount;
5. use Relay radius/shadow contracts;
6. verify primary accent and light/dark parity;
7. preserve 390px-first stacked actions.

### #6176: accessibility/RTL/zoom/input

1. verify one-of-many filter semantics;
2. verify visible focus and mobile touch sizes;
3. verify feedback announcements;
4. test RTL arrow/overflow behavior;
5. test long translations;
6. test 200% and 400% zoom/reflow;
7. verify reduced-motion behavior for spinner/transitions where applicable.

### #6177: regression/design sync

1. replace placeholder/weak tests with behavior-focused coverage;
2. lock load/error/filter/mutation/offline states;
3. update the mapped Relay + Spartan design preview only if the retained visual contract changes;
4. update this audit status with the final canonical ownership decision.

## Verification commands

This documentation-only audit does not change Angular runtime behavior. Follow-up implementation tickets must run the repository frontend gate documented by the authoritative architecture contract:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

Focused component tests should run while iterating before the complete gate.

For this audit PR, repository CI and documentation/governance checks are authoritative because no application source, template, styles, route or design-preview contract is modified.

## Acceptance-criteria traceability

### No interactive element omitted

Mapped in this audit:

- Sync pending operations;
- Back;
- Help/onboarding;
- all six mutually exclusive status filters;
- Release;
- Refund;
- Dispute;
- any future confirmation/dispute Dialog only if product requirements add it.

### Existing behavior and route contracts recorded

Recorded:

- browser-history Back behavior;
- `/escrow` and `/escrow/:id` canonical routes;
- target component's current lack of route/consumer;
- EscrowService online/offline behavior;
- queued-operation sync/retry behavior;
- resource loading/reload behavior;
- onboarding compatibility-shim behavior;
- absence of analytics hooks.

### Migration risks and prerequisite work identified

Primary risks:

- duplicate/orphaned surface ownership;
- non-functional status filtering;
- invisible error/success feedback;
- empty dispute reason;
- inert onboarding Help action;
- global busy state;
- duplicate sync refresh;
- small icon-button touch targets;
- weak/placeholder tests;
- direct feature styling that should converge on existing Relay primitives.

No new shared primitive is required before migration. The repository already has the key building blocks for Button, Radio Group/single-selection behavior, Card, Empty State, Skeleton/Loading, Pill and Dialog/confirmation composition. The highest-value prerequisite is a canonical-surface decision, not another component abstraction.

## Final ownership recommendation

The correct Spartan migration is not "replace every element with Spartan." The target contains mostly native content and Button interactions, while the repository already has a more complete routed escrow page using Relay composition.

Preferred outcome:

- keep escrow business state/API/offline semantics in `EscrowService` and feature code;
- keep native headings/text/date semantics native;
- use Spartan only for generic interaction mechanics such as buttons, single-selection behavior and any deliberately introduced Dialog;
- use Relay for cards, pills, loading/empty/error feedback, tokens and responsive product presentation;
- consolidate or remove the unrouted duplicate component instead of maintaining two independently migrated escrow list surfaces.

That ownership decision satisfies the Spartan/Relay architecture while reducing long-term UI and behavior drift.

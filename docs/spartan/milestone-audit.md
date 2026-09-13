# Milestone Spartan/Relay audit

Issue: #6348 (`Spartan UI 0561`)

Target: `frontend/src/app/components/milestone`

Status: implementation baseline for #6349, #6354 and #6355.

## Purpose

This audit records the current `MilestoneComponent` contract before the remaining Spartan UI + Relay migration stages. It inventories every control, state, service boundary, route contract, accessibility relationship and feature-owned interaction, then assigns each responsibility to Feature, Relay, Spartan or the native browser.

The audit is based on current `main`. The visual/token stage tracked by #6353 has already landed, so follow-up work must preserve that Relay treatment rather than reintroducing generic radii, hard-coded product colours or feature-owned button styling.

The migration must not change milestone persistence semantics, broaden access to another user's milestones, introduce new analytics, or turn a UI conversion into a product redesign.

## Files inspected

- `frontend/src/app/components/milestone/milestone.component.ts`
- `frontend/src/app/components/milestone/milestone.component.spec.ts`
- `frontend/src/app/services/milestone.service.ts`
- `frontend/src/app/routes/social.routes.ts`
- `backend/src/milestones/milestones.controller.ts`
- `backend/src/milestones/milestones.service.ts`
- `docs/design-redesign-audit.md`
- `DESIGN.md`

## Current product contract

`MilestoneComponent` is a standalone authenticated study-goal surface available at `/milestones` with the route title `Milestones - HelloTalk`.

On first render the component starts one Angular `resource()` load that requests both:

1. the signed-in user's milestone list; and
2. aggregate progress for the same user.

The two requests are awaited together with `Promise.all`, so the component exposes one combined loading/error/value boundary. The successful value contains the milestone collection and `{ total, completed, percentage }` progress summary.

Users can then:

- create a milestone with a required title and optional description;
- mark an incomplete milestone as complete;
- delete a milestone;
- inspect a percentage progress bar derived from the server response.

All server requests go through `MilestoneService`. The component does not talk to Supabase directly.

The NestJS controller is protected by `SupabaseAuthGuard`. Backend reads and mutations are scoped by the authenticated user ID, and service queries include `user_id` when fetching, completing or deleting a milestone. The UI migration must preserve this server-authoritative ownership boundary.

No component-level analytics, telemetry or browser storage is present. Milestone text is rendered through Angular interpolation rather than raw HTML.

## Route and integration contract

The route is lazy-loaded from `frontend/src/app/routes/social.routes.ts`:

- path: `/milestones`;
- component: `MilestoneComponent`;
- title: `Milestones - HelloTalk`.

There is no component input/output contract and no modal host. The route owns the whole surface.

The migration must not:

- rename or relocate the route;
- eagerly import the component into the application shell;
- move HTTP ownership into a Relay/Spartan primitive;
- add a second milestone state store in parallel with `MilestoneService` and the existing resource.

## API and persistence boundary

The frontend service currently calls:

| User action | Method | Endpoint |
| --- | --- | --- |
| Load list | `getMilestones()` | `GET /milestones` |
| Load progress | `getProgress()` | `GET /milestones/progress` |
| Create | `createMilestone(title, description?)` | `POST /milestones` |
| Complete | `markCompleted(id)` | `POST /milestones/:id/complete` |
| Delete | `deleteMilestone(id)` | `DELETE /milestones/:id` |

The backend scopes data access to the authenticated user. `findOneForUser`, `markCompleted` and `remove` all match both milestone ID and user ID before returning or mutating data.

This audit does not change API semantics. Follow-up UI work must continue to treat backend responses as authoritative, especially after create/complete/delete operations.

## State inventory

| State | Trigger | Current rendering | Intended owner |
| --- | --- | --- | --- |
| Initial loading | component resource starts | translated loading text | Feature async state + Relay presentation |
| Load failure | either list or progress request rejects | translated `common.loadError` alert | Feature async state + Relay error presentation |
| Loaded empty | list resolves empty | translated empty card | Feature state + Relay presentation |
| Loaded populated | list resolves with milestones | milestone cards and actions | Feature composition + Relay surfaces + Spartan controls |
| Zero progress | no completed milestones or no milestones | 0% progressbar | Feature data + native progress semantics + Relay styling |
| Partial progress | some milestones completed | percentage progressbar | same |
| Complete progress | all milestones completed | 100% progressbar | same |
| Create idle | title/description editable | form controls and Add button | Feature form state + Spartan controls |
| Create invalid | trimmed title is empty | Add disabled; submit handler no-ops | Feature validation + native disabled semantics |
| Create pending | create request in flight | Add disabled through `creating()` | Feature async state + Spartan disabled/busy presentation |
| Create success | server create resolves | fields clear and resource reloads | Feature orchestration |
| Create failure | create request rejects | fields remain; no visible error | Existing product gap; Feature owns retry/error state |
| Complete pending | Complete clicked | no explicit pending state | Existing product gap; Feature owns mutation state |
| Complete success | server mutation resolves | resource reloads | Feature orchestration |
| Complete failure | request rejects | no visible error; promise rejects | Existing product gap |
| Delete pending | Remove clicked | no explicit pending state | Existing product gap; Feature owns mutation state |
| Delete success | server delete resolves | resource reloads | Feature orchestration |
| Delete failure | request rejects | no visible error; promise rejects | Existing product gap |

## Control and interaction inventory

### Milestone title input

The title field is a native text input enhanced by `hlmInput`.

Current responsibilities:

- native browser owns text editing, focus and required-field semantics;
- `HlmInput` owns the approved Spartan input interaction/presentation baseline;
- `newTitle` owns the feature value;
- `MilestoneComponent` trims the value before submission;
- the submit button is disabled while the trimmed value is blank.

**Target ownership:** keep the native input plus the repository-owned Spartan Helm input. There is no reason to replace it with a custom feature primitive.

Follow-up work should preserve the required-field relationship and ensure error/pending messaging does not rely on placeholder text.

### Optional description input

The description uses the same native + `hlmInput` composition and stores its value in `newDescription`.

**Target ownership:** native browser + Spartan input, with feature state retaining the actual value.

The current placeholder uses the translated `common.optional` key. No bespoke interaction is required.

### Add milestone action

The form submit action is a native `<button>` with `hlmBtn`, `size="touch"`, disabled state and the canonical primary/on-fill roles.

**Target ownership:** Spartan button owns focus, keyboard activation, disabled semantics and touch target. Feature code owns title validation, request orchestration and form clearing after a confirmed success.

The control should remain `type="submit"`; do not add manual Enter/Space handlers.

A follow-up interaction pass should expose a meaningful pending state with `aria-busy` or adjacent status text without replacing native disabled behavior.

### Complete action

Each incomplete milestone exposes a native `hlmBtn` touch-sized button.

**Target ownership:** Spartan button for generic interaction; feature code for the selected milestone ID and API request.

The current implementation has no per-item pending guard. Rapid pointer/keyboard activation can submit the same completion mutation repeatedly before the first request settles. #6349 should add feature-owned in-flight protection without creating a new button primitive.

### Completed status

Completed items remove the Complete action and render:

- a visual check mark with `aria-hidden="true"`; and
- translated screen-reader-only `milestones.completedStatus` text.

**Target ownership:** Relay/feature presentation. There is no interactive behavior and therefore no Spartan primitive is needed.

The completion state must remain understandable without colour alone.

### Remove action

Each milestone exposes a touch-sized native `hlmBtn` outline button with semantic danger text.

**Target ownership:** Spartan button for interaction, Relay semantic danger treatment for presentation, feature code for deletion orchestration.

The current implementation performs deletion immediately without confirmation and without a pending state. This audit does not invent a new product confirmation policy. If a future product decision requires confirmation, it must use the repository's approved Spartan Dialog/Relay confirmation composition rather than a feature-owned overlay.

### Progress bar

The progress bar uses a native `div` with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and a translated label. Its fill width is bound to the server-provided percentage.

**Target ownership:** native ARIA semantics + Relay presentation. No Brain primitive is required.

The percentage text beside the bar is the visible equivalent, so progress is not communicated by colour alone.

## Spartan / Relay ownership map

| Capability | Current implementation | Target owner | Migration guidance |
| --- | --- | --- | --- |
| Title editing | native `<input>` + `hlmInput` | Native + Spartan Helm | Keep; do not wrap with a second feature input abstraction |
| Description editing | native `<input>` + `hlmInput` | Native + Spartan Helm | Keep |
| Add | native `<button hlmBtn>` | Spartan button + feature request state | Preserve form submit semantics and add safe busy feedback |
| Complete | native `<button hlmBtn>` | Spartan button + feature request state | Add per-item duplicate-submit protection |
| Remove | native `<button hlmBtn variant="outline">` | Spartan button + Relay danger role | Preserve deletion contract; no custom overlay unless product policy changes |
| Completed marker | check + sr-only status | Relay/feature | Keep non-interactive |
| Progress bar | ARIA progressbar + width binding | Native semantics + Relay | Keep; no Spartan interaction needed |
| Progress/list/form surfaces | semantic Relay classes | Relay | Preserve #6353 token work |
| Loading | translated text/status | Relay/feature | Keep semantic status; consider shared loading presentation only if already approved |
| Load error | translated alert text | Relay/feature | Add retry only if product behavior is intentionally introduced |
| Empty state | translated Relay card | Relay | Prefer shared empty-state composition if migrated later |
| Data/resource | Angular resource + `MilestoneService` | Feature/service | Never move HTTP/auth logic into UI primitives |
| Route | lazy social route | Angular router/feature | Preserve `/milestones` contract |

## Existing Spartan adoption

Unlike many surfaces entering this migration program, the current milestone component already imports only the primitive-specific repository Helm boundaries it needs:

- `@spartan-ng/helm/input`;
- `@spartan-ng/helm/button`.

There is no direct `@spartan-ng/brain` import in feature code and no broad Spartan barrel import.

There are no hand-built menus, tabs, dialogs, popovers, comboboxes or selection widgets in the milestone surface. #6349 therefore should not add Spartan components merely to increase framework usage. Its meaningful interaction work is to harden async mutation state while retaining the existing button/input ownership.

## Relay and visual baseline

The #6353 token/theme stage is already reflected on current `main` and must be preserved.

Current positive usage includes:

- `rounded-app` for form controls and buttons;
- `rounded-card` for content surfaces;
- `rounded-pill` for the progress track;
- `bg-surface-200` / `bg-surface-300` / `border-surface-100`;
- `text-text-primary` / `text-text-secondary`;
- `bg-primary` with `text-on-fill` for saturated primary actions;
- semantic `text-danger` / `text-success` roles;
- `shadow-card` for elevated surfaces;
- reduced-motion handling on the progress transition;
- mobile-first stacked controls that expand to row layouts on wider viewports.

The current regression suite explicitly protects the removal of generic `rounded-lg`/`rounded-md` utilities from this component. Follow-up work must not regress those decisions.

## Accessibility audit

### Existing strengths

- all interactive elements are native form controls/buttons;
- title and description inputs have visible translated labels;
- the form's Add action uses native submit semantics;
- Add is disabled for a blank trimmed title and while creation is in flight;
- all currently rendered buttons use the repository touch-size contract;
- the progressbar exposes value, min, max and a translated accessible name;
- completed status has a text equivalent rather than relying on the green check;
- loading uses `role="status"`;
- initial load failure uses `role="alert"`;
- no positive `tabindex` or custom keyboard emulation is present.

### Pending-state gaps

Create disables the Add action but does not expose explicit busy text/status. Complete and Remove have no pending state at all.

#6349/#6354 should ensure:

- pending operations cannot be submitted twice;
- native disabled semantics remain authoritative;
- the affected control or nearby region exposes busy state where useful;
- focus is not lost when the resource reload replaces a completed/deleted card;
- failures retain enough context for a retry instead of appearing to succeed silently.

### Mutation failure feedback

Create, complete and remove errors are not caught for user-facing feedback. This is not a Spartan defect, but the interaction/accessibility pass should not hide it.

A production-safe conversion should use one translated, bounded error/status contract owned by the feature/Relay layer. It must not surface raw backend/database exception text.

### Destructive-action semantics

Remove is visually differentiated with the semantic danger role, but there is no confirmation. This is current product behavior. The migration must not silently add or remove a confirmation policy.

If product policy later requires confirmation, use the shared confirmation/Dialog primitive and return focus deterministically to a sensible surviving element.

## Keyboard and focus contract

The migrated surface should retain native browser keyboard behavior rather than feature-level key handlers.

Requirements for #6349/#6354:

- Tab order follows DOM order: title, description, Add, then each milestone's available actions;
- Enter in the form submits through native form semantics;
- Space/Enter activate native buttons without custom listeners;
- disabled/pending actions cannot be reactivated;
- after create/reload, focus should not jump unpredictably to the document root;
- after completion, removal of the Complete button must not strand focus;
- after deletion, focus should move to a predictable surviving control or list context if the deleted button held focus;
- visible focus must continue to come from the approved Spartan/Relay focus contract.

There is no legitimate use for positive `tabindex`, fake `role="button"`, or manual Enter/Space emulation in this component.

## RTL and bidirectional-content audit

The current layout is predominantly direction-neutral:

- spacing uses `gap`;
- responsive composition uses flex/grid rather than physical left/right positioning;
- no `ml-*`, `mr-*`, `left-*` or `right-*` utilities are required by the target component.

Milestone title and description are user-authored content and can contain text whose direction differs from the current application locale. Current interpolation does not explicitly isolate that text.

#6354 should verify mixed-direction content and consider `dir="auto"` or `<bdi>` on user-authored title/description if needed, without changing stored text.

The route title, labels, action names, loading/error/empty copy and completed status remain translation-owned. IDs, percentages and API paths are data contracts and must not be localised.

## Touch, zoom and responsive contract

Current `main` has already moved the surface to a mobile-first composition:

- page padding scales at `sm`;
- Add is full-width on narrow screens and fit-content on wider screens;
- milestone card content/actions stack vertically on narrow screens;
- actions become a row at `sm`;
- title/description use `break-words`;
- form controls have `min-w-0` and full width;
- action buttons have the repository 44px-equivalent `min-h-11` baseline.

#6354 should explicitly verify:

- 390px viewport width;
- long translated labels;
- very long user-authored milestone titles/descriptions;
- 200% zoom;
- 400% zoom/reflow;
- no horizontal document scrolling;
- all Add/Complete/Remove actions remain reachable;
- focus rings are not clipped by card overflow;
- progress text and bar remain understandable when wrapping occurs.

At high zoom, stacking is preferable to preserving a desktop row.

## Reduced motion and theme contract

The progress fill currently uses `transition-[width]` with `motion-reduce:transition-none`, which is the correct baseline to retain.

The remainder of the surface should avoid new non-essential motion during #6349/#6354.

Light and dark themes remain first-class. Per-user primary accent behavior must continue through the `primary` role, and saturated fills must continue to pair with `text-on-fill` rather than hard-coded white.

No new hard-coded product colours should be introduced.

## Privacy and security notes

This UI displays only the signed-in user's milestones under the existing authenticated API contract.

Migration rules:

- do not accept a user ID from the component or route to scope milestone reads/mutations;
- do not log milestone titles/descriptions as diagnostics or analytics merely for UI migration work;
- do not render milestone text through `innerHTML` or another raw-HTML sink;
- keep server authorization authoritative even if controls are disabled in the browser;
- user-authored text remains plain interpolated text;
- mutation failure messages should be generic/localised rather than exposing Supabase/provider details.

The backend currently derives its user ID from the authenticated request and the data service scopes queries to that ID. UI conversion code must not weaken this boundary.

## Performance and data-flow notes

The component intentionally uses one combined resource load for list plus progress. Mutation success reloads the authoritative resource rather than trying to maintain a second client-side aggregate.

The current progress endpoint calculates progress from the user's milestone collection server-side. This audit does not change that query behavior.

UI migration should avoid:

- adding per-card HTTP reads;
- adding N+1 progress calls;
- duplicating milestone state in local storage;
- triggering extra reloads from both primitive events and feature handlers;
- reloading once per button state transition rather than once after a confirmed mutation.

## Current regression coverage

`milestone.component.spec.ts` currently covers:

1. component creation;
2. initial milestone and progress loading;
3. milestone title/description rendering;
4. Relay card/radius/surface ownership;
5. absence of generic rounded utilities;
6. touch-sized and responsive action layout;
7. blank-title submission suppression;
8. successful create and form clearing;
9. completion service delegation;
10. deletion service delegation.

The suite does not yet cover:

- initial loading/error/empty DOM states;
- create failure and retry behavior;
- duplicate create suppression while pending;
- complete/delete duplicate-submit suppression;
- complete/delete failure feedback;
- focus recovery after complete/delete reload;
- mixed-direction user content;
- accessible pending state;
- long-content/high-zoom behavior;
- explicit 390px visual state;
- light/dark Claude Design preview parity.

Those gaps are the main executable acceptance criteria for #6354/#6355.

## Recommended implementation sequence

### #6349: controls and interaction ownership

1. Keep existing `hlmInput` and `hlmBtn` ownership rather than inventing new primitives.
2. Add feature-owned in-flight state for Complete and Remove so duplicate mutations are impossible.
3. Preserve native form/button semantics and avoid manual keyboard handlers.
4. Add bounded translated mutation failure feedback and keep failed actions retryable.
5. Ensure resource reload happens exactly once after a confirmed successful mutation.
6. Do not alter route, API or persistence contracts.

### #6354: accessibility, RTL, zoom and input methods

1. Verify deterministic focus behavior across create/complete/delete resource reloads.
2. Expose busy/error state to assistive technology without duplicate announcements.
3. Verify user-authored mixed-direction title/description rendering.
4. Verify 390px, 200% and 400% reflow with long translated and user-authored text.
5. Verify mouse, touch and keyboard produce equivalent outcomes.
6. Preserve reduced-motion and colour-independent completion/progress meaning.

### #6355: regression and Claude Design lock

1. Expand the component suite for loading/error/empty/pending/failure/retry/focus states.
2. Add representative light/mobile and dark/wide design-preview states.
3. Include long-content and RTL representative states where the design-sync contract supports them.
4. Update `docs/design-redesign-audit.md` when the surface is fully complete.
5. Run the canonical frontend/design verification gates.

## Required regression matrix

Before the milestone migration sequence is considered complete, executable coverage should include at least:

1. initial list/progress load;
2. loading state semantics;
3. load-error semantics;
4. successful empty state;
5. populated milestone state;
6. 0%, partial and 100% progress semantics;
7. blank title cannot submit;
8. trimmed title and optional description payload;
9. create pending disables duplicate submission;
10. create success clears fields only after confirmed success;
11. create failure preserves draft values and exposes retryable feedback;
12. Complete is keyboard/touch operable;
13. Complete cannot submit twice while pending;
14. complete success reloads authoritative state once;
15. complete failure retains the action and exposes retryable feedback;
16. Remove is keyboard/touch operable;
17. Remove cannot submit twice while pending;
18. delete success reloads once;
19. delete failure retains the item and exposes retryable feedback;
20. completed state has a non-colour textual equivalent;
21. focus remains deterministic after a Complete action disappears;
22. focus remains deterministic after a deleted card disappears;
23. user-authored title/description remain plain text;
24. mixed RTL/LTR user content renders safely;
25. 390px layout keeps all required actions available;
26. 200% and 400% zoom do not create horizontal document overflow;
27. long translations wrap without hiding actions;
28. light and dark Relay token parity;
29. reduced-motion preference removes non-essential progress animation;
30. service calls remain authenticated/user-scoped through the existing API boundary.

## Verification gate

Implementation PRs for the remaining milestone stages should use the repository's canonical frontend gate. Focused component tests should run while iterating, followed by the repository checks used by CI, including frontend unit/static analysis/build, RTL logical-layout verification, Spartan ownership/governance, translation safety and design coverage where the visual contract changes.

This audit is documentation-only and does not alter runtime behavior, API/schema contracts, routes, persistence, analytics or design-preview output.

## Audit conclusion

The milestone surface is already substantially aligned with the target architecture on current `main`: controls are native elements enhanced through primitive-specific Spartan Helm imports, and #6353 has moved the presentation onto Relay semantic tokens and responsive composition.

The remaining migration work should therefore be deliberately small and product-safe. Spartan should continue owning generic button/input interaction rather than expanding into non-interactive content. Relay should continue owning surfaces, semantic colours, radii, elevation and layout presentation. Feature code should own milestone values, validation, asynchronous mutation state and authoritative resource reloads.

The most important remaining gaps are not missing UI primitives. They are mutation concurrency/failure handling, deterministic focus after DOM-changing reloads, mixed-direction user content, high-zoom verification and the final regression/design-preview lock. Addressing those gaps without changing the route or persistence contract is the correct implementation path for #6349, #6354 and #6355.

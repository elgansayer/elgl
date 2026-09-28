# Moderation Spartan/Relay audit

Issue: #6356 (`Spartan UI 0566`)

Target: `frontend/src/app/components/moderation`

Status: implementation baseline for #6357-#6360.

## Purpose

This audit records the current `ModerationPanelComponent` contract before its Spartan UI + Relay migration stages. It inventories every interactive control, loading/empty/error/result state, asynchronous side effect, accessibility relationship, and visual utility currently owned by the feature, then assigns each responsibility to Feature, Relay, or Spartan ownership.

The migration must preserve moderation behaviour and API contracts. It must not broaden moderator permissions, change report disposition semantics, expose additional personal data, add new analytics, or reinterpret service failures as successful moderation outcomes.

## Files inspected

- `frontend/src/app/components/moderation/moderation-panel.component.ts`
- `frontend/src/app/components/moderation/moderation-panel.html`
- `frontend/src/app/components/moderation/moderation-panel.component.spec.ts`
- `frontend/src/app/services/moderation.service.ts`
- `frontend/src/app/components/primitives/card/card.component.ts`
- `frontend/src/app/components/primitives/empty-state/empty-state.component.ts`
- `frontend/src/app/components/primitives/skeleton-loader/skeleton-loader.component.ts`
- `backend/src/moderation/moderation.controller.ts`
- `docs/spartan-relay-architecture.md`
- `DESIGN.md`

## Current product contract

`ModerationPanelComponent` presents a two-view moderation queue:

1. Moment reports.
2. Profile reports.

The selected type is held in the `currentFilter` signal and drives an Angular `resource()`. The resource delegates to `ModerationService.getItems(type)` and exposes the resulting list, loading state, and resource error state.

Each loaded report exposes three moderator actions:

- Approve.
- Reject.
- Analyse the reported user's profile for risk signals.

Approve and Reject call the corresponding service mutation and reload the list afterwards. Analyse calls `getUserRiskAnalysis(userId)` and renders one shared analysis result beneath the report cards.

The backend moderation controller is authenticated by `SupabaseAuthGuard`, rate-limits collection reads and mutations, and documents moderator permission failures on moderation actions. This audit does not change that authorization boundary.

## State inventory

| State | Trigger | Current rendering | Intended owner |
| --- | --- | --- | --- |
| Default filter | component creation | Moment tab selected | Feature state; Spartan selection primitive |
| Profile filter | Profile tab activated | Profile tab selected; resource reloads | Feature state; Spartan selection primitive |
| Loading | `itemsResource.isLoading()` | translated loading copy + three skeleton cards | Feature async state + Relay presentation |
| Load failure | `itemsResource.error()` | `AppEmptyStateComponent` with Retry | Feature async state + Relay empty/error presentation |
| Successful empty queue | loaded `items().length === 0` | translated no-items empty state | Feature state + Relay presentation |
| Populated queue | one or more reports | report cards with metadata and actions | Feature composition + Relay cards + Spartan actions |
| Analysis idle | no analysis requested | no analysis region | Feature state |
| Analysis pending | `analysing() === true` | all Analyse actions disabled; loading label | Feature async state + native/Spartan disabled semantics |
| Analysis result with flags | risk analysis succeeds | risk score + comma-separated flags | Feature data + Relay semantic status presentation |
| Analysis result without flags | risk analysis succeeds | risk score + no-flags copy | Feature data + Relay semantic status presentation |
| Approve/reject pending | mutation Promise in flight | no dedicated pending state | Missing feature state; implementation risk |
| Approve/reject failure | service returns `{ success: false }` | ignored; queue reload still occurs | Existing correctness gap; must not be hidden by migration |
| Analysis provider failure | service returns fallback `{ riskScore: 0, flags: [] }` | indistinguishable from safe analysis | Existing service ambiguity; not a Spartan concern |

## Control and interaction inventory

### Queue type selector

Two buttons represent Moment and Profile filters. They currently use:

- `hlmBtn`;
- manually authored `role="tab"` and `aria-selected`;
- a parent `role="tablist"`;
- click handlers that mutate `currentFilter`;
- feature-owned selected/unselected background and text classes.

There are no `aria-controls` relationships, no roving focus implementation, and no ArrowLeft/ArrowRight selection behavior. Because this is a mutually exclusive selection between two peer views, feature code should not continue hand-rolling tab keyboard semantics.

**Target ownership:** use an approved Spartan tabs or radio-group selection primitive, depending on the repository's canonical moderation design. If the content is conceptually one panel whose data is filtered in place, a radio-group/segmented-control contract is likely simpler than claiming full tab semantics. If tabs remain the chosen semantics, Spartan must own keyboard roving focus and selected state.

### Retry action

The load-error state delegates its Retry action to `AppEmptyStateComponent` through `actionLabel` / `actionClicked`.

**Target ownership:** keep the reusable empty/error presentation in Relay. Its action must continue delegating to the repository-owned Spartan button primitive inside `AppEmptyStateComponent` rather than reimplementing a feature button.

Current `filterByType(currentFilter())` only writes the same signal value. Depending on Angular resource equality semantics, that may not constitute an actual retry. The implementation stage must verify that Retry calls `itemsResource.reload()` directly or otherwise guarantees a fresh load.

### Approve action

Each report renders an `hlmBtn` with feature-owned success fill, compact padding, radius, font weight, and hover styling.

**Target ownership:** Spartan owns button interaction, focus, keyboard activation, disabled/busy semantics. Relay/Helm variants own visual role. Feature code owns which report is approved and when the queue reloads.

The action is consequential. The implementation stage must verify whether confirmation is required by product policy. This audit does not introduce one because current behavior is single-click.

### Reject action

Each report renders an `hlmBtn` with feature-owned danger fill, compact padding, radius, font weight, and hover styling.

**Target ownership:** same split as Approve. Prefer the approved destructive button variant rather than feature-owned `bg-danger`/hover classes. Any future rejection-reason dialog must use the repository's Spartan dialog primitive, not a feature overlay.

### Analyse action

Each report renders an `hlmBtn`, with the warning presentation hand-authored in the feature. All Analyse buttons share one global `analysing` signal.

**Target ownership:** Spartan button for interaction; Relay/semantic variant for presentation; feature owns request state and result association.

The current global pending state disables every report's Analyse button even though only one user is being analysed. More importantly, `analysisResult` is global rather than keyed to the report/user, so a result is rendered beneath every report card while it is non-null. #6357 should not silently preserve that visual ambiguity if converting interaction state; the result should be associated with the initiating report, or the UI should clearly present one shared analysis panel.

### Report cards and metadata

Report containers are non-interactive `<div>` elements with `aria-label`. They display:

- reported user name;
- report reason;
- creation date;
- Approve / Reject / Analyse actions;
- optionally the analysis result.

They must remain non-interactive containers. Do not turn entire report cards into buttons or selectable cards merely to increase Spartan usage.

## Spartan / Relay ownership map

| Capability | Current implementation | Target owner | Migration guidance |
| --- | --- | --- | --- |
| Queue type selection | two `hlmBtn` buttons + manual tab roles | Spartan Brain/Helm selection primitive | remove feature-owned roving/selected semantics |
| Retry | `AppEmptyStateComponent` action | Relay + Spartan button | preserve reusable error-state ownership; make retry actually reload |
| Approve | `hlmBtn` + feature colours/radius | Spartan button + Relay semantic styling | preserve action payload; add per-item pending protection |
| Reject | `hlmBtn` + feature colours/radius | Spartan destructive button | preserve action payload; no bespoke destructive styling |
| Analyse | `hlmBtn` + feature warning styling | Spartan button + feature async state | associate pending/result with initiating item |
| Report surface | bespoke bordered `div` | Relay `AppCardComponent` or approved card primitive | card remains non-interactive |
| Loading surface | `AppCardComponent` + skeleton loaders | Relay | keep skeleton presentation reusable |
| Empty/error surface | `AppEmptyStateComponent` | Relay | keep translated status/action contract |
| Risk-result surface | bespoke `div` | Relay semantic card/status presentation | do not introduce Brain without interaction |
| Translation | `TranslatePipe` | existing i18n layer | preserve all user-facing copy through translations |
| Queue data | `ModerationService` + resource | Feature/service | never move HTTP/auth concerns into Relay/Spartan |

## Visual and token audit

### Positive current usage

The surface already uses semantic token names for many values:

- `text-text-primary`;
- `text-text-secondary`;
- `border-surface-100`;
- `bg-surface` / `bg-surface-100`;
- `bg-primary`;
- `text-on-fill`;
- `bg-success`, `bg-danger`, `bg-warning`.

No literal hex colours are present in the target template.

### Feature-owned styling to remove or centralise

The feature currently owns:

- `rounded-xl`, `rounded-lg`, and plain `rounded` instead of Relay radius roles;
- compact `px-3 py-1.5` action sizing that is below the repository 44px touch baseline;
- bespoke selected/unselected classes on the filter controls;
- bespoke success/danger/warning action fills and hover states;
- transition classes on controls without an explicit reduced-motion contract;
- report-card border/radius/padding instead of a typed Relay card contract.

#6358 should move these concerns to the approved Relay/Spartan variants and semantic radius/elevation roles.

## Accessibility audit

### Existing strengths

- the page has a labelled `role="main"` region;
- the queue selector has a translated accessible group name;
- actions are native buttons enhanced by `hlmBtn`;
- loading and empty/error states have textual equivalents;
- risk analysis is represented with text, not colour alone;
- skeletons are hidden from assistive technology;
- no positive `tabindex` is used.

### Selection semantics

The manual tab implementation is incomplete. If `role="tab"` is retained, the migration must ensure:

- the tablist owns deterministic ArrowLeft/ArrowRight navigation;
- exactly one tab is in the tab sequence;
- the selected tab and panel are related through stable, instance-safe IDs;
- `aria-controls` / `aria-labelledby` relationships are valid;
- RTL changes directional arrow semantics only where required by the chosen primitive.

The preferred solution is to delegate this to Spartan instead of extending the feature implementation.

### Repeated action names

Approve and Reject currently use report IDs in `aria-label`, while Analyse uses the reported user's name. IDs may be meaningful for operators but can also be long/noisy. #6359 should verify accessible names provide enough disambiguation without exposing unnecessary identifiers.

Visible action text is already translated. Do not replace useful visible labels with icon-only controls unless the design requires it.

### Loading and busy feedback

`analysing()` changes the Analyse label to Loading and disables all Analyse buttons, but there is no explicit `aria-busy` relationship on the affected report. Approve/Reject have no pending state at all.

The conversion should expose pending state through native disabled semantics and a nearby polite status where necessary. It must not create duplicate live-region announcements for every report.

### Error semantics

The list error is represented by `AppEmptyStateComponent`, but mutation failures are not exposed. A moderator must not be told an action completed when the service returned `{ success: false }`.

Any mutation-error presentation should use a translated alert/status contract and retain the affected report for retry.

## Keyboard and input-method contract

All actions must be operable with native keyboard activation.

Requirements for #6357/#6359:

- no manual Enter/Space emulation for native buttons;
- selector keyboard behavior delegated to Spartan;
- deterministic focus after filter changes and queue reloads;
- focus must not be lost when an approved/rejected item disappears;
- pending actions cannot be submitted twice by mouse, touch, keyboard, or assistive technology;
- all standalone controls meet the 44px target baseline unless an approved dense-operator exception is documented;
- touch, mouse, and keyboard must reach equivalent moderation outcomes;
- no hover-only information or actions.

## RTL and bidirectional content

The template currently has several physical-direction risks:

- `justify-between` is direction-neutral for spacing but the content/action grouping must still be inspected in RTL;
- report metadata names and reasons are user/server content and can contain mixed-direction text;
- the template does not set `dir="auto"` on reported names or reasons;
- there are no explicit `left-*`/`right-*` spacing utilities in the target, which is positive.

Follow-up implementation should use `dir="auto"` or `<bdi>` where untrusted names/reasons are embedded in translated UI, preserve logical spacing utilities, and verify action ordering intentionally in RTL rather than relying on visual coincidence.

## Responsive, touch, zoom, and reflow contract

Current report rows use `flex justify-between items-start` with an inline action group. At 390px, long translations, long names/reasons, or 200%/400% zoom can force the metadata and three actions into horizontal competition.

#6358/#6359 must verify:

- 390px mobile baseline;
- tablet and desktop widths;
- 200% and 400% zoom/reflow;
- long translated action labels;
- long user names and report reasons;
- no horizontal document scrolling;
- actions stack or wrap without clipping;
- focus indicators remain fully visible;
- touch targets remain at least 44px;
- analysis results wrap long flags without overflow.

The likely composition is mobile-first stacked metadata/actions, moving to an inline row only when space permits. Responsive layout remains feature composition; interaction mechanics remain Spartan-owned.

## Theme and accent contract

The moderation surface must remain first-class in both light and dark themes.

Requirements:

- neutral surfaces/borders/text come from Relay semantic tokens;
- selected filter controls use the canonical user-accent-aware `primary` role where appropriate;
- destructive/success/warning roles remain semantic and maintain contrast in both themes;
- saturated fills use `text-on-fill`;
- no hardcoded white/black/hex values are introduced;
- visible focus comes from Spartan/Relay focus tokens rather than feature colours;
- reduced-motion users do not receive unnecessary control transitions.

## Internationalisation contract

All current visible labels are translated. Preserve the existing keys and ensure any new pending/error/confirmation copy is translated before shipping.

Operator surfaces are especially vulnerable to compact English-only assumptions. Validate:

- long German-like action labels;
- Arabic/Hebrew RTL labels;
- CJK names/reasons;
- mixed LTR IDs inside RTL surrounding UI;
- dates rendered through locale-aware Angular formatting.

Do not concatenate untranslated status values into accessible names.

## Data, API, authorization, and privacy boundaries

### Frontend API

`ModerationService` currently uses:

- `GET /moderation/items?type=...`;
- `POST /moderation/approve`;
- `POST /moderation/reject`;
- `GET /moderation/analyse/:userId`.

The backend controller applies `SupabaseAuthGuard` to the controller and documents rate limits for reads, actions, reports, and analysis.

### Important service ambiguities

The frontend service currently converts several provider failures into ordinary values:

- item-load failure -> `[]`;
- analysis failure -> `{ riskScore: 0, flags: [] }`;
- mutation failure -> `{ success: false, error: 'Service temporarily unavailable' }`.

Because `getItems()` catches failures and returns `[]`, `itemsResource.error()` may never become populated for ordinary HTTP failures. That means the template's load-error branch can be unreachable for the common service failure path and outages can appear as a genuinely empty queue.

This is a correctness and operator-safety risk. #6357 should not paper over it with visual changes. The migration sequence should coordinate with service hardening so unavailable moderation data is distinguishable from an empty queue.

Similarly, the component currently ignores the `success` value from approve/reject and reloads regardless. The converted UI must not imply success until the server confirms the mutation.

### Sensitive data

The moderation queue handles reports, reported-user identity, reasons, and risk-analysis flags. Do not add console logging, analytics payloads, or client persistence containing these values as part of UI migration.

Sanitised diagnostics should identify the operation and failure category without including report content, user IDs, tokens, or raw provider errors.

## Existing test coverage and gaps

`moderation-panel.component.spec.ts` exists but is currently wrapped in `describe.skip(...)`, so none of its tests execute.

The disabled suite attempts to cover:

- component creation;
- initial Moment loading;
- empty state;
- rendering multiple items;
- filter switching;
- approve/reject calls;
- user analysis;
- risk score/flags;
- analysis disabled state.

Several assertions are stale relative to the current template, including selectors and empty-state copy. #6360 must re-enable and modernise the suite rather than merely adding more skipped tests.

Missing regression coverage includes:

- reachable load-error + Retry behavior;
- mutation failure and retry;
- duplicate mutation suppression;
- filter selection keyboard contract;
- per-report analysis association;
- missing reported-user handling;
- long/RTL content;
- 390px and high-zoom action reflow;
- light/dark semantic-token ownership;
- focus preservation after item removal;
- accessibility relationships for selector/panel;
- reduced-motion behavior.

## Analytics and routing

No analytics hook or direct router dependency is present in `ModerationPanelComponent`. Migration must not add analytics events or navigation as an incidental side effect.

The component itself has no route contract visible in the target files. If it is embedded by a parent/admin surface, preserve that ownership; do not create a new public route in the Spartan migration series unless a separate product issue requires it.

## Migration risks

1. **False empty state on outage:** `ModerationService.getItems()` catches failures and returns `[]`.
2. **False safe analysis:** analysis failure collapses to zero risk/no flags.
3. **False action success:** approve/reject response success is ignored before reload.
4. **Duplicate mutations:** approve/reject have no per-item pending guard.
5. **Global analysis state:** one result can appear under every report and one request disables all Analyse actions.
6. **Incomplete tab semantics:** manual roles do not provide full keyboard/focus relationships.
7. **Touch sizing:** compact actions are below the 44px baseline.
8. **Mobile/high-zoom overflow:** metadata and three actions compete in one horizontal row.
9. **Feature-owned styling:** semantic button roles, radius, hover, and selected states are duplicated in the template.
10. **Bidirectional content:** user/reason strings are not explicitly isolated with `dir="auto"`/`bdi`.
11. **Skipped regression suite:** current component tests do not execute.
12. **Retry uncertainty:** writing the same filter value may not guarantee an Angular resource reload.
13. **Operator privacy:** moderation content must not leak into logs/analytics during migration.

## Prerequisite primitive decision

No new generic Spartan primitive is required before #6357.

The repository already has the necessary building blocks:

- Spartan button;
- Spartan selection primitives (tabs/radio-group, subject to the final semantic choice);
- Relay card;
- Relay empty/error state;
- Relay skeleton loader;
- existing translated status infrastructure.

If the desired segmented moderation selector cannot be represented by the approved selection primitive without feature-owned keyboard behavior, extend a shared Relay wrapper around an existing Spartan Brain capability rather than creating a moderation-specific control.

## Recommended migration sequence

### #6357 - controls and interactions

1. Choose the correct Spartan-owned mutually exclusive selector semantics.
2. Remove feature-owned tab keyboard/selection behavior.
3. Use approved Spartan button variants/sizes for Approve, Reject, Analyse, and Retry.
4. Add per-item mutation pending protection and truthful success/failure handling.
5. Make Retry call the resource reload contract explicitly.
6. Associate analysis pending/result state with the initiating report.
7. Preserve authenticated API payloads and moderation outcomes.

### #6358 - Relay tokens, responsive layout, theme parity

1. Move report surfaces to Relay card ownership where appropriate.
2. Replace generic radii and bespoke action fills with semantic Relay/Spartan roles.
3. Make report/action composition mobile-first and wrap/stack safely.
4. Verify light/dark and dynamic-primary behavior.
5. Preserve text-on-fill and semantic status contrast.

### #6359 - accessibility, RTL, zoom, input methods

1. Verify selector focus/keyboard semantics.
2. Verify stable accessible names/relationships and mutation status announcements.
3. Isolate mixed-direction user/report content.
4. Verify touch sizing, reduced motion, and focus preservation.
5. Verify 390px, 200%, and 400% reflow with long translated content.

### #6360 - regression and design preview

1. Remove `describe.skip` and repair stale assertions.
2. Cover loading, unavailable, empty, populated, action pending/failure, and analysis states.
3. Add light/dark, 390px, tablet/desktop, RTL, and high-zoom preview states.
4. Reconcile design-sync provenance for the mapped moderation surface.
5. Mark the audit/status complete only after the preceding stages land.

## Regression matrix for completion

At minimum the completed surface should verify:

1. default Moment selection;
2. Profile selection;
3. selection keyboard navigation;
4. selection visible focus;
5. initial loading state;
6. genuine empty queue;
7. service-unavailable queue state;
8. Retry reloads the resource;
9. multiple reports render independently;
10. Approve sends the correct item/type;
11. Reject sends the correct item/type;
12. approve/reject duplicate submission is suppressed;
13. mutation failure remains visible/retryable;
14. successful mutation removes/reloads the queue item;
15. Analyse sends the correct user ID;
16. analysis pending state is scoped appropriately;
17. analysis flags render safely;
18. no-flags result is distinguishable from unavailable analysis;
19. missing reported-user data does not issue an invalid analysis request;
20. report cards remain non-interactive containers;
21. all user-facing strings are translated;
22. mixed-direction names/reasons render safely;
23. light theme semantic-token parity;
24. dark theme semantic-token parity;
25. dynamic primary accent on selected/filter affordances where applicable;
26. 390px action reflow;
27. tablet/desktop composition;
28. 200% zoom;
29. 400% zoom/reflow;
30. touch targets meet the baseline;
31. reduced motion suppresses non-essential transitions;
32. focus remains deterministic after filter/mutation reloads;
33. no moderation content is logged or persisted by presentation code.

## Scope boundary

This issue is an audit/mapping stage only. It intentionally does **not**:

- change moderator authorization;
- change moderation API routes or payloads;
- alter approve/reject semantics;
- change risk-analysis algorithms;
- add analytics;
- add a public moderation route;
- fix the identified service fallbacks or skipped tests directly;
- change visual output or design-sync previews.

Those implementation changes belong to #6357-#6360 or to a dedicated correctness/security issue when the change exceeds UI migration scope.

## Rollback

This issue adds documentation only. Rollback is a normal revert of this audit file. There is no schema, API, runtime, routing, persisted-state, or deployment rollback requirement.

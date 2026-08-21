# Error boundary Spartan / Relay audit

Issue: #6168 (`Spartan UI 0386`)

Target: `frontend/src/app/components/error-boundary`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining `ErrorBoundaryComponent` under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit inventories every control, visible state, projected-content state, error-reporting side effect, input contract, accessibility requirement, localisation concern, theme concern and migration risk in the component. It intentionally does not redesign the analytics backend, change economy business logic, introduce a new global Angular error-handler contract, or alter routing.

The current component already uses Spartan Helm Button behaviour for both actions. The main follow-up work is therefore not to invent another interaction primitive. It is to preserve those native button semantics, clarify the component's ownership and error-capture contract, remove accessibility and privacy hazards, align presentation with Relay, and add regression coverage.

## Current surface and repository usage

`ErrorBoundaryComponent` is a standalone projected-content boundary. In the healthy state it renders `<ng-content />`. When `handleBoundaryError(error)` is called, it replaces projected content with a centred fallback containing an economy-themed icon, translated title and message, a raw error summary, an optional Retry action and an always-present Report action.

Repository search currently finds no production template usage of the `app-error-boundary` selector outside the component itself. The class is also not imported by another production component. That means the component is currently an available utility rather than an integrated route boundary.

This matters for the migration:

- do not invent a host or route contract in the Spartan conversion;
- do not claim that this component catches application rendering failures globally;
- do not add route navigation simply to make Retry appear more useful;
- if a future feature integrates the component, that integration should explicitly define how errors reach `handleBoundaryError()` and what resetting the local state is expected to retry.

The component has no route of its own and performs no navigation.

## Public component contract

### Inputs

| Input       | Current default | Contract                                                         |
| ----------- | --------------- | ---------------------------------------------------------------- |
| `fullPage`  | `false`         | Adds `min-h-screen` to the fallback container when true          |
| `showRetry` | `true`          | Controls whether the Retry action is rendered                    |
| `context`   | `'economy'`     | String forwarded as `boundaryContext` in economy crash telemetry |

There are no outputs.

The lack of a Retry output is significant. `resetError()` only clears this component's local state and restores projected content. It does not ask a parent to re-run an API request, recreate a child, reload a route or perform any feature-specific recovery.

### Internal state

| State          | Type           | Purpose                                            |
| -------------- | -------------- | -------------------------------------------------- |
| `hasError`     | signal         | Switches between projected content and fallback UI |
| `errorSummary` | signal         | Stores the visible diagnostic message              |
| `lastError`    | private `Error | null`                                              | Retains the captured error for a later manual report |

## Complete state inventory

| State                         | Trigger                                              | Current rendering / behaviour                               | Target owner                         |
| ----------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| Healthy                       | initial state or `resetError()`                      | projected content only                                      | Feature composition                  |
| Error captured                | `handleBoundaryError(error)`                         | projected content replaced by fallback                      | Feature state + Relay presentation   |
| Full-page error               | `hasError` and `fullPage === true`                   | fallback gains `min-h-screen`                               | App composition                      |
| Embedded error                | `hasError` and `fullPage === false`                  | fallback has minimum 300px height                           | App composition                      |
| Retry available               | `showRetry === true`                                 | Retry and Report buttons render                             | Feature configuration + Spartan Helm |
| Retry hidden                  | `showRetry === false`                                | Report button only                                          | Feature configuration + Spartan Helm |
| Reset                         | Retry button or direct `resetError()` call           | clears error state and restores projected content           | Feature state                        |
| Automatic report              | every `handleBoundaryError()` call                   | crash is sent through `EconomyErrorHandlerService`          | Reporting service                    |
| Manual report                 | Report button with a retained `lastError`            | same error is reported again with a smaller context payload | Reporting service                    |
| Report with no retained error | direct `reportCrash()` before capture or after reset | no-op                                                       | Feature guard                        |

There is no loading, pending, success or failure UI for report delivery because reporting is deliberately fire-and-forget.

## Complete control inventory

There are exactly two interactive controls in the component.

| Control | Visibility         | Current implementation                                                  | Behaviour             | Target ownership                             |
| ------- | ------------------ | ----------------------------------------------------------------------- | --------------------- | -------------------------------------------- |
| Retry   | `showRetry()`      | native `<button hlmBtn type="button" size="touch">`                     | calls `resetError()`  | Spartan Helm Button + feature recovery state |
| Report  | always in fallback | native `<button hlmBtn type="button" variant="secondary" size="touch">` | calls `reportCrash()` | Spartan Helm Button + reporting service      |

No link, input, checkbox, select, menu, dialog, sheet, popover, tooltip or custom pointer target exists in the component.

No interactive element is omitted from this mapping.

## Spartan ownership

### Spartan Brain / Helm

Both controls are ordinary buttons and already use the approved Spartan Helm Button implementation. They retain native button semantics, explicit `type="button"` and the repository touch size.

No additional Brain primitive is justified by the current behaviour:

- no Dialog is needed because the fallback replaces content rather than overlaying it;
- no Alert Dialog is needed because neither action is destructive;
- no Menu, Popover or Tooltip is present;
- no form-control Brain primitive is needed;
- no custom keyboard state machine should be introduced.

Issue #6169 should therefore preserve `hlmBtn` ownership and focus on removing any remaining feature-owned interaction behaviour only where a real duplication exists. It should not replace native buttons with clickable containers or add a custom wrapper solely for visual consistency.

### Relay / app composition

Relay and feature composition own the fallback presentation:

- semantic surface, text and status roles;
- radius and elevation if a card treatment is used;
- spacing and responsive reflow;
- light/dark theme parity;
- per-user primary accent inheritance for the primary Retry action;
- translated copy layout;
- high-zoom behaviour;
- error-detail presentation if technical detail remains visible.

The current template already uses Relay text roles (`text-text-primary`, `text-text-secondary`, `text-text-muted`) and does not hardcode product colours.

Do not force this component into `AppCardComponent` unless the programme decides that error fallbacks should share the card contract. A centred state without a card is a valid composition if it matches the Relay preview and contrast requirements.

## Error-capture contract

Despite its name, `ErrorBoundaryComponent` is not an automatic Angular error boundary. Angular does not provide a React-style component error-boundary mechanism, and this component does not register an `ErrorHandler`, directive or wrapper that intercepts descendant rendering exceptions.

An external caller must explicitly invoke:

```ts
handleBoundaryError(error: Error): void
```

That method currently:

1. stores the error in `lastError`;
2. sets `hasError` to true;
3. sets `errorSummary` to `error.message` or the hard-coded fallback `Unknown rendering error`;
4. calls `EconomyErrorHandlerService.reportEconomyCrash()` with `boundaryContext` and `renderingError: true`.

The Spartan conversion must not imply automatic capture that does not exist. If automatic descendant capture is required, define and test that integration separately rather than hiding it inside visual migration work.

## Retry contract

`resetError()`:

1. sets `hasError` to false;
2. clears `errorSummary`;
3. clears `lastError`.

It does not:

- emit an output;
- retry an HTTP request;
- recreate an Angular route;
- reload the page;
- clear a store;
- clear an error in a child component;
- report recovery telemetry.

This means Retry currently means "dismiss the local fallback and show projected content again", not "repeat the failed operation".

A future host may need a real retry output similar to domain-specific error boundaries, but that is a product/integration contract change and should not be silently added during the control conversion.

## Reporting and analytics contract

`ErrorBoundaryComponent` is coupled directly to `EconomyErrorHandlerService`.

### Automatic capture report

`handleBoundaryError()` calls:

```ts
reportEconomyCrash(error, {
  boundaryContext: context(),
  renderingError: true,
});
```

### Manual report

`reportCrash()` calls:

```ts
reportEconomyCrash(lastError, {
  boundaryContext: context(),
});
```

The manual report therefore omits `renderingError: true` even when reporting the exact same rendering failure. Preserve current behaviour unless the reporting contract is deliberately normalised with service tests.

### Service payload

`EconomyErrorHandlerService.reportEconomyCrash()` posts to the client-error analytics endpoint and currently includes:

- error message;
- error name;
- stack trace;
- current URL;
- user agent;
- timestamp;
- `category: 'economy'`;
- current coin balance from `EconomyStore` unless explicitly supplied;
- active transaction if supplied;
- boundary context;
- rendering-error flag;
- action if supplied;
- component stack if supplied.

It also records a bounded in-memory list of the 10 most recent crashes.

The request includes an Authorization header based on the current access token and is fire-and-forget. Reporting failures are swallowed to avoid recursive logging failure.

### Duplicate report behaviour

A captured error is automatically reported once. If the user then presses Report, the same retained error is reported a second time.

That may be intentional because the second event represents explicit user escalation, but the current payload does not include an explicit `manualReport` flag. Do not deduplicate or redefine this behaviour as incidental UI work. If analytics needs to distinguish automatic and manual reports, change the typed reporting contract with tests.

### No delivery acknowledgement

There is no pending, success or failure state for the Report button. Pressing Report can generate multiple requests and the user receives no acknowledgement.

The UI therefore must not claim successful delivery unless the reporting service becomes awaitable. A future acknowledgement can truthfully mean "report requested" while the service remains fire-and-forget.

## Economy coupling and naming risk

The generic selector and class name suggest a reusable application error boundary, but the implementation is economy-specific:

- default context is `economy`;
- the icon is a coin (`🪙`);
- telemetry always uses `EconomyErrorHandlerService`;
- crash metadata automatically reads the current coin balance;
- analytics category is always `economy`.

This mismatch is a migration risk.

Do not broaden the component to all application errors merely by changing visual copy. Choose one explicit direction in a separate implementation decision:

1. keep it economy-specific and rename/document it accordingly; or
2. make it genuinely generic by injecting a provider-neutral reporting contract and moving economy context to an economy host.

The Spartan tickets should not accidentally turn generic naming into generic telemetry while leaving hidden economy coupling behind.

## Navigation and host contract

The component has no route of its own and performs no navigation.

Repository search currently finds no production host using `<app-error-boundary>`.

Therefore there is no existing route contract to preserve beyond these negative guarantees:

- Retry must not start navigating unless a host explicitly defines that behaviour;
- Report must not navigate;
- error capture must not reload the browser;
- `fullPage` controls only fallback height, not routing or layout-shell ownership.

If a host is added later, document its route and recovery contract in that feature's tests.

## Accessibility audit

### Existing strengths

- Retry and Report are native `<button>` elements;
- both use Spartan `hlmBtn` behaviour;
- both specify `type="button"`;
- both use the repository touch size;
- visible button labels are translated;
- the coin glyph is correctly `aria-hidden="true"`;
- there are no click-only `<div>` elements;
- there are no synthetic button roles or manual tab indices.

### Error announcement

The fallback has no `role="alert"`, `aria-live` region or labelled status container.

When projected content is replaced by an error state, a screen-reader user may receive no immediate indication that the page changed. The accessibility pass should provide an appropriate semantic announcement without causing repeated announcements on every change-detection cycle.

A blocking replacement error normally warrants an assertive announcement. The exact pattern should follow the repository's shared error-state convention.

### Focus recovery on capture

When an error replaces projected content, keyboard focus can remain on an element that has been removed from the DOM. The component does not currently move focus to the error heading, container or Retry action.

This is the primary keyboard accessibility gap. Issue #6171 should add deterministic one-time focus recovery when entering the fallback state.

Do not move focus on every render or every signal update.

### Focus after Retry

Retry removes the button that currently owns focus and restores projected content. Because the component has no host retry contract, it also has no deterministic focus-restoration target.

The future implementation should define a safe generic strategy or require the host to own restoration. It must not leave focus effectively lost after the fallback disappears.

### Report feedback

Report has no `aria-busy`, disabled state, status message or confirmation. Because transport is fire-and-forget, avoid a false "sent" announcement. If feedback is added, use a polite status region with wording that reflects request initiation rather than confirmed delivery.

### Heading structure

The fallback uses an `<h2>`. That may be correct for a full-page host but can skip or duplicate levels when embedded.

Do not mechanically replace it without knowing the host hierarchy. If the component remains reusable, consider a labelled region or configurable heading strategy that does not require consumers to accept an invalid document outline.

### Touch and keyboard

Both controls should retain:

- native Enter and Space activation;
- visible Spartan focus treatment;
- touch-size hit areas;
- deterministic source order;
- no keyboard-only custom event handlers;
- no focus outline clipping at high zoom.

## Privacy and security audit

### Raw error message exposure

`errorSummary` renders `error.message` directly to the user.

Angular interpolation prevents HTML execution, but it does not prevent information disclosure. Error messages can contain:

- internal URLs;
- request identifiers;
- database or provider details;
- user identifiers;
- implementation-specific text;
- credential-bearing query strings if upstream code constructs unsafe errors.

The implementation stage should separate user-safe translated error copy from technical diagnostics. Raw stack traces are not rendered today and must remain out of the UI.

### Raw telemetry

The reporting service sends the error message, stack, current URL and user agent. The UI conversion must not add access tokens, full request payloads, message content or arbitrary untyped objects to this telemetry.

Any expansion of analytics metadata should be allow-listed and tested in the reporting layer.

### Context input

`context` is an arbitrary string. It is not rendered, but it is sent to telemetry. Hosts should pass bounded, non-sensitive component/action identifiers rather than user content.

### Authentication header

The error-reporting service creates an Authorization header even when no access token exists. That behaviour is outside this visual audit. Do not alter authentication semantics inside a Spartan UI ticket without service-level tests and backend contract review.

## Localisation audit

Visible product copy uses `TranslatePipe` for:

- title;
- explanatory message;
- Retry;
- Report.

The diagnostic summary is not translated because it comes from `Error.message`.

The hard-coded fallback string `Unknown rendering error` is user-visible when `error.message` is empty and therefore violates the translation-safe product-copy contract. Replace it with translated safe copy or keep it only in telemetry.

### Text expansion

The content area is constrained with `max-w-md`, but the action row does not currently wrap. Long translated Retry and Report labels can compete for width at 390px, large text and 400% zoom.

The conversion should allow actions to wrap or stack without clipping while retaining canonical Spartan sizes.

## RTL and bidi audit

The normal product copy is centred and direction-neutral. The component does not use physical `left`, `right`, `ml`, `mr`, `pl` or `pr` layout utilities.

The action row uses flex and gap, so it does not encode a physical direction assumption.

The raw diagnostic summary is a special case. Technical strings are often LTR even inside an RTL locale. `break-all` prevents overflow but does not provide bidi isolation. If technical detail remains visible, it should be isolated and wrapped in a way that does not scramble the surrounding Arabic/Hebrew reading order.

The coin glyph does not require mirroring.

## Theme and per-user accent audit

Current strengths:

- title uses `text-text-primary`;
- explanatory copy uses `text-text-secondary`;
- diagnostic detail uses `text-text-muted`;
- Retry uses the default Spartan button path and therefore should inherit the semantic primary token;
- Report uses the semantic Spartan secondary variant;
- no fixed hex, RGB, slate, blue, purple or other product colour is present in the template.

Issue #6170 should preserve token ownership and verify light/dark contrast rather than replacing already-semantic classes with hard-coded values.

Because `primary` is user-configurable, the Retry control must continue to derive its accent from the approved token path rather than a fixed fallback Ember value.

## Responsive and high-zoom audit

Current layout:

- fallback container: `flex min-h-[300px] flex-col items-center justify-center p-8`;
- optional full-page minimum height: `min-h-screen`;
- content: `max-w-md text-center`;
- actions: `flex justify-center gap-3`;
- technical summary: `break-all`.

Risks:

- `p-8` consumes significant width at the 390px baseline;
- the action row cannot wrap;
- two long translated button labels can overflow at high zoom;
- `min-h-screen` can be awkward on mobile browser chrome and nested shells;
- raw technical text can become extremely tall with `break-all`;
- restoring projected content after Retry can cause large layout and focus changes.

Issue #6170 should use mobile-first spacing and semantic Relay layout. Issue #6171 should explicitly verify 200% and 400% zoom, large text, touch reachability and focus visibility.

No animation is currently present, so reduced-motion requirements are naturally satisfied unless later tickets add transitions.

## Bespoke utility inventory

| Current styling / utility                 | Ownership assessment                   | Follow-up direction                                                        |
| ----------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `min-h-[300px]`                           | feature/layout-specific arbitrary size | Validate against embedded hosts; keep only if the minimum is intentional   |
| conditional `min-h-screen`                | host/layout behaviour                  | Verify mobile viewport behaviour; do not let it take route-shell ownership |
| `p-8`                                     | app composition                        | Revisit for 390px and 400% zoom                                            |
| `max-w-md`                                | app composition                        | Reasonable reading-width guard; verify long translations                   |
| `text-5xl` coin glyph                     | decorative feature identity            | Reconsider if component becomes generic                                    |
| `text-xl font-bold`                       | app typography                         | Align with Relay type scale during visual pass                             |
| `font-mono text-xs text-text-muted`       | technical-detail presentation          | Prefer not to expose raw diagnostics; otherwise keep semantic text role    |
| `break-all`                               | overflow guard                         | Replace with safer wrapping/bidi treatment if detail remains               |
| `flex justify-center gap-3`               | app layout                             | Add wrap/stack behaviour for narrow/high-zoom states                       |
| `hlmBtn size="touch"`                     | Spartan Helm interaction               | Keep                                                                       |
| `hlmBtn variant="secondary" size="touch"` | Spartan Helm interaction               | Keep                                                                       |

Tailwind layout utilities are not inherently a migration problem. The boundary should keep feature-owned layout where no Relay primitive provides value.

## Overlay, portal and stacking audit

There is no overlay, portal, backdrop, dialog, popover or z-index contract in this component.

The fallback replaces projected content in normal document flow. Do not introduce portal behaviour during migration unless a separate product requirement changes the error experience.

## Comparison with domain-specific error boundaries

The repository contains several domain-specific error boundaries, including Discovery, SRS, reading-engine, video-classroom and admin variants.

They show a broader pattern that this generic-looking component does not yet implement consistently:

- explicit typed context objects;
- retry outputs owned by the host;
- manual-report outputs;
- report-request acknowledgement;
- `role="alert"` fallback semantics;
- domain-specific telemetry enrichment;
- repeated-error tracking in some implementations.

This is a convergence opportunity, but it is also a migration hazard. Do not extract a new universal error-boundary abstraction inside #6168 or #6169 without first reconciling telemetry, recovery, privacy and host contracts across all variants.

A visual design-system migration is not the right place to standardise crash-report payloads by accident.

## Test audit

`error-boundary.component.spec.ts` exists but the entire suite is currently disabled with `describe.skip`.

The skipped tests cover:

- component creation;
- fallback rendering after error capture;
- reset state;
- automatic economy crash reporting;
- healthy-state rendering.

They do not currently cover:

- `showRetry = false`;
- `fullPage = true`;
- Report button manual reporting;
- repeated Report activation;
- report invocation after reset;
- projected-content preservation/restoration;
- translated fallback for an empty `Error.message`;
- alert/live-region semantics;
- focus recovery on capture;
- focus after Retry;
- native/Spartan button ownership;
- light/dark themes;
- RTL;
- 390px layout;
- 200% and 400% zoom;
- long translated labels;
- raw-error privacy hardening;
- current no-host/no-route contract.

Issue #6172 should re-enable and modernise the suite rather than adding another parallel test file with the original suite still skipped.

## Regression matrix for the follow-up sequence

At minimum, the completed surface should lock these behaviours:

1. healthy state projects child content;
2. `handleBoundaryError()` swaps projected content for fallback;
3. automatic reporting occurs exactly according to the current service contract;
4. fallback title/message use translated product copy;
5. technical error text is not exposed if privacy hardening removes it;
6. Retry is a native Spartan button;
7. Report is a native Spartan button;
8. `showRetry = false` removes only Retry;
9. `fullPage = true` preserves the intended full-page layout contract;
10. Retry clears local error state;
11. Retry does not navigate or reload;
12. manual Report preserves the intended analytics behaviour;
13. report delivery failure does not crash the UI;
14. capture moves focus deterministically to the fallback experience;
15. Retry does not leave focus stranded on a removed button;
16. the fallback is announced appropriately to assistive technology;
17. action labels remain usable with long translations;
18. 390px layout has no horizontal scroll;
19. 200% and 400% zoom keep all required controls reachable;
20. RTL does not introduce physical-direction regressions;
21. technical LTR strings, if retained, do not corrupt bidi layout;
22. light and dark themes retain contrast;
23. Retry inherits the per-user primary accent through Relay/Spartan tokens;
24. forced-colour mode retains visible controls and focus;
25. no animation is introduced without reduced-motion handling;
26. no route/navigation side effect appears unexpectedly;
27. no secret or arbitrary sensitive metadata is added to crash telemetry;
28. the component's economy coupling is explicit until separately refactored;
29. tests are no longer skipped;
30. design-preview coverage records the final error states once the visual contract changes.

## Migration risks

### High: misleading generic ownership

The component is named generically but is economy-specific in iconography, state defaults and telemetry. A visual refactor can easily broaden reuse without broadening the reporting contract correctly.

Mitigation: keep scope explicit. Do not market or wire it as a global boundary until reporting ownership is provider-neutral.

### High: raw diagnostic disclosure

Rendering `Error.message` can expose technical or sensitive information.

Mitigation: use translated user-safe fallback copy and keep technical diagnostics in sanitised telemetry.

### High: no automatic capture mechanism

The component does not catch descendant Angular errors automatically.

Mitigation: document and test the invocation contract before adding hosts. Do not claim global protection from a visual migration.

### Medium: focus loss

Projected controls can disappear while retaining focus, and Retry itself disappears after activation.

Mitigation: implement deterministic entry and recovery focus behaviour during #6171.

### Medium: Retry semantics are weaker than the label suggests

Retry only dismisses the local fallback.

Mitigation: preserve existing behaviour for migration, then add a host-owned retry contract only if product integration requires it.

### Medium: report spam / ambiguity

The manual Report action can be pressed repeatedly, and there is no acknowledgement or distinction from the automatic report in the visible UI.

Mitigation: preserve analytics semantics during migration. Consider idempotency, pending state or report-request feedback as a separately tested reporting UX improvement.

### Medium: disabled tests

The complete component suite is skipped, so current behaviour is not protected by the standard frontend unit gate.

Mitigation: #6172 should re-enable and expand the suite.

### Low: narrow/high-zoom action overflow

The action row does not wrap.

Mitigation: add mobile-first wrapping/stacking and verify 390px plus 400% zoom.

## Prerequisite primitive work

No new Spartan Brain primitive is required for this component.

Before or during the follow-up tickets, confirm:

- canonical Spartan primary and secondary Button variants remain the approved action layer;
- the repository's shared focus-recovery pattern is available for replacement error states;
- Relay error/status surface tokens are documented if a card treatment is introduced;
- translation keys exist for any user-safe replacement of the raw fallback diagnostic;
- the design preview has an error-state pattern appropriate for embedded and full-page variants.

Do not block the conversion on extracting a universal error-boundary primitive.

## Recommended implementation sequence

### #6169 - controls and interactions

- keep both controls on Spartan Helm Button;
- remove no native semantics;
- make any report-request interaction changes explicit and tested;
- do not add a new Brain primitive without a real interaction state machine;
- preserve local reset semantics unless a separate host contract is intentionally introduced.

### #6170 - Relay tokens, responsive layout and theme parity

- preserve semantic text and button token paths;
- define mobile-first spacing at 390px;
- make the action layout wrap/stack safely;
- verify light/dark and per-user primary accent behaviour;
- decide whether the decorative coin belongs if the component remains economy-specific;
- avoid hard-coded colours.

### #6171 - accessibility, RTL, zoom and input methods

- add error announcement semantics;
- implement one-time focus recovery on capture;
- define focus behaviour after Retry;
- verify native keyboard/touch activation;
- verify RTL and bidi handling;
- verify 200% and 400% zoom;
- verify forced-colour and long-translation states.

### #6172 - regression tests and design preview

- remove `describe.skip`;
- cover the full state/control/reporting matrix;
- add explicit light/mobile and dark/wider visual states if the contract changes;
- include Retry-hidden and full-page variants where useful;
- update the Spartan audit/design status to reflect completed migration.

## Acceptance-criteria traceability

### No interactive element omitted

Complete. Retry and Report are the only interactive controls and both are mapped to Spartan Helm Button ownership.

### Existing behaviour, analytics hooks and route contracts recorded

Complete. This audit records local reset semantics, automatic/manual economy crash reporting, fire-and-forget delivery, telemetry fields, lack of navigation, lack of a current production host and lack of automatic Angular error capture.

### Migration risks and prerequisite primitive work identified

Complete. The highest-risk items are generic naming versus economy coupling, raw error disclosure, missing automatic capture, focus loss, weak Retry semantics, report ambiguity and the skipped regression suite. No new Brain primitive is required.

## Verification guidance

Because #6168 is documentation-only, it does not change runtime code or the mapped visual contract. The implementation follow-ups should use the repository's canonical frontend verification commands from `frontend/package.json`, including unit tests, static analysis and production build, plus constitution/design-sync/Spartan ownership gates where applicable.

For this audit PR, repository CI remains authoritative for formatting, governance and cross-project regression checks.

## Audit conclusion

`ErrorBoundaryComponent` is already correctly based on native Spartan Helm buttons and does not need a new interaction primitive. The migration should concentrate on ownership clarity, Relay presentation, accessibility and safety.

The two most important architectural facts to preserve are that Retry currently only clears local fallback state and that the apparently generic component is actually economy-specific. The two most important defects to address in follow-up work are raw diagnostic exposure and focus/announcement behaviour when projected content is replaced.

Treat the component as an explicit, host-invoked economy error fallback until a separate provider-neutral error-boundary design is deliberately adopted and tested.

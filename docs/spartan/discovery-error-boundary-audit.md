# Discovery error boundary Spartan / Relay audit

Issue: #6133 (`Spartan UI 0351`)

Target: `frontend/src/app/components/discovery-error-boundary`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining `DiscoveryErrorBoundaryComponent` under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit inventories every control, visible state, projected-content state, error-reporting side effect, parent contract, accessibility requirement, localisation concern, theme concern and migration risk in the boundary. It intentionally does not redesign Discovery search, partner filtering, analytics storage, global error handling or the `/discovery` route.

The current component already uses Spartan Button behaviour for its manual-report action and a repository primary-button wrapper for retry. The follow-up implementation should converge those controls onto the approved interaction layer, preserve the existing retry/report contracts, and remove presentation and accessibility drift without turning an error boundary into a new bespoke design-system primitive.

## Current surface and host

`DiscoveryErrorBoundaryComponent` is a standalone content boundary used by `DiscoveryComponent`. The Discovery page wraps its route content with:

```html
<app-discovery-error-boundary
  [context]="errorBoundaryContext()"
  [showReportButton]="true"
  (retry)="searchPartners()"
>
  ...
</app-discovery-error-boundary>
```

The boundary has no route of its own. Its route contract is inherited from the host Discovery surface at `/discovery`.

When healthy it renders projected Discovery content. When `captureError()` is invoked it replaces that content with a centred error card.

There are no dialogs, sheets, menus, popovers, tooltips, form fields, selects, checkboxes or navigation links in the boundary itself.

## Public component contract

### Inputs

| Input              | Current default            | Contract                                                                                |
| ------------------ | -------------------------- | --------------------------------------------------------------------------------------- |
| `context`          | `{ component: 'unknown' }` | Supplies component/operation/filter/language/count/sort/radius metadata for diagnostics |
| `showReportButton` | `true`                     | Controls whether the manual-report action is rendered                                   |

`DiscoveryErrorContext` can carry:

- `component`;
- `operation`;
- `filterType`;
- `targetLanguage`;
- `nativeLanguage`;
- `partnerCount`;
- `sortMode`;
- `radiusKm`;
- arbitrary `metadata`.

### Outputs

| Output        | Trigger         | Current host behaviour                                      |
| ------------- | --------------- | ----------------------------------------------------------- |
| `retry`       | `resetError()`  | Discovery binds this to `searchPartners()`                  |
| `reportError` | `reportCrash()` | Optional parent notification containing the current context |

The Spartan / Relay conversion must preserve these contracts unless a separate feature change explicitly revises them.

## Complete state inventory

| State                   | Trigger                                    | Current rendering / behaviour                                  | Target owner                                          |
| ----------------------- | ------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------- |
| Healthy                 | initial state or successful reset          | projected Discovery content only                               | Feature composition                                   |
| Error captured          | `captureError(error, message?, metadata?)` | projected content replaced by error card                       | Feature state + Relay presentation                    |
| Error with message      | `errorMessage()` non-empty                 | message rendered in a monospace detail panel                   | Feature, with privacy hardening required              |
| Repeated error          | `errorCount() > 1`                         | extra diagnostic hint rendered                                 | Feature, but currently not translation-safe           |
| Report action available | `showReportButton() === true`              | Retry plus Report controls                                     | Feature configuration + Spartan buttons               |
| Report action hidden    | `showReportButton() === false`             | Retry only                                                     | Feature configuration                                 |
| Report requested        | `reportCrash()` called                     | success-coloured acknowledgement appears immediately           | Feature state, but delivery is not actually confirmed |
| Reset                   | Retry action                               | error/message/report/count state cleared, then `retry` emitted | Feature state                                         |

There is no loading or pending state for reporting because reporting is fire-and-forget.

## Complete control inventory

| Control      | Current implementation       | Behaviour                                                     | Target ownership                                         | Audit action                                                                                              |
| ------------ | ---------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Retry        | `app-button-primary` wrapper | calls `resetError()`, clears local error state, emits `retry` | Approved repository composition over Spartan Helm Button | Preserve behaviour; converge wrapper/import strategy if programme standard requires it                    |
| Report error | native `<button hlmBtn>`     | calls `reportCrash()`                                         | Spartan Helm Button                                      | Keep native semantics; use an approved secondary/outline variant rather than feature-owned button styling |

There are exactly two interactive controls in the boundary. No interactive element is omitted from this mapping.

## Spartan ownership

### Spartan Brain / Helm

Both actions are ordinary buttons. They do not require a custom state machine or a new Brain primitive.

The Report action is already a native button enhanced with `hlmBtn`, which is the correct semantic foundation. Retry currently uses `AppButtonPrimaryComponent`, a repository wrapper around the primary button contract. The follow-up conversion should follow the programme's active button-import standard and avoid maintaining two visually similar but independently styled button paths inside one small error surface.

No Dialog, Alert Dialog, Menu, Popover, Tooltip, Select or other Spartan Brain primitive is justified by the current interaction model.

Do not introduce a modal solely for reporting an error unless product requirements separately add confirmation or report details.

### Relay / app composition

Relay owns the visual composition around the controls:

- error-card surface and border roles;
- danger, success and neutral status roles;
- spacing and responsive layout;
- typography;
- detail-panel surfaces;
- light/dark theme parity;
- per-user primary accent inheritance through the primary action;
- high-zoom reflow;
- forced-colour compatibility where shared controls expose it.

The current template is already substantially semantic, using `rounded-sheet`, `bg-danger/10`, `text-danger`, `bg-surface-200`, `text-text-secondary`, `text-text-muted` and `text-success`.

The main control styling drift is the Report button's feature-owned border, padding, radius, typography and hover classes despite already using `hlmBtn`. A follow-up should express these through the canonical Spartan variant/size plus only layout classes that the component genuinely owns.

## Error capture contract

`captureError()` currently:

1. sets `hasError`;
2. increments `errorCount`;
3. stores the supplied message or thrown error message;
4. creates an enriched `DiscoveryError`;
5. calls `reportErrorInternal()`.

`reportErrorInternal()` then reports through two paths:

1. `DiscoveryErrorHandlerService.reportDiscoveryCrash()`;
2. `GlobalErrorHandler.handleError()` with a `DiscoveryContextError` wrapper.

The conversion must not accidentally remove diagnostic reporting, but it also must not change its payload semantics as incidental UI work.

## Reporting and observability audit

### Discovery-specific analytics path

`DiscoveryErrorHandlerService.reportDiscoveryCrash()` sends a fire-and-forget POST to the client-error analytics endpoint. Its current payload includes:

- error message, name and stack;
- current URL;
- user agent;
- timestamp;
- discovery category;
- filter type;
- target/native language;
- partner count;
- sort mode;
- radius;
- boundary context;
- rendering-error flag.

It also records a bounded in-memory recent-crash summary.

### Global error path

The boundary additionally wraps the same error in `DiscoveryContextError` and passes it to `GlobalErrorHandler`.

That wrapper stores `discoveryContext`, including merged `context.metadata`, `extraMetadata`, error count and timestamp. However, the current `GlobalErrorHandler.reportError()` serialises only ordinary `Error` fields such as message, name and stack plus URL/user-agent/timestamp. It does not serialise the custom `discoveryContext` property.

Therefore the extra metadata assembled by `reportErrorInternal()` is currently not present in the global client-error payload. The implementation ticket must not claim otherwise.

If richer metadata is required, fix the error-reporting contract explicitly with sanitisation and tests rather than broad object serialisation from the UI.

### Duplicate event risk

A single boundary capture can currently produce two client-error submissions: one through the discovery-specific service and one through the global handler. A manual Report after capture repeats both paths.

This may be intentional to retain both domain-specific and global diagnostics, but it should be verified before changing behaviour. If one canonical event is desired, address deduplication as an observability change with backend/client tests, not as visual migration cleanup.

### Manual report acknowledgement

`reportCrash()` immediately sets `reportedMessage` to `true`, creates a `DiscoveryManualReport`, invokes both reporting paths, then emits `reportError`.

Both transport paths are fire-and-forget and swallow delivery failure. The UI cannot know whether the server accepted the report.

The acknowledgement therefore means "report requested", not "report successfully delivered". Product copy and accessibility semantics should not overstate delivery guarantees unless the reporting API becomes awaitable.

### Unused structured-payload helper

`DiscoveryErrorBoundaryComponent.buildCrashPayload()` and its local stack parser provide a structured payload shape and are directly unit-tested. Current production reporting does not call this helper. Similar error-boundary components contain equivalent helpers and stack parsers.

The conversion should not wire this helper into production merely because it exists. If stack parsing is meant to be canonical, consolidate it in the reporting layer across error boundaries rather than introducing a discovery-only third reporting path.

## Navigation and parent contracts

The boundary performs no navigation itself.

Its important host contracts are:

- it is rendered inside `/discovery`;
- healthy state projects the complete child Discovery UI unchanged;
- error state replaces projected content instead of overlaying it;
- Retry clears local boundary state before emitting `retry`;
- the Discovery host binds Retry to `searchPartners()`;
- Report does not navigate away;
- Reset does not reload the page or use browser history.

The conversion must not replace Retry with `window.location.reload()`, route navigation or a hard refresh.

## Privacy and security audit

The boundary is an error-reporting surface, so data exposure is more sensitive than on a normal presentation card.

Current telemetry can include:

- raw error messages;
- stack traces;
- current URL;
- user agent;
- discovery filters and language codes;
- partner counts;
- component identity.

The UI conversion must not add credentials, access tokens, message bodies, profile PII or other secrets to this context.

### Raw error rendering

`errorMessage()` is rendered directly into the fallback card. Angular interpolation protects against HTML injection, but it does not prevent information disclosure. Exception messages can contain networking detail, URLs, internal identifiers or implementation wording.

The implementation stage should separate:

- translated, user-safe error copy; and
- technical diagnostic detail retained for telemetry or development diagnostics.

If raw technical messages remain visible, that decision should be explicit and tested. Stack traces, credential-bearing URLs, SQL/Supabase detail and sensitive identifiers must not be rendered to end users.

### Metadata boundary

`DiscoveryErrorContext.metadata` and `captureError(..., extraMetadata)` accept `Record<string, unknown>`, but the current global serializer does not send those custom values. Do not "fix" this by blindly serialising arbitrary objects.

Any future metadata transport should use an allow-listed, typed, sanitised payload in the reporting service.

## Accessibility audit

### Existing strengths

- fallback state uses `role="alert"`;
- the decorative magnifying-glass glyph is `aria-hidden`;
- Retry and Report are button-based controls;
- action labels use translated visible copy;
- Report uses logical `ps` / `pe` padding;
- acknowledgement includes visible text rather than colour alone;
- there is no click-only `div`, synthetic tabindex or custom keyboard handler.

### Alert semantics

The fallback container uses `role="alert"`, creating an assertive live region when the blocking error state appears. This is appropriate for a replacement state, provided the component does not repeatedly reconstruct the same alert and cause duplicate announcements.

The fallback heading should remain a semantic heading. Its final level should be validated in the rendered Discovery page hierarchy rather than changed mechanically in isolation.

### Focus recovery

When an error replaces projected Discovery controls, keyboard focus can remain on a DOM node that has just been removed. The current component does not move focus to the fallback heading, container or Retry action.

This is the primary interaction accessibility gap. The implementation should provide deterministic, one-time focus recovery when entering error state, using the repository's accessibility pattern.

Do not move focus on every change-detection pass.

### Focus after Retry

Retry immediately removes the fallback controls, restores projected content and emits the parent search action. The implementation must avoid leaving focus on a removed Retry button.

The real `/discovery` host should be tested because its loading state determines the most useful destination/status after retry.

### Report acknowledgement

If the acknowledgement remains, meaningful state change should be exposed through a polite status region. It should not be another assertive alert.

### Keyboard and touch behaviour

Both actions must retain:

- native Space/Enter activation;
- visible focus;
- no synthetic `role="button"`;
- no manual `tabindex`;
- repository touch-target sizing at mobile baseline;
- non-overlapping focus outlines at high zoom.

## Localisation audit

Most visible copy correctly uses `TranslatePipe`, including title, description, Retry label, Report label and report acknowledgement.

Two current paths violate or risk the translation-safe contract:

1. `errorDetailHint()` builds the hard-coded English string `Error count: ... Last context: ...`.
2. `captureError()` can fall back to hard-coded English `Unknown error in discovery component`, and the resulting message is rendered.

If repeated-error detail remains user-visible, move it to translated copy with interpolation. If it is developer-only diagnostic information, remove it from the user surface instead.

Exception messages are not translation keys and must not be treated as product copy.

### Text expansion

The card uses `max-w-md` and wrapping layout. Tests should cover longer translated title, description and action labels. Shared Button composition must allow reflow without clipping.

The technical message currently uses `break-all`. If any diagnostic detail remains visible, prefer wrapping that prevents overflow without unnecessarily breaking ordinary words.

## RTL audit

The boundary is largely direction-neutral.

Current strengths:

- Report padding uses `ps-*` and `pe-*`;
- button row uses flex/gap rather than physical margins;
- text is centred;
- no physical `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*` or `pr-*` positioning utility is present.

The conversion should preserve logical-direction utilities. The magnifying-glass decoration does not require mirroring.

Long LTR diagnostic strings inside an RTL locale must not force the card out of bounds. If technical detail remains visible, verify bidi isolation and wrapping.

## Theme and user-accent audit

The fallback already uses Relay semantic status/surface/text roles rather than fixed hex colours. Preserve this foundation.

Required behaviour:

- danger surface/border/text remain legible in light and dark themes;
- neutral detail panels maintain sufficient contrast;
- success acknowledgement remains legible;
- Retry inherits the user's primary accent through the approved primary-button token path;
- Report uses a semantic shared button variant rather than hand-coded border/hover colours;
- forced-colour mode preserves visible control boundaries and focus.

No raw product colour should be introduced by the conversion.

## Responsive and zoom audit

The current fallback uses `max-w-md`, `space-y-4`, `p-6` and a wrapping action row.

Implementation requirements:

- fit at the 390px mobile baseline without horizontal scrolling;
- tolerate browser text enlargement and 400% zoom;
- allow long translated action labels to wrap or stack;
- keep both actions reachable without overlap;
- keep technical text, if retained, inside the card;
- preserve adequate touch targets when actions wrap;
- avoid viewport-height assumptions that clip the fallback.

The current `flex flex-wrap justify-center gap-3` behaviour is a good baseline unless shared button composition replaces it with an equivalent responsive pattern.

## Styling and bespoke utility inventory

| Current styling                                                     | Ownership assessment            | Follow-up direction                                       |
| ------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------- |
| `rounded-sheet`                                                     | Relay semantic radius           | Keep                                                      |
| `border-danger/30 bg-danger/10`                                     | Relay status presentation       | Keep if contrast checks pass                              |
| `text-danger`                                                       | Relay status text               | Keep                                                      |
| `bg-surface-200`                                                    | Relay surface role              | Keep                                                      |
| `text-text-secondary`, `text-text-muted`                            | Relay text roles                | Keep                                                      |
| `text-success`                                                      | Relay success role              | Keep                                                      |
| `max-w-md`, spacing, centring                                       | App composition                 | Keep after reflow testing                                 |
| `text-[11px]`                                                       | bespoke micro typography        | Review against design-system type scale and accessibility |
| Report `rounded-app border ... ps-4 pe-4 pt-2.5 pb-2.5 ... hover:*` | feature-owned button appearance | Replace with shared Spartan variant/size                  |
| Retry `customClass="text-xs"`                                       | feature-owned wrapper override  | Prefer canonical size/typography variant                  |

The audit does not require eliminating every Tailwind layout utility. Relay owns semantic visual roles; feature composition still owns necessary layout.

## Cross-component convergence risk

`reading-engine-error-boundary`, `video-classroom-error-boundary` and other feature error boundaries contain strongly similar state, template, report and stack-parsing patterns.

That similarity is a programme-level convergence opportunity, but it is also a migration hazard. Do not extract a new shared error-boundary abstraction inside #6133 unless ownership, translation keys, telemetry contracts and focus behaviour can be defined consistently across all consumers.

A narrow Discovery migration is safer than a premature generic primitive. If a shared boundary is later created, it belongs in app/Relay composition rather than Spartan Brain because the state is feature/error-reporting state, not a headless widget interaction.

## Migration risks

1. **Projected-content regression:** healthy and fallback states could render together or projected state could be destroyed unexpectedly.
2. **Retry semantic drift:** a visual rewrite could reload/navigate instead of preserving `resetError()` plus `retry.emit()`.
3. **Button ownership duplication:** retaining wrapper-specific styling and direct `hlmBtn` styling perpetuates two paths.
4. **False report success:** acknowledgement is set before delivery can be known.
5. **Duplicate analytics:** one capture currently enters two reporting paths.
6. **Lost diagnostic enrichment:** custom `discoveryContext` metadata is constructed but not serialised by `GlobalErrorHandler`.
7. **Sensitive detail exposure:** raw exception messages are rendered to users.
8. **Focus loss:** replacing projected controls can leave keyboard focus on a removed node.
9. **Untranslated diagnostic copy:** repeated-error hint and fallback error string contain hard-coded English.
10. **Alert over-announcement:** careless rerendering can repeatedly announce the whole fallback.
11. **Report spam:** Report is not disabled after activation and can generate repeated telemetry submissions.
12. **Dead helper drift:** `buildCrashPayload()` duplicates stack parsing but is not the production reporting path.
13. **Premature shared abstraction:** sibling error boundaries are similar but have domain-specific telemetry and translation contracts.

## Prerequisite and follow-up primitive work

No missing Spartan Brain primitive blocks this surface.

The implementation can use existing capabilities:

- Spartan Button for Retry and Report;
- Relay semantic surfaces/status/text roles;
- native alert/status/heading semantics;
- feature-owned signals for error/report state.

Before implementation, confirm the canonical primary and secondary Button import/variant path so the component does not introduce another wrapper.

No new card, alert or error-boundary Brain primitive should be created solely for this ticket.

## Existing test coverage

The current Vitest suite covers:

- component creation;
- fallback rendering after capture;
- reset behaviour;
- discovery analytics POST on capture;
- discovery context fields in the analytics payload;
- manual report acknowledgement;
- Retry output;
- Report output context;
- repeated error counting and reset;
- structured crash-payload stack parsing.

The suite already provides a useful regression base, but it does not cover focus recovery, hidden Report state, keyboard/touch ownership, translation-safe repeated-error content, theme/RTL/reflow, duplicate Report activation or the real Discovery host retry flow.

## Regression coverage required by the implementation stage

The conversion stage should preserve existing coverage and add focused tests for:

1. healthy state projects child content;
2. capture replaces projected content rather than overlaying it;
3. Retry uses the approved native/Spartan button path;
4. Report uses the approved native/Spartan button path;
5. `showReportButton=false` removes only Report;
6. Retry clears message/report/count state before emitting;
7. Report emits exactly the current context;
8. acknowledgement has polite live-region semantics if retained;
9. entering error state restores focus to a stable fallback target;
10. Retry does not leave focus on a removed control;
11. no hard-coded user-visible English remains in repeated-error/fallback paths;
12. long translated labels and descriptions reflow without overflow;
13. 390px mobile layout keeps actions usable;
14. high zoom does not cause horizontal page scrolling;
15. RTL rendering contains no physical-direction utility regressions;
16. light and dark themes preserve danger/surface/control contrast;
17. user-accent changes continue to flow through the primary action;
18. raw technical content is hidden or explicitly sanitised/tested for display;
19. repeated Report activation is bounded if a report-request guard is added;
20. existing discovery and global reporting paths remain intentional and tested;
21. the host `/discovery` Retry binding still invokes `searchPartners()`;
22. `buildCrashPayload()` is either retained as a deliberately separate utility or removed/consolidated with tests in a dedicated observability change.

## Design preview contract

This audit changes documentation only, so it does not itself require a design-preview edit.

When the implementation ticket changes rendered control variants, focus state or fallback styling, update `frontend/design-preview/components/component-system.html` with mapped Discovery error-boundary states.

At minimum the completed preview should show:

- light/mobile fallback with Retry and Report;
- dark/wider fallback;
- long-content or repeated-error state if diagnostic detail remains visible;
- report acknowledgement state if retained.

The preview must use the same Relay semantic roles and Spartan button variants as production.

## Recommended implementation sequence

1. Preserve public inputs/outputs and healthy/error projection semantics.
2. Converge Retry and Report onto the approved Spartan Button composition.
3. Replace feature-owned button appearance with canonical variants and touch sizing.
4. Remove or translate hard-coded repeated-error and fallback copy.
5. Decide whether raw technical error messages are appropriate for end users; separate user copy from diagnostics if not.
6. Add deterministic focus recovery when projected content is replaced.
7. Give report acknowledgement accurate status semantics and bound duplicate Report activations if possible without inventing delivery guarantees.
8. Preserve reporting payloads unless duplicate/lost-context behaviour is intentionally addressed as a separate observability change.
9. Avoid adding another structured crash path from `buildCrashPayload()` without convergence work.
10. Add the regression coverage above.
11. Sync the mapped Relay + Spartan design preview for visual changes.
12. Run the repository frontend and design-system verification gates.

## Definition of done for the conversion

The discovery error boundary is fully migrated when:

- both interactive controls have one clear Spartan ownership path;
- no feature-owned button styling duplicates Helm variants;
- healthy projection, error replacement, Retry and Report contracts are preserved unless explicitly documented;
- focus recovery works when fallback content replaces active projected content;
- all product-facing copy is translation-safe;
- raw diagnostic information does not leak sensitive implementation detail;
- report acknowledgement does not overstate delivery guarantees;
- light/dark, user accent, RTL, mobile and high-zoom behaviour are verified;
- telemetry remains diagnosable and sanitised;
- regression tests cover the state and interaction matrix;
- design preview is synchronised when implementation changes visual behaviour.

## Audit conclusion

`DiscoveryErrorBoundaryComponent` does not need a new Spartan Brain primitive. Its interaction model is two standard actions surrounding feature-owned error state. The correct migration is to keep that state in the boundary, converge both actions onto the approved Spartan Button layer, and keep Relay responsible for semantic presentation.

The highest-value follow-up work is not a visual rewrite. Focus recovery is missing when projected content is replaced, user-visible diagnostic copy contains hard-coded English, raw exception messages can expose technical detail, Report acknowledgement is not backed by confirmed delivery, and the component currently enters two reporting paths while custom discovery metadata added to the global wrapper is not serialised. Those behaviours should be handled deliberately without weakening the existing Discovery retry contract.

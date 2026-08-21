# Events feed Spartan / Relay audit

Issue: #6183 (`Spartan UI 0401`)

Target: `frontend/src/app/components/events-feed`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining `EventsFeedComponent` under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit inventories every interactive control, state, data request, pagination transition, failure path and presentation primitive in the events feed. It is behaviour-neutral. Follow-up implementation must preserve the authenticated `/events` API contract, the `upcoming` / `past` filter meaning, language-pair filtering, 20-item page size and append-style pagination while moving reusable interaction and presentation concerns into the approved ownership layer.

The component is partly converged already. It uses Spartan Helm Button and Native Select directly, and its colour utilities are mostly semantic Relay tokens. The main remaining work is not to add more framework for its own sake. It is to remove duplicated product styling, make the two-state status selector expose real selection semantics, move the language picker to the existing Relay select wrapper, converge event summaries on Relay card presentation, and model loading, empty and failed requests explicitly.

No overlay, dialog, popover, menu, drag interaction, mutation or analytics hook exists in this component today.

## Discovery summary

The current implementation consists of:

- `frontend/src/app/components/events-feed/events-feed.component.ts`, containing the component, inline template, local signals and request orchestration;
- `frontend/src/app/services/events.service.ts`, which maps filters to the authenticated NestJS `GET /events` endpoint;
- `backend/src/events/events.controller.ts`, which protects `GET /events` with `SupabaseAuthGuard` and passes the authenticated user ID plus validated query DTO to the events service;
- `backend/src/events/dto/events-query.dto.ts`, which validates `status`, `language_pair`, pagination and optional date/category/proficiency filters;
- `backend/src/events/events.service.ts`, which applies upcoming/past filtering, language filtering, ascending date order and bounded range pagination;
- the lazy `/events` route in `frontend/src/app/app.routes.ts`;
- no colocated `events-feed.component.spec.ts` test file on current `main`.

The `/events` route loads `EventsFeedComponent` directly. The component does not call Angular Router and does not render a detail action or clickable event card. The adjacent `/events/calendar` route is a separate surface and is outside this ticket.

## Current product contract

### Initial request

The feed defaults to:

- `status = 'upcoming'`;
- no `language_pair` filter;
- `page = 1`;
- `limit = 20`.

`ngOnInit()` calls `loadEvents(true)`. A reset request clears the existing rows, resets the page to 1, sets `hasMore` to true and then calls `EventsService.listEvents()`.

The current Angular repository rules prohibit lifecycle-hook data loading for ordinary application requests, so a follow-up should move this request orchestration to the repository's approved signal/resource pattern without changing the observable product contract.

### Status filter

Two buttons select exactly one server-side filter:

- Upcoming -> `status=upcoming`;
- Past -> `status=past`.

Changing status immediately resets the feed and requests page 1.

The backend treats any status other than explicit `past` as upcoming, but the frontend type deliberately restricts this surface to the two values above. Preserve that bounded UI contract.

### Language-pair filter

The native select sends one of the currently listed language-pair codes, for example `en-ja`, or clears the query parameter when the empty option is selected.

Changing the language pair immediately resets the feed and requests page 1.

The current option labels are hard-coded English strings. That conflicts with the repository's zero hard-coded UI-string rule and does not scale to arbitrary supported languages. The migration should source labels from the existing language/i18n model rather than creating another fixed language catalogue inside this component.

### Pagination

`Load more` is rendered while `hasMore` is true. Activation:

1. returns early if a request is already loading or `hasMore` is false;
2. increments `page`;
3. requests that page;
4. appends returned events;
5. sets `hasMore=false` when fewer than 20 rows are returned.

This is a page-number API, not cursor pagination. Follow-up work must preserve the server contract unless a separate API change is intentionally introduced.

### Event presentation

Each event currently renders:

- title;
- localised Angular `DatePipe` output using the `medium` preset;
- optional location;
- optional host display name.

The current feed does not render description, category, participant count, RSVP state or a detail/navigation action even though the `Event` model contains additional fields. A Spartan/Relay migration must not add those product behaviours incidentally.

## Existing control and state inventory

| Element / state           | Current implementation                                         | Current owner                          | Target owner                                        | Required action                                              |
| ------------------------- | -------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| Page heading              | Native `h1`                                                    | Feature presentation                   | Feature / Relay typography                          | Preserve semantics                                           |
| Upcoming filter           | `<button hlmBtn>` with manual selected classes                 | Feature signal plus Helm Button        | Spartan selection behaviour plus Relay presentation | Migrate selected semantics without changing query            |
| Past filter               | `<button hlmBtn>` with manual selected classes                 | Feature signal plus Helm Button        | Spartan selection behaviour plus Relay presentation | Migrate selected semantics without changing query            |
| Language filter           | Direct `<hlm-native-select>` with duplicated call-site classes | Feature signal plus Helm Native Select | Existing `AppSelectComponent`                       | Converge on Relay wrapper                                    |
| All-languages option      | Translated option                                              | Feature                                | Relay/native select content                         | Preserve                                                     |
| Ten language-pair options | Hard-coded English option labels                               | Feature                                | I18n/language data                                  | Replace hard-coded labels in implementation stage            |
| Initial loading           | Plain paragraph                                                | Feature request state                  | Relay loading presentation                          | Add explicit accessible status                               |
| Loaded event list         | Hand-styled repeated `div` cards                               | Feature presentation                   | `AppCardComponent`                                  | Converge presentation only                                   |
| Event title               | Native heading                                                 | Event data                             | Native semantic content                             | Preserve                                                     |
| Event date/time           | Angular `DatePipe`                                             | Feature presentation                   | Locale-aware presentation                           | Verify locale follows app language                           |
| Optional location         | Native paragraph                                               | Event data                             | Native semantic content                             | Preserve user/content data                                   |
| Optional host name        | Native paragraph with translated wrapper copy                  | Event data                             | Native semantic content                             | Preserve                                                     |
| Empty first page          | No visible state                                               | Feature request state                  | Relay empty-state presentation                      | Add explicit empty state                                     |
| Request failure           | Exception swallowed                                            | Feature request state                  | Relay error presentation plus retry action          | Add explicit failure state                                   |
| Load-more action          | `<button hlmBtn>` with custom classes                          | Feature request state plus Helm Button | Relay/Helm Button                                   | Preserve action, use approved touch sizing and pending state |
| Load-more pending         | Button disabled, visible text switches to loading              | Feature request state                  | Feature state plus Relay/Helm Button                | Preserve, add useful busy semantics                          |
| End of pagination         | `hasMore=false`, no footer message                             | Feature state                          | Feature / presentation                              | Preserve unless product deliberately adds completion copy    |

## Spartan ownership decision

### Status selection

The Upcoming/Past controls form one mutually exclusive choice. They are not two unrelated commands. The current implementation stores the selected value correctly but exposes only button semantics and manual active colour classes.

Spartan's documented component catalogue includes a Toggle Group for small groups of mutually exclusive options and Radio Group for choice input semantics. Follow-up #6184 should verify the installed project version through the Spartan CLI/MCP before choosing the exact primitive. The required product contract is:

- exactly one of Upcoming/Past is selected;
- the selected state is programmatically exposed;
- keyboard behaviour comes from the chosen primitive rather than feature-owned key handlers;
- changing selection performs one reset request;
- re-selecting the already active value must not accidentally duplicate network work unless that is deliberately retained as refresh behaviour;
- visible focus works in both themes and forced-colour mode;
- the selected state is not communicated by colour alone.

Do not add custom roving-tabindex or arrow-key code in `EventsFeedComponent` when Spartan owns the interaction.

### Language selector

The repository already has `AppSelectComponent`, a Relay wrapper around `HlmNativeSelect`. It owns:

- consistent Relay token styling;
- label/accessible-label support;
- touch-friendly native select behaviour;
- project-level API boundaries around the Helm implementation.

`EventsFeedComponent` should use `app-select` rather than repeat the same Native Select class string at the feature call site.

The migration should provide a translated visible label where the layout permits, or a translated `ariaLabel` if the visual design intentionally uses a compact filter bar. Do not leave an unnamed select.

### Buttons

The feed already uses Spartan Helm `hlmBtn` for command actions. There is no reason to replace button semantics with clickable `div` elements or custom keyboard handlers.

For reusable product CTA styling, prefer existing Relay button wrappers such as `AppButtonPrimaryComponent` when the desired visual role matches. Direct `hlmBtn` remains acceptable for feature-specific compact controls when no Relay wrapper expresses the required variant, but the call site should use documented Helm variants/sizes before layering a parallel button system in Tailwind classes.

### Cards

Event summaries are presentation-only. They do not need Spartan Brain. `AppCardComponent` already owns Relay radius, surface, border, padding and elevation roles and is the preferred replacement for the current hand-styled event container.

Keep the card non-interactive unless a real destination or action contract is added separately. Do not use `variant="interactive"` just to provide hover styling.

### Empty, loading and error states

These are Relay presentation concerns. `AppEmptyStateComponent` already exists for an empty result surface and can optionally expose a Spartan-backed action. Loading/error presentation should use existing Relay feedback capabilities where available. No Brain primitive is required solely to show asynchronous status.

## Data and side-effect map

| Trigger              | Request                                               | Mutation | Navigation | Analytics | Contract                      |
| -------------------- | ----------------------------------------------------- | -------- | ---------- | --------- | ----------------------------- |
| Component bootstrap  | `GET /events?status=upcoming&page=1&limit=20`         | None     | None       | None      | Load first upcoming page      |
| Select Upcoming      | `GET /events?status=upcoming&page=1&limit=20`         | None     | None       | None      | Reset list to upcoming events |
| Select Past          | `GET /events?status=past&page=1&limit=20`             | None     | None       | None      | Reset list to past events     |
| Select language pair | `GET /events` plus `language_pair` and current status | None     | None       | None      | Reset list to filtered page 1 |
| Clear language pair  | `GET /events` without `language_pair`                 | None     | None       | None      | Reset list to all languages   |
| Load more            | `GET /events` with incremented page                   | None     | None       | None      | Append the next page          |

The NestJS `GET /events` controller uses `SupabaseAuthGuard`, so unauthenticated API requests are rejected. The route itself currently has no route-level guard in the reviewed route declaration. The migration must not weaken API authentication or move data access around NestJS.

The backend query is bounded by page and limit and orders by `date_time` ascending. `status=past` applies a less-than-now filter; upcoming is the default and applies greater-than-or-equal-to-now. The feed must not replace this API filtering with client-only filtering.

## Async and concurrency audit

### Initial loading

When a reset request begins, the component clears events before awaiting the server. The template therefore displays its loading paragraph until the request completes.

There is no distinct initial error or empty state after completion.

### Silent failure

`loadEvents()` catches every request error and leaves no user-visible error, retry control or error-state signal. On an initial/reset request this produces an indistinguishable blank feed. This is a required migration gap.

Model at least:

- initial loading;
- loaded with events;
- loaded empty;
- failed with retry;
- load-more pending while existing rows remain visible;
- load-more failure while existing rows remain visible.

Do not discard already loaded rows just because a later page failed.

### Page skip after failed load-more

The current code increments `page` before issuing the request. If page 2 fails, `page` remains 2. A later `Load more` increments it to page 3, which can permanently skip the failed page.

The implementation should commit the page number only after a successful append, or retain an explicit requested-page value so Retry requests the failed page again. This is product correctness, not merely presentation.

### Overlapping filter requests

`isLoading` prevents concurrent `Load more` activations, but it does not prevent status or language changes while a request is in flight. Multiple reset requests can overlap. A slower old response can then overwrite results from the newest filter selection.

The current component therefore needs stale-response protection or cancellable resource semantics during #6184. The latest filter selection must remain authoritative.

### Duplicate same-filter requests

Clicking the already selected Upcoming or Past button currently calls `loadEvents(true)` again. If the migrated selection primitive suppresses unchanged values, that behaviour changes from implicit refresh to no-op.

There is no visible refresh affordance or documented refresh contract, so the safer target is to avoid accidental duplicate work, but the implementation PR should call this out explicitly rather than changing it unnoticed.

## Accessibility audit

### Filter group semantics

The current Upcoming/Past controls use colour changes to indicate the selected filter. They do not expose `aria-pressed`, radio/toggle selection semantics or a labelled group relationship.

The selected state must be programmatically available and understandable without colour. Prefer the approved Spartan selection primitive over hand-authored ARIA.

### Language selector naming

The current Native Select has no visible `<label>` and no translated accessible label. Its first option text is not a substitute for a control name.

The migrated Relay select must have a stable translated name such as the repository's existing events/language-filter key or a new translation key added through the normal i18n contract.

### Touch targets

The current filter buttons use `py-1` and the Load more button uses `py-2`. Do not assume these custom classes satisfy the mobile touch target requirement merely because `hlmBtn` is present. #6184/#6190 must verify the actual rendered target and use documented touch sizing where needed.

### Loading and busy state

Load more disables while loading and changes its visible copy, which is useful. Add `aria-busy` or an equivalent shared primitive contract only where it improves state announcement and does not duplicate native disabled semantics.

Initial loading should use a concise status announcement rather than a broad live region around the whole feed.

### Failure and retry

A failed request is currently silent. The migrated error state must:

- expose error semantics to assistive technology;
- use translated, non-technical copy;
- preserve already loaded cards after a load-more failure;
- provide a keyboard/touch-operable retry action for the exact failed request;
- avoid leaking backend exception text.

### Heading hierarchy

The page has one `h1` and each event title is an `h2`. Preserve that hierarchy when wrapping rows in `AppCardComponent`.

### Focus stability

Resetting filters currently clears and replaces the entire list. Keep focus on the filter control that initiated the change. Do not automatically move focus into the first result unless a separate product accessibility decision justifies it.

When Retry succeeds, focus should not be unexpectedly lost because the error surface disappears.

## Internationalisation and locale audit

### Hard-coded language labels

The ten language-pair options are hard-coded English:

- English / Spanish;
- English / Japanese;
- English / Korean;
- English / Chinese;
- English / French;
- English / German;
- English / Arabic;
- English / Portuguese;
- English / Russian;
- English / Italian.

These labels must move to translation-backed/canonical language data. Do not create ten new English-only component constants as part of the migration.

The `en-xx` values are API identifiers and should remain stable unless a separate backend/product change expands the filter model.

### Event content

Event title, host name and location are user/content data and must not be passed through UI translation as if they were interface copy.

### Date/time locale

The template uses Angular `DatePipe` with `medium`. Verify that the pipe's locale follows the application's reactive `I18nService.currentLang()` at runtime. If Angular's injected locale is static, format through the application's locale-aware date utility or a computed formatter that uses the active language. The migration should not leave dates in the wrong locale after a live language switch.

### RTL

The current filter layout relies on flex flow and symmetric padding/gaps, so it does not contain obvious physical left/right spacing utilities. Preserve logical directional properties in all follow-up work.

Language-pair display should remain understandable in RTL locales. The pair identifier itself is data, while the visible language names and separator should be generated by the presentation layer rather than by concatenating LTR-only English copy.

At high zoom and in RTL, long translated filter labels must wrap or the filter bar must stack without hiding the select or Load more action.

## Theme and token audit

The component mostly avoids literal colours, but presentation ownership is inconsistent.

### Correct semantic roles already in use

- `bg-primary` for selected status;
- `text-on-fill` on primary fill;
- `text-text-primary` and `text-text-secondary`;
- `bg-surface-*` and `border-surface-*`.

These roles preserve the per-user primary accent and light/dark theme system and should remain semantic.

### Off-contract or duplicated styling

The current event rows use `bg-surface-300 rounded-lg shadow`, duplicating the shared card contract. Migrate to `AppCardComponent` rather than choosing another one-off radius/shadow combination.

The Native Select duplicates a full visual class string in both `class` and `selectClass`. `AppSelectComponent` exists specifically to own this Relay styling.

The status filters use `rounded-full` plus manual selected/unselected styling. If they remain pill-shaped after #6184/#6189, the product-facing radius and variants should come from the selected Relay/Helm control rather than a bespoke feature recipe.

The Load more button manually re-specifies surface, border, text, radius and disabled opacity. Prefer a documented Helm variant or Relay button wrapper that owns those states.

### Responsive contract

The component has no explicit page container or width composition of its own. It relies on the host route/shell for available width. The filter bar wraps, which is a useful baseline, but the migration must deliberately verify:

- 390px mobile;
- tablet widths;
- wider desktop content measure;
- long translated status and language labels;
- 200% and 400% zoom;
- touch target sizing;
- cards with long titles, host names and locations.

Do not add a second full-screen background shell if the route host already owns the page canvas. Use the shared layout contract confirmed by neighbouring route surfaces.

### Motion and forced colours

The current status buttons rely on `transition-colors`. Any retained non-essential transition must respect reduced-motion policy through shared primitives or tokenised motion.

Selected state and focus must remain visible in forced-colour mode without relying solely on Relay background colour.

## Routing and navigation

`/events` lazy-loads this feed.

The component itself has no Router dependency, no `routerLink`, no browser navigation and no deep-link output. Preserve that fact during the interaction migration.

Do not make an entire event card clickable unless a valid route/product contract is first established and tested. The reviewed route table contains `/events` and `/events/calendar`; this audit does not define a new event-detail route.

If a later product ticket adds event detail navigation, use a semantic native link/RouterLink rather than making a presentation card imitate a link with synthetic keyboard behaviour.

## Analytics and observability

There is no product analytics hook in `EventsFeedComponent` today.

The frontend silently suppresses request failures. The backend logs failed list queries through `EventsService`, but users receive no feedback. Follow-up work should add UI error handling without logging event titles, locations, host names or other unnecessary content client-side.

A visual migration must not add analytics as an incidental side effect. If filter analytics are wanted, add them under a separate explicit product/telemetry contract.

## Security and privacy

`GET /events` is authenticated by `SupabaseAuthGuard`. Preserve API-first access and do not query Supabase from Angular.

The event feed renders server-returned strings through normal Angular interpolation, which should remain the rendering path. Do not introduce unsafe HTML rendering for event descriptions or titles during card migration.

Error UI must use stable translated copy rather than raw server exception messages.

The feed has no mutation or destructive action, so there is no confirmation-dialog requirement in this component.

## Migration risks

### 1. Filter migration changes request frequency

Selection primitives may emit differently from independent buttons. Ensure one logical selection change triggers one reset request and unchanged selections do not produce accidental duplicate requests.

### 2. Stale responses overwrite current filters

Moving markup without fixing request ownership can retain the existing race where an older request wins after a newer filter selection. Treat stale-result protection as part of interaction correctness.

### 3. Pagination skips failed pages

Do not preserve the current pre-increment bug when implementing retry/error states.

### 4. Native-select event contract changes

The current call site listens to DOM `(change)` and reaches through `$event.target`. `AppSelectComponent` exposes a typed `valueChange` output. Update the feature handler to that product-level API and keep the same `language_pair` query values.

### 5. Hard-coded option copy survives the visual migration

Moving the existing `<option>` elements into `app-select` is not enough. The visible language names must become i18n-safe/canonical data.

### 6. Card convergence accidentally adds interaction

`AppCardComponent` supports an `interactive` variant, but events in the current feed have no navigation/action contract. Use a non-interactive card variant until product routing exists.

### 7. Date locale stays stale after language switch

Do not assume the existing `DatePipe` automatically observes the application's runtime locale signal. Add a regression test for language switching.

### 8. Empty and failure states become indistinguishable

A successful zero-result query and a failed query need separate states and copy. Do not reuse one generic empty message for both.

### 9. Existing rows disappear on pagination failure

Load-more errors must not clear already loaded data. Keep first-page reset semantics separate from append semantics.

### 10. Direct Helm ownership persists after Relay wrapper exists

The existing `AppSelectComponent` is already the stable product-facing select API. Keeping a feature-specific direct `HlmNativeSelect` after migration would preserve duplicate styling and weaken the architecture boundary.

## Primitive prerequisites

### Already available

The repository already provides:

- Spartan Helm Button;
- Spartan Helm Native Select;
- `AppSelectComponent`;
- `AppCardComponent`;
- `AppEmptyStateComponent`;
- Relay semantic colour, radius and elevation tokens.

No new card or select primitive is required for this surface.

### Verify before #6184

Before choosing the exact status-selection primitive, run the repository's Spartan CLI info command and confirm the currently installed Toggle Group / Radio Group capability and API. If the appropriate primitive is not installed, add it through the Spartan CLI rather than recreating it from memory.

If the repository already has a Relay wrapper for the selected interaction by the time #6184 starts, use that wrapper instead of importing Helm/Brain directly.

## Recommended implementation sequence

### #6184: controls and interaction ownership

1. Replace the independent status-button state presentation with the verified Spartan single-selection primitive.
2. Move language selection to `AppSelectComponent`.
3. Replace lifecycle-hook data loading with approved signal/resource orchestration.
4. Add stale-response/cancellation protection for reset requests.
5. Fix load-more page commit/retry semantics.
6. Model first-page and append errors distinctly.
7. Add a focused component spec because none exists on current `main`.

### #6189: Relay tokens and responsive/theme parity

1. Replace bespoke event containers with `AppCardComponent`.
2. Remove duplicate select/button styling that shared primitives own.
3. Apply approved responsive spacing/content measure for 390px, tablet and desktop.
4. Verify semantic selected, disabled, loading, error and card states in light/dark themes and with a changed user accent.

### #6190: accessibility, RTL, zoom and input methods

1. Verify selection-group semantics and keyboard behaviour.
2. Add a translated label/name for the language selector.
3. Verify touch target sizing and visible focus.
4. Verify error and loading announcements without noisy broad live regions.
5. Test RTL, long translations, 200%/400% zoom, forced colours and reduced motion.

### #6191: regression tests and design preview

1. Lock all state transitions and request contracts with component tests.
2. Cover responsive light/dark feed states in `frontend/design-preview` / Claude Design.
3. Record the final architecture/status in the relevant design audit.
4. Run the complete frontend verification gate.

## Required regression matrix

The completed conversion should cover at least:

1. default request uses `status=upcoming`, page 1 and limit 20;
2. Past selection resets and requests `status=past`;
3. Upcoming selection resets from Past;
4. language selection sends the expected stable pair code;
5. clearing language selection omits `language_pair`;
6. latest filter wins when requests resolve out of order;
7. same selected filter does not trigger an accidental duplicate request;
8. first-page loading is visible and accessible;
9. successful first-page result renders events in returned order;
10. empty first page renders a translated empty state;
11. first-page failure renders translated retry feedback;
12. retry repeats the failed filter/page rather than skipping work;
13. Load more requests the next page only once while pending;
14. successful Load more appends without dropping current rows;
15. failed Load more preserves current rows;
16. retry after a failed Load more requests the same failed page;
17. fewer than 20 rows removes the Load more action;
18. exactly 20 rows keeps Load more available until the next response establishes completion;
19. event title remains a semantic heading;
20. optional location omission does not leave meaningless blank markup;
21. optional host omission does not leave meaningless blank markup;
22. date/time formatting follows the active UI locale after language change;
23. language control has a translated accessible name;
24. status selection is exposed semantically, not only by colour;
25. status group keyboard interaction follows the chosen Spartan primitive;
26. all actionable controls expose visible keyboard focus;
27. touch targets meet the project mobile baseline;
28. RTL layout retains logical order and does not hide filters;
29. 200% and 400% zoom preserve filters, events and Load more;
30. light and dark themes preserve contrast and selected-state distinction;
31. changing the user primary accent does not break selected-state/on-fill contrast;
32. event/server strings render as text and are not interpreted as HTML;
33. no event card gains synthetic click/keyboard behaviour without a real navigation contract.

## Verification contract

This audit changes documentation only and therefore does not alter runtime or the mapped visual contract. It does not require a design-preview change by itself.

The implementation tickets must run the repository frontend verification gate from `docs/spartan-relay-architecture.md`:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

Run focused component tests while iterating. Any generated/added Spartan capability should also be checked with the repository's Spartan healthcheck as required by the frontend guidelines.

## Completion criteria for this audit

This audit is complete when follow-up work can answer all of the following without rediscovering the existing surface:

- every current interactive control has an explicit owner;
- every server request and pagination transition is documented;
- route, authentication and analytics contracts are recorded;
- loading, empty, failure and append states are distinguished;
- stale-response and failed-page risks are explicit;
- accessibility, locale, RTL, theme, zoom and touch risks are identified;
- existing Relay primitives to reuse are named;
- new primitive work is limited to verifying the appropriate Spartan selection capability rather than inventing one;
- #6184, #6189, #6190 and #6191 have a concrete implementation and regression baseline.

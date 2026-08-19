# Events calendar Spartan / Relay audit

Issue: #6178 (`Spartan UI 0396`)

Target: `frontend/src/app/components/events-calendar`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for the `components/events-calendar` Spartan UI + Relay migration sequence.

The audit covers every current control, state, service call, route contract, accessibility concern, RTL/i18n requirement, theme/responsive requirement and migration risk in `EventsCalendarComponent`. It follows the ownership rules in `docs/spartan-relay-architecture.md`: feature code owns event/calendar product behaviour, Relay owns reusable product presentation, Spartan owns generic accessible interaction mechanics when an appropriate primitive exists, and native HTML remains preferred when it already provides the correct semantics.

This audit does not change event APIs, route contracts, calendar behaviour, analytics, visual output or data persistence.

## Current surface

`EventsCalendarComponent` is a standalone Angular component with an inline template and no component stylesheet. It imports:

- Spartan Helm `HlmButton`;
- Angular `RouterLink`;
- `TranslatePipe` and `I18nService`;
- `EventsService`;
- Relay `AppEmptyStateComponent`;
- Relay `AppCardComponent`.

The component renders:

1. a page heading;
2. previous-month and next-month buttons;
3. a localised month/year label;
4. seven localised narrow weekday labels;
5. a seven-column month grid containing leading/trailing empty cells and selectable date cells;
6. up to two event-title markers inside each date cell plus a translated overflow count;
7. a selected-date heading;
8. an existing Relay empty state when the selected date has no events;
9. existing Relay cards for selected-date events;
10. optional category, description, time and location metadata per event;
11. native Angular Router links to event detail pages.

There are no dialogs, popovers, menus, comboboxes, text inputs, mutation controls or analytics calls in this component.

## Route, data and side-effect contracts

### Route ownership

Repository routing exposes the calendar as an events route and event cards navigate through the existing detail contract:

- calendar surface: `/events/calendar`;
- event details: `/events/:id` via `[routerLink]="['/events', ev.id]"`.

The migration must preserve those route contracts. Month/date selection is local UI state and must not accidentally become navigation unless a separate product ticket explicitly changes that behaviour.

### Data ownership

`EventsCalendarComponent` uses one read-only API boundary:

```text
EventsService.getMyEvents('upcoming')
  -> GET /events/my?status=upcoming
```

The result is loaded through Angular `resource()` and normalised to an empty array when no value is available. `eventsByDate` then filters those events client-side to the currently displayed year/month.

The component performs no create/update/delete operation, RSVP mutation, storage write or analytics event.

### Important data-contract risk

Month navigation permits movement into previous months, but the resource always requests `status=upcoming`. A user can therefore navigate to a past month even though past events may be absent by construction. This is existing product/data behaviour, not a Spartan concern. Follow-up work must preserve it unless product ownership explicitly decides to request a date range or switch to past events for historical months.

Do not hide this mismatch by treating an empty historical month as proof that no events existed.

## Complete control and state inventory

| Element / behaviour | Current implementation | Current owner | Target owner | Audit action |
| --- | --- | --- | --- | --- |
| Page shell | `min-h-screen`, Relay surface/text utilities | Feature composition | Relay/app screen composition | Preserve; align spacing/radius tokens in visual stage |
| Page heading | native translated `h1` | Feature content | Native semantics + Relay typography | Keep |
| Previous month | native `button` + `hlmBtn` | Feature state + Spartan Button | Relay button wrapper where appropriate, otherwise Helm Button | Preserve behaviour; use explicit button semantics and accessible directional treatment |
| Month/year label | locale-formatted `span` | Feature derived state | Native text + Relay typography | Keep; consider announcement relationship to calendar |
| Next month | native `button` + `hlmBtn` | Feature state + Spartan Button | Relay button wrapper where appropriate, otherwise Helm Button | Preserve behaviour; use explicit button semantics and accessible directional treatment |
| Weekday headers | seven native `div` elements | Feature presentation | Native calendar/grid semantics + Relay typography | Keep content but strengthen structural association |
| Empty calendar cells | `div role="button"`, no tabindex, `aria-disabled=true` | Feature hand-rolled cell semantics | Non-interactive native cell | Remove button role from empty cells |
| Selectable date cell | clickable/focusable `div role="button"` with Enter/Space handlers | Feature hand-rolled interaction | Native `button` or an approved calendar/date primitive if introduced | Replace hand-rolled button semantics; do not implement custom keyboard behaviour |
| Selected date state | `selectedDay` signal, clicking selected day toggles it off | Feature product state | Feature | Preserve toggle semantics unless product changes |
| Today state | computed date + primary ring/text classes | Feature state + Relay tokens | Feature state + Relay presentation | Preserve; do not convey only by colour |
| Event markers in date cell | presentation-only `div`, first two events | Feature presentation | Relay/calendar composition | Keep presentation; improve accessible summary if needed |
| `+N` marker | translated text | Feature presentation | Relay typography | Keep |
| Selected-date heading | native `h2` | Feature content | Native semantics + Relay typography | Keep; consider focus/announcement after selection |
| Selected-date empty state | `app-empty-state` | Relay | Relay | Keep |
| Selected event card | `app-card` | Relay | Relay | Keep |
| Category badge | bespoke `span` with primary alpha | Feature presentation | `AppPillComponent`/Relay badge presentation where API fits | Converge instead of creating a calendar-specific badge |
| Event metadata | native spans | Feature content | Native semantics + Relay typography | Keep |
| View details | native Angular Router anchor | Native navigation | Native anchor + Relay link presentation | Keep native link semantics |
| Loading state | no rendered loading state | Feature/resource | Relay loading presentation | Add explicit state in implementation stage |
| Initial load error | no rendered error state | Feature/resource | Relay error/status presentation | Add explicit retry/error state in implementation stage |
| Analytics | none | N/A | N/A | Do not add incidentally |
| Overlay behaviour | none | N/A | N/A | Do not introduce overlay primitives |

Every currently rendered interactive element is classified above.

## Spartan ownership

### Month navigation buttons

The two month-navigation controls already use native `<button>` elements enhanced by `hlmBtn`. Their generic press/focus behaviour therefore belongs to Spartan Button rather than feature code.

Follow-up conversion should:

- keep them as real buttons;
- add `type="button"` so future form embedding cannot create accidental submits;
- prefer an existing Relay button wrapper if it cleanly expresses the compact secondary navigation treatment;
- retain `previousMonth()` / `nextMonth()` as feature-owned state transitions;
- keep visible focus and mobile touch targets;
- avoid custom `keydown`, click emulation or pointer-only handlers.

There is no reason to introduce a new Brain primitive for these actions.

### Date cells are the main interaction migration

The current calendar cells emulate buttons with:

```text
<div role="button" tabindex="0" (click) ... (keydown.enter) ... (keydown.space) ...>
```

That is exactly the kind of generic interaction ownership the migration should remove. It creates manual keyboard behaviour, leaves Space scrolling behaviour easy to get wrong, applies a button role to empty cells, and requires feature code to maintain focus/disabled semantics.

Repository search does not currently expose an installed `hlmCalendar` implementation. Do not invent a half-calendar Brain abstraction solely for this ticket. The smallest correct migration is therefore native date-cell buttons inside a semantically structured month grid. Native buttons provide activation and keyboard semantics without custom handlers.

If a shared Spartan-backed Calendar primitive is introduced elsewhere before implementation starts, reassess it against the existing product contract before adopting it. It must support:

- one optionally selected day;
- deselecting the selected day;
- event markers inside cells;
- locale-aware labels;
- today state;
- the existing selected-date event section.

Do not replace working product behaviour just to match a generic date-picker API.

### Selection semantics

A selected date is a persistent local state, not just a momentary command. The implementation should expose that state to assistive technology, for example with a native button plus `aria-pressed`, `aria-selected` in a correct grid pattern, or the selected-state semantics supplied by an approved Calendar primitive.

Today is a separate concept from selection. The implementation must not conflate:

- **today**: the current civil date;
- **selected**: the date whose event details are expanded.

Both states need non-colour semantics.

## Relay ownership

### Existing Relay primitives to retain

The component already demonstrates the preferred boundary for two reusable presentation patterns:

- `AppEmptyStateComponent` owns the selected-date empty presentation;
- `AppCardComponent` owns selected event surfaces.

Do not replace either with a new Spartan Brain component. Cards and empty states are presentation, not generic interaction state machines.

### Category presentation

Event categories are currently bespoke rounded spans. If `AppPillComponent` supports the required static label treatment, use it in the visual migration stage. Static category badges must remain non-interactive and must not acquire button/chip selection semantics merely because they look pill-shaped.

### Loading and error states

`eventsResource` has asynchronous lifecycle state, but the current template renders neither an explicit loading state nor an initial-load failure state. During an unresolved/error load the calendar can appear as a valid empty calendar, which is ambiguous.

The implementation sequence should use the existing Relay loading/error vocabulary rather than a calendar-specific spinner/error box:

- loading: approved skeleton/loading primitive or a screen-reader-labelled status;
- error: approved error/status composition with a retry action where `resource.reload()` or equivalent is appropriate;
- genuine no-events result: normal calendar grid with no event markers;
- selected date with zero events: existing `AppEmptyStateComponent`.

These are four distinct states and tests should keep them distinct.

## Current state model

The component owns these reactive values:

- `monthOffset`: integer month displacement from the current month;
- `selectedDay`: selected numeric day or `null`;
- `todayDate`: computed `new Date()` value;
- `monthStart`: first day of the displayed month;
- `monthLabel`: locale-formatted displayed month/year;
- `dayNames`: seven locale-formatted narrow weekday names;
- `days`: leading blanks + month days + trailing blanks, padded to full weeks;
- `eventsResource`: asynchronous `getMyEvents('upcoming')` read;
- `events`: resource value or empty array;
- `eventsByDate`: map of displayed day number to matching events;
- `selectedDate`: full Date reconstructed from displayed month + selected day;
- `selectedDateLabel`: locale-formatted selected date;
- `selectedDateEvents`: matching events for the selected day.

Changing month clears `selectedDay`. Selecting the same day twice deselects it.

There is no mutation-pending state because the component is read-only.

## Accessibility audit

### Existing strengths

- month navigation uses real buttons;
- event details use real links;
- visible strings use translation keys or locale formatting;
- event cards use heading hierarchy (`h3`) under the selected-date `h2`;
- the selected-date no-events state uses the shared empty-state primitive;
- primary text on saturated event markers uses the semantic `text-on-fill` token rather than hard-coded white.

### Date-cell semantics

The current hand-rolled `role="button"` cells should be replaced as described above.

Specific problems to address:

1. empty cells still carry `role="button"` and `aria-disabled="true"` even though they are not controls;
2. selected state is not exposed programmatically;
3. the accessible label interpolates only the numeric day, so repeated values such as "15" do not identify month/year context;
4. manual Space activation can interfere with normal page scrolling unless carefully prevented;
5. there is no semantic relationship between weekday labels and date cells;
6. the calendar has no programmatic group/grid label describing the displayed month.

The implementation should give each selectable date an accessible name containing a full locale-aware date and expose the calendar/month relationship through appropriate native/grid semantics.

### Weekday labels

`weekday: 'narrow'` can produce ambiguous single-letter names, for example two different weekdays beginning with the same letter. Narrow labels may remain visually useful, but assistive technology should have an unambiguous full weekday name where the chosen structure requires headers.

### Month changes

Changing month updates visible content but does not explicitly announce the new month. Do not add an aggressively chatty global live region. Instead provide a properly labelled calendar region/grid whose month label updates, and test common screen-reader flow. If an announcement is required, scope it to the month heading and avoid duplicate announcements.

### Selected-date details

Selecting a date reveals an `h2` and event list below the grid. Keyboard focus currently stays on the date cell, which is generally preferable to forcibly moving focus after every selection. The new content must nevertheless be discoverable in reading order and selected-state semantics must tell users why details changed.

### Event marker tooltips

The first two event markers rely on native `title` for hover detail while also rendering the event title visibly. Do not treat `title` as the only accessible source of information. Touch users do not have hover, and assistive technology support for title is inconsistent. The day button/grid cell accessible description should communicate event presence/count without dumping every event title into an excessively long control name.

### Touch and zoom

At the 390px baseline, seven columns leave limited horizontal space. Follow-up work must verify:

- each selectable day retains an adequate touch target;
- text does not become unreadably small;
- the current `text-[10px]` event markers remain legible or are replaced with a more scalable presentation;
- no action or date is lost at 200%/400% zoom;
- horizontal scrolling, if introduced as the least-bad high-zoom strategy for a true calendar grid, is explicit and keyboard accessible rather than clipped.

## Internationalisation and calendar conventions

All user-facing static copy already goes through translation. Month names, weekday names, selected dates and times use `I18nService.currentLang()` with `Intl`/`Date` locale formatting.

Follow-up work must preserve that ownership and additionally review:

- first day of week: the grid is hard-coded Sunday-first using `Date.getDay()` and a Sunday base date, which is not the convention for many locales;
- narrow weekday ambiguity;
- full-date accessible names;
- event time-zone expectations, since `new Date(date_time)` and `toLocaleTimeString()` format in the browser's local timezone;
- translated strings under text expansion and non-Latin scripts.

Locale-specific first-day-of-week is a product/i18n behaviour change, so implementation should not silently reorder the calendar without an explicit decision and matching tests.

## RTL audit

The template contains no physical Tailwind spacing utilities such as `ml-*`, `mr-*`, `left-*` or `right-*`, which is a good baseline.

Two directional concerns remain:

1. Previous/next buttons use the literal glyphs `‹` and `›`. Those visual arrows encode physical direction and need deliberate RTL behaviour rather than assuming translated word order is enough.
2. Calendar chronological order and week-start convention are product/calendar semantics, not ordinary flex direction. Do not simply reverse the seven-column grid under `dir="rtl"` without defining and testing the expected locale behaviour.

Use logical layout utilities for ordinary spacing. Handle arrow icon direction and calendar chronology as explicit semantics.

## Theme and token audit

The surface already uses Relay colour roles for most styling:

- `surface-500`, `surface-400`, `surface-300`, `surface-200`;
- `text-primary`, `text-secondary`, `text-muted`;
- dynamic `primary`;
- `on-fill` for saturated event chips.

That means per-user primary accents naturally flow through current primary-based states.

Visual-stage risks to review:

- generic `rounded-lg` and `rounded-sm` should converge on the documented Relay radius hierarchy when a canonical role exists;
- arbitrary primary alpha combinations (`primary/15`, `/20`, `/50`, `/60`, `/80`) should be checked against approved semantic state roles and contrast in both themes;
- today currently depends heavily on a primary ring/text treatment and needs a non-colour semantic state;
- hover styles need matching focus/active treatment;
- light and dark screenshots must verify event-chip contrast for extreme user-selected primary accents.

Do not add hard-coded product hex values.

## Responsive layout audit

The calendar is inherently dense and uses seven fixed columns.

### Mobile baseline

At 390px:

- retain a readable month heading and both month-navigation controls without overlap;
- ensure navigation labels can expand under translation;
- do not rely on 10px text as the only event affordance;
- verify date cells remain targetable even when event titles are long;
- prefer a compact event count/indicator if full titles cannot remain legible.

### Tablet and desktop

The existing `max-w-2xl` cap prevents the month from stretching indefinitely. Preserve an intentional maximum width unless design review changes it.

Wider layouts may show richer event summaries, but this should be a Relay/responsive presentation decision rather than a second interaction implementation.

### High zoom/reflow

Seven-column calendars are a known reflow challenge. Test 200% and 400% zoom explicitly. If preserving the mathematical grid requires horizontal overflow, provide a contained labelled scroll region rather than clipping cells or shrinking content below readable sizes.

## Migration risks

### High: replacing the calendar with the wrong primitive

A generic date picker often assumes one required selected date and no embedded event summaries. This component supports optional toggle selection and event markers. Do not adopt a primitive whose behaviour changes these contracts merely to satisfy Spartan usage.

### High: historical-month data mismatch

The UI can navigate backward while the service requests only `upcoming` events. Visual migration must not accidentally certify past-month emptiness as accurate historical data.

### High: locale/week-order changes

Changing Sunday-first behaviour to locale-first is reasonable but user-visible. Treat it as explicit behaviour with tests, not incidental cleanup.

### Medium: accessibility regression during cell conversion

Changing role/button structure can disrupt the reading order or selected-date reveal. Add focused keyboard and semantics tests before removing the old handlers.

### Medium: RTL arrow/chronology confusion

Physical arrow glyphs and calendar chronological order need deliberate direction rules.

### Medium: loading/error ambiguity

The current resource fallback can make loading/error look like a valid empty result. Preserve distinct async states during migration.

### Medium: user accent contrast

Today/category/event-marker treatments all derive from the user's primary accent. Validate contrast for both light/dark themes and representative accent extremes.

### Low: routing drift

Event-detail links already use semantic RouterLink anchors. Do not convert them to buttons or imperative navigation.

## Primitive prerequisites

No new primitive is required to complete the first interaction conversion if native date buttons are used.

Before implementation, confirm availability/API fit of:

- existing Relay button wrappers for month navigation;
- `AppPillComponent` for static event categories;
- existing Relay skeleton/loading and error/status primitives;
- any newly introduced Spartan/Relay Calendar primitive, but only if it preserves this component's event-marker and optional-selection contracts.

The existing `AppCardComponent` and `AppEmptyStateComponent` are already correct owners and need no replacement.

## Recommended implementation sequence

1. Add focused regression tests that freeze current month navigation, optional date selection/deselection, event grouping and `/events/:id` navigation.
2. Replace hand-rolled date-cell button semantics with native buttons or a proven approved Calendar primitive.
3. Remove button semantics from empty cells and expose selected/today states accessibly.
4. Add a labelled month/calendar structure and full locale-aware date names.
5. Add explicit loading and error/retry states without conflating genuine empty data.
6. Converge category/loading/error presentation onto existing Relay primitives where APIs fit.
7. Apply canonical Relay radius/state tokens and verify dynamic accent contrast.
8. Verify 390px, tablet, desktop, 200%/400% zoom, keyboard, touch, screen reader and RTL behaviour.
9. Update the mapped Claude Design/design-preview states only when a visual/interaction contract actually changes in those follow-up tickets.

## Required regression coverage

Follow-up implementation should cover at minimum:

1. component creation;
2. displayed month label;
3. correct full-week cell generation;
4. next-month navigation;
5. previous-month navigation;
6. selected date clears on month change;
7. selecting a date reveals it;
8. selecting the same date again deselects it;
9. empty cells are not interactive/focusable;
10. date controls use native/approved interaction semantics with no synthetic role/tabindex handlers;
11. keyboard activation follows native/primitive behaviour;
12. selected state is programmatically exposed;
13. today state is separately exposed;
14. full locale-aware accessible date names;
15. unambiguous weekday header semantics;
16. events group only into the displayed month;
17. no-event selected date renders `app-empty-state`;
18. event cards render title/category/description/time/location as available;
19. event details navigate exactly to `/events/:id`;
20. loading is distinct from empty;
21. initial API error is visible/announced and retryable;
22. month change does not trigger an unintended mutation;
23. long translated previous/next labels fit at 390px;
24. RTL keeps logical layout and correct previous/next meaning;
25. 200% and 400% zoom preserve access to every date/action;
26. light and dark themes preserve contrast;
27. user primary-accent changes preserve readable today/event/category states;
28. no analytics or API mutation is introduced by the migration.

The existing spec already covers creation, month label generation, complete-week cell count, month navigation, date selection/deselection, null selection, `isToday(null)`, event-time formatting, selection reset on month change and localised weekday names. Extend it rather than replacing it with a parallel suite.

## Verification

This audit changes documentation only, so it does not change runtime behaviour or the mapped visual contract. No Claude Design/design-preview update is required for this PR.

Follow-up runtime changes must run the repository frontend gate documented in `docs/spartan-relay-architecture.md`:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

This audit PR should still pass repository CI, constitution/documentation checks and dependency review before merge.

## Completion checklist for #6178

- [x] Every current interactive element is inventoried.
- [x] Product state, API reads and route contracts are recorded.
- [x] Spartan, Relay, native and feature ownership boundaries are explicit.
- [x] Accessibility, keyboard, touch and high-zoom risks are documented.
- [x] RTL and localisation risks are documented.
- [x] Light/dark and per-user primary-accent requirements are documented.
- [x] Migration risks and primitive prerequisites are identified.
- [x] Existing tests and required follow-up regression coverage are recorded.
- [x] This audit makes no runtime or visual-contract change.

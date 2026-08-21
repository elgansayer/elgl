# Discovery Spartan / Relay audit

Issue: #6128 (`Spartan UI 0346`)

Target: `frontend/src/app/components/discovery`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining the main `DiscoveryComponent` surface under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit inventories every control and user-visible state rendered by `discovery.component.html`, the local and async state that drives those controls, the navigation and service boundaries behind them, and the sibling discovery components composed directly by the surface. It is intentionally behaviour-neutral. Detailed implementation work for composed primitives such as global search, language picker, sliders, empty state, scrollable pills and gradient button remains owned by their dedicated migration tickets.

The current surface is already partly converged. It uses Spartan Helm Button, Checkbox and Native Select, plus Relay/application primitives for pills, language selection, empty states and loading presentation. The largest remaining interaction risks are hand-modelled radio-like chip groups, clickable partner cards with overlapping navigation targets, direct low-level Helm usage where reusable Relay ownership is emerging, and a disabled primary component test suite.

## Discovery summary

The current target consists of:

- `discovery.component.ts`, which owns filter state, partner-search orchestration, audio-intro playback and onboarding side effects;
- `discovery.component.html`, which renders the sticky filter header, promotional banner, global search, loading/error/empty/result states and partner cards;
- `discovery.component.scss`, which only hides horizontal scrollbars, suppresses tap highlight on result articles and contains a desktop header rule;
- `discovery-skeleton-card.component.ts`, a presentation-only loading card built from the shared skeleton primitive;
- `discovery-map-error-boundary.component.ts`, a discovery-scoped error fallback with Spartan retry/report buttons;
- focused verification specs for search races, RTL, skeleton cards and the map error boundary;
- `discovery.component.spec.ts`, whose entire main suite is currently disabled with `describe.skip`;
- the lazy `/discovery` route in `frontend/src/app/app.routes.ts`.

The nested `global-search` directory is composed by this surface but has its own migration ticket. This audit records the parent-child contract only and does not duplicate its internal primitive audit.

There is no product analytics call in the main component. Error boundaries may report failures through `GlobalErrorHandler`, and the two onboarding services create tour side effects, but neither should be reclassified as product analytics during migration.

## Current navigation contracts

The surface currently exposes these route contracts:

| Source                         | Destination                                    | Contract to preserve                                                                      |
| ------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Header notification affordance | `/notifications`                               | Native navigation link                                                                    |
| Non-VIP gender upsell          | `/vip`                                         | VIP upgrade link                                                                          |
| Non-VIP distance upsell        | `/vip`                                         | VIP upgrade link                                                                          |
| Promotional banner CTA         | `/vip`                                         | VIP upgrade action                                                                        |
| Partner card                   | `/chat/:partnerId`                             | Starts/opens conversation                                                                 |
| Partner avatar region          | `/profile/user/:partnerId` in current template | Profile-navigation intent; verify against the canonical route table before implementation |
| Gradient action button         | `/chat/:partnerId`                             | Starts/opens conversation                                                                 |

The route table defines `/profile/:userId`, while this template currently uses `/profile/user/:partnerId`. The implementation ticket must verify whether a redirect/deep-link adapter intentionally supports the latter before preserving or correcting it. Do not silently change this contract as part of primitive conversion.

## Complete control inventory

| Element / behaviour                | Current implementation                  | State / side-effect owner                            | Target owner                                                                                          | Migration action                                                                     |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Notifications action               | Native `<a routerLink>`                 | Angular Router                                       | Native link plus Relay tokens                                                                         | Preserve native link semantics and touch target                                      |
| Top discovery filters              | `app-scrollable-pills`                  | `selectedFilter` and `onFilterSelect()`              | Relay selectable-pill primitive                                                                       | Preserve child API; converge child primitive independently                           |
| Target-language choices            | Repeated `<button hlmBtn role="radio">` | `selectedTargetLanguage`                             | Accessible single-select group, preferably approved Relay wrapper over native/Spartan radio semantics | Replace hand-modelled radio semantics only after capability verification             |
| Any-language choice                | `<button hlmBtn role="radio">`          | `selectedTargetLanguage`                             | Same single-select group as target languages                                                          | Migrate with language choices                                                        |
| Language picker                    | `app-language-picker`                   | Child plus `setLanguage()`                           | Relay language picker over Spartan Combobox                                                           | Preserve parent event/value contract                                                 |
| Any-interest choice                | `<button hlmBtn role="radio">`          | `selectedInterests`                                  | Accessible single-select chip/radio group                                                             | Migrate with interest choices                                                        |
| Interest tag choices               | Repeated `<button hlmBtn role="radio">` | `selectedInterests`                                  | Accessible single-select chip/radio group                                                             | Preserve one-interest-at-a-time behaviour                                            |
| Show more / less interests         | `<button hlmBtn>`                       | `showAllInterests`                                   | Relay/Helm Button                                                                                     | Preserve local expansion behaviour and focus                                         |
| Sort selector                      | `hlm-native-select`                     | `selectedSort`                                       | Spartan Helm/native Select, or approved Relay Select when available                                   | Preserve finite single-select semantics                                              |
| Gender selector                    | `hlm-native-select`, VIP-disabled       | `selectedGender`, `isVip`                            | Spartan Helm/native Select plus feature gating                                                        | Preserve disabled state and VIP-only request parameter                               |
| Gender VIP note                    | Native `<a routerLink="/vip">`          | Router                                               | Native link plus Relay VIP presentation                                                               | Preserve                                                                             |
| Age range                          | `app-age-range-slider`                  | `ageRangeMin`, `ageRangeMax`                         | Dedicated Relay feature primitive                                                                     | Preserve child contract; detailed work belongs to its own ticket                     |
| Distance                           | `app-distance-slider`                   | `selectedDistanceKm`, `isVip`                        | Dedicated Relay feature primitive                                                                     | Preserve VIP gating and debounced search                                             |
| Distance VIP note                  | Native `/vip` link                      | Router                                               | Native link plus Relay VIP presentation                                                               | Preserve                                                                             |
| Serious learner mode               | `hlm-checkbox`                          | `seriousLearnerMode`; persists through `UserService` | Spartan Helm Checkbox plus feature orchestration                                                      | Preserve persistence-before-state-change behaviour                                   |
| Voice-room-active filter           | `hlm-checkbox`                          | `voiceRoomActive`                                    | Spartan Helm Checkbox plus feature orchestration                                                      | Preserve immediate search behaviour                                                  |
| Promotional banner dismiss         | `<button hlmBtn>`                       | `showBanner`                                         | Relay/Helm Button                                                                                     | Preserve local, non-persistent dismissal                                             |
| Promotional banner VIP CTA         | `<button hlmBtn [routerLink]>`          | Router                                               | Prefer native link composed with approved button presentation                                         | Preserve `/vip` destination and accessible name                                      |
| Global search                      | `app-global-search`                     | Child emits `searchFilters`                          | Dedicated Relay feature component                                                                     | Preserve parent event contract; audit internally under its own ticket                |
| Outer discovery error retry/report | `app-discovery-error-boundary`          | Child error state / `GlobalErrorHandler`             | Dedicated Relay error boundary using Spartan buttons                                                  | Preserve boundary contract; detailed work belongs to its own ticket                  |
| Map/content error retry/report     | `app-discovery-map-error-boundary`      | Child error state / `GlobalErrorHandler`             | Relay error presentation plus Spartan Button                                                          | Preserve retry and report semantics                                                  |
| Search error retry                 | `app-empty-state` action                | `searchPartners()`                                   | Relay Empty State action                                                                              | Preserve                                                                             |
| No-results reset                   | `app-empty-state` action                | `resetFilters()`                                     | Relay Empty State action                                                                              | Preserve full reset semantics                                                        |
| Partner-card primary action        | `[routerLink]` on `<article>`           | Router                                               | Native link/card-link composition                                                                     | Replace implicit clickable article mechanics with explicit link semantics            |
| Partner avatar profile action      | Nested `[routerLink]` on `<div>`        | Router                                               | Native profile link                                                                                   | Preserve independent profile intent without nested interactive ambiguity             |
| Audio intro play/pause             | `<button hlmBtn>`                       | `HTMLAudioElement`, `playingPartnerId`               | Spartan/Relay Button plus feature-owned media state                                                   | Preserve pressed state and single-active-audio policy                                |
| Partner chat CTA                   | `app-gradient-button [routerLink]`      | Router                                               | Relay Button/Link primitive                                                                           | Preserve chat destination; remove duplicate competing click ownership where possible |

No menu, popover, dialog, drawer or focus-trapped overlay is rendered directly by the main discovery component.

## Presentation inventory

Presentation-only elements remain Relay or native composition and do not need Spartan Brain:

- offline banner and cached-data note;
- sticky header and filter layout;
- promotional VIP banner artwork;
- loading skeleton grid;
- search error and no-result empty states;
- results-count live status;
- partner grid and card surfaces;
- avatars and online indicators;
- VIP, partner-of-week and MBTI badges;
- fluency indicators;
- biographies, activity text and distance text;
- interest and shared-interest tags.

Do not add Brain dependencies solely to increase Spartan coverage. Brain is for reusable interaction state machines, not visual containers.

## Spartan ownership decisions

### Spartan Brain

The main surface does not currently require a dialog, menu or combobox state machine of its own. Brain involvement should occur through approved shared primitives.

The two hand-modelled radio-like groups are the strongest candidates for improved interaction ownership:

1. target-language quick choices;
2. interest quick choices.

They currently apply `role="radio"` and `aria-checked` directly to buttons, but they do not expose a containing `radiogroup` relationship or radio-group arrow-key behaviour. The implementation stage must first verify which Radio Group or Toggle Group capability is installed and approved in the repository. If an approved Spartan capability exists, expose it through the smallest Relay product API needed by reusable selectable chips. Otherwise prefer native radio semantics rather than creating a custom keyboard state machine.

`LanguagePickerComponent` remains the owner of searchable language selection and is already identified by the architecture as a Relay wrapper candidate over Spartan Combobox. Do not duplicate combobox state in `DiscoveryComponent`.

### Spartan Helm

Existing direct Helm usage is valid where no Relay wrapper currently owns the interaction:

- `hlmBtn` for feature-local actions;
- `hlm-checkbox` for boolean filter controls;
- `hlm-native-select` for finite sort and gender options.

Migration should reduce repeated feature-specific styling on these controls as Relay wrappers become authoritative, but it must not create parallel primitives just for this screen.

### Relay and application primitives

Keep and converge the existing shared product layer:

- `ScrollablePillsComponent` for top-level discovery modes;
- `LanguagePickerComponent` for searchable language selection;
- `AgeRangeSliderComponent` and `DistanceSliderComponent` for bounded numeric filters;
- `AppEmptyStateComponent` for error and no-result presentation;
- `DiscoverySkeletonCardComponent` plus `AppSkeletonLoaderComponent` for loading presentation;
- `FluencyIndicatorComponent` for language proficiency display;
- `AppGradientButtonComponent` only while its dedicated primitive migration remains authoritative.

`DESIGN.md` currently records known structural debt in scrollable pills, language picker and gradient button. This surface must consume the corrected primitives rather than carrying local forks of those fixes.

## State model

### Bootstrap state

`ngOnInit()` currently performs three asynchronous tasks in sequence:

1. load the current profile and derive target-language quick choices plus serious-learner mode;
2. load blocked user IDs;
3. execute the first partner search.

The main architecture now prefers `resource()` for data loading, so the implementation stage should review this lifecycle-based bootstrap. The documented lifecycle exception in this component is justified by imperative audio cleanup, not by profile/search data loading. Any refactor must preserve sequencing where it affects filters and blocking.

### Search state

Partner search owns:

- `isLoading`;
- `searchError` / `hasError`;
- `partners`;
- an `AbortController` for superseded requests;
- a 300 ms debounced trigger for slider changes.

Every direct filter action calls `searchPartners()` immediately except age and distance changes, which use the debounce subject. A new request aborts the previous request, and an aborted request must not overwrite results or clear loading state belonging to its successor.

The dedicated search-race regression test is therefore a critical contract. Primitive migration must never remove cancellation simply because filter wiring becomes more declarative.

The current component uses an RxJS `Subject` for debouncing even though the engineering constitution generally prohibits Subjects for state. This subject is an event trigger rather than durable state, but implementation work should still prefer a constitution-compliant mechanism if one is already available. Do not replace it with `setTimeout`.

### Filter state and query mapping

The component sends these filter fields to `DiscoveryService.findPartners()`:

- radius in metres;
- native language;
- target language;
- serious-learner-only flag;
- VIP-only gender;
- age min/max;
- serious learner mode;
- proficiency level;
- availability start/end;
- sort mode;
- voice-room-active flag;
- one selected interest.

The filter pills also mutate distance: nearby sets 10 km, city sets 25 km, and other modes restore 50 km. Preserve that product behaviour unless a dedicated product ticket changes it.

`resetFilters()` restores all filter signals to their defaults, including serious learner mode, sort, voice-room state, selected interest and expansion state, then searches again.

### Serious learner persistence

The serious-learner checkbox differs from ordinary filters. It first calls `UserService.updateMyProfile({ is_serious_learner: newMode })`. Only after that succeeds does it update local mode and, when enabling, force the serious filter. A failed persistence attempt leaves the local mode unchanged.

Do not convert this into an optimistic toggle unless the product contract explicitly changes and rollback/error feedback is specified.

The current UI has no inline pending or failure state for this mutation. Repeated activation may create overlapping profile updates. A follow-up implementation should add bounded pending/disabled feedback without changing persistence ownership.

### Offline state

`OfflineDiscoveryCacheService` supplies online and cache-availability signals. The component shows an assertive offline banner, while `DiscoveryService` itself owns offline cache selection and fallback ranking.

Do not move cache policy into the component or into a UI primitive. Relay owns only the offline presentation.

### Audio-intro state

The component owns one imperative `HTMLAudioElement` at a time. Activating a second partner stops the first. Play failure, media error and media completion all reset `playingPartnerId`.

This is feature media state, not button state. The button primitive should expose standard activation/focus semantics while `DiscoveryComponent` retains audio ownership.

`ngOnDestroy()` must continue to abort in-flight search and release audio resources.

### Banner state

`showBanner` defaults to true and is only local memory state. Dismissal does not persist across navigation or reload. Primitive migration must not introduce persistence or analytics unless separately specified.

### Onboarding state

`DiscoveryOnboardingService` starts a tour after results load when the tour has not been completed. `MatchmakingOnboardingService` also has start/active/complete methods on the component, but the current template does not render a control that invokes those methods.

Preserve these service boundaries. Do not invent new visible onboarding controls as part of this migration.

## Service and side-effect boundaries

| Boundary                               | Current operation                                   | Ownership rule                         |
| -------------------------------------- | --------------------------------------------------- | -------------------------------------- |
| `DiscoveryService.findPartners()`      | Partner search, offline/cache policy and enrichment | Feature/service, never Relay/Spartan   |
| `UserService.getMyProfile()`           | Initial language/mode data                          | Feature data layer                     |
| `UserService.updateMyProfile()`        | Persist serious learner mode                        | Feature data layer                     |
| `SafetyService.getBlockedIdsAsync()`   | Exclusion list                                      | Feature/safety layer                   |
| `OfflineDiscoveryCacheService` signals | Offline presentation inputs                         | Service truth, Relay presentation only |
| `DiscoveryOnboardingService`           | Discovery tour                                      | Feature side effect                    |
| `MatchmakingOnboardingService`         | Matchmaking tour state                              | Feature side effect                    |
| `GlobalErrorHandler` in child boundary | Error reporting                                     | Infrastructure, not UI primitive       |
| `HTMLAudioElement`                     | Audio-intro playback                                | Feature media side effect              |
| Angular Router                         | Notifications, VIP, profile and chat navigation     | Feature route contract                 |

No direct database call exists in the component. No product analytics hook was found in the audited files.

## Accessibility audit

### Radio-like quick filters

The target-language and interest chip controls expose `role="radio"` and `aria-checked`, but there is no explicit radio-group container or roving/arrow-key radio behaviour. Preserve ordinary Tab activation during migration only as a temporary compatibility path. The target should expose a complete single-select group contract through native or approved Spartan semantics.

The visible interest-label prefix is not itself a group label. The migrated group needs a deterministic accessible name associated with the selection set.

### Partner-card navigation

The current result is an `<article role="listitem">` with `routerLink`, with additional profile and chat navigation controls inside it. This creates overlapping click targets and makes the primary chat navigation less explicit to assistive technology than a native link.

Target structure should keep `article` as list content while using explicit native links for destinations. Do not nest links or make one focusable control contain another. Preserve a clear route to both profile and chat.

### Audio action

The audio-intro control correctly exposes a translated state-dependent accessible name and `aria-pressed`. Preserve both. Its current 20 to 24 pixel visual box is smaller than the repository's mobile touch-target expectation, so the implementation stage should increase the hit area through approved touch sizing without making the icon visually oversized.

### Labels and gated controls

Sort and gender have explicit labels. Serious learner and voice-room checkboxes have label relationships. Preserve them when wrappers change.

The non-VIP gender select is disabled and references the VIP note using `aria-describedby`. Preserve the explanation when refactoring. The distance slider must provide an equivalent gated explanation through its own public accessibility contract.

### Loading, error and results announcements

Current semantics include:

- loading section: `role="status"`, `aria-live="polite"`, `aria-busy="true"` and hidden loading copy;
- offline banner: `role="alert"` with assertive live behaviour;
- search failure: assertive section plus Relay empty state;
- no results: polite section plus Relay empty state;
- result count: hidden polite status.

Preserve useful announcements, but avoid duplicate live-region speech when the child empty-state primitive also gains announcement semantics. The offline banner should not repeatedly announce merely because unrelated filter state changes.

### Promotional banner

The banner has `role="complementary"` and a translated label. Its close action is icon-only but has a translated accessible name. Preserve this.

The CTA is navigation and should preferably be a native link with button presentation rather than button semantics carrying `routerLink`.

### Focus, keyboard and zoom

All filter actions and result destinations must remain keyboard operable with visible focus in light, dark and forced-colour modes.

At 200% and 400% zoom:

- the sticky filter header must not consume the viewport so completely that results become unreachable;
- horizontally scrollable pill rows need keyboard-visible focus without hidden clipping;
- labels and VIP notes must wrap without overlapping controls;
- touch targets must remain usable at the 390 px mobile baseline;
- result-card actions must remain distinct and focusable.

No focus trap or focus restoration contract exists because this surface renders no overlay directly.

## Internationalisation and RTL

Most product-authored copy already uses `TranslatePipe` or `I18nService`. Preserve that translation ownership.

User-provided display names, biographies, MBTI values and interests are data and must not be translated. Continue treating them as user content and preserve sanitisation boundaries.

The audited template uses logical `ms` and `end` utilities for directional layout. Keep logical properties during migration. Horizontal overflow rows must work when document direction is RTL and must not assume that scroll origin is the physical left edge.

The `getLanguageDisplay` responsibilities remain in the language-related shared primitives. Do not encode layout classes into translation data.

Long translations are a particular risk in:

- top filter pills;
- sort/gender labels;
- VIP gating notes;
- serious learner and voice-room labels;
- banner copy;
- empty-state actions.

Responsive validation should include at least one long-label locale and one RTL locale.

## Relay token and theme audit

Most of the main surface already uses Relay semantic tokens such as `surface-*`, `text-*`, `warning`, `success`, `vip` and `on-fill`.

Known migration risks remain:

1. the paid-practice banner uses a bespoke multi-colour gradient (`vip`, `accent`, `neon-orange`) and hardcoded `text-white` / `bg-white` utilities instead of consistently using theme-aware on-fill roles;
2. the banner's decorative `bg-white` circles are decoration, but the CTA's white fill and accent text require explicit light/dark contrast review;
3. target-language buttons use manual surface state classes instead of a shared selectable-chip variant;
4. interest choices use `accent-500` for an ordinary filter-selection state even though Relay reserves accent for celebratory/gift moments;
5. the audio button also uses `accent-500` for a routine media control;
6. `AppGradientButtonComponent` is already documented in `DESIGN.md` as a primitive with hardcoded gradient/ring debt;
7. `ScrollablePillsComponent` is already documented as having a hardcoded selected state pending its own migration.

Implementation should consume semantic `primary`/`secondary`/surface roles and corrected shared primitives rather than adding more local colour variants. Per-user primary accent behaviour must continue to work automatically through tokens.

## Responsive layout audit

Current responsive intent is:

- 390 px/mobile: single-column result grid, wrapped compact controls and horizontally scrollable pill/chip rows;
- tablet: two-column result grid and row layout for age/distance controls;
- desktop: three-column result grid and wider text bounds.

The sticky header currently contains several rows of controls and can become tall on small screens. Follow-up implementation should validate actual usable result viewport height instead of only checking width breakpoints.

`discovery.component.scss` contains a `.discovery-header` desktop rule, but the template header does not currently have that class. The rule therefore appears ineffective. Do not preserve dead selector behaviour merely because it exists; confirm and remove or wire it deliberately in the implementation stage.

## Migration risks

1. **Search races:** changing filter event wiring can reintroduce stale-result overwrites if AbortController ownership is lost.
2. **Duplicate searches:** child sliders may emit initial values, and the disabled main test notes an initial age-range emission can cause a second startup search.
3. **Persistent serious mode:** treating its checkbox like a normal local filter can desynchronise server profile state.
4. **VIP gating:** gender must not be sent for non-VIP users, and distance gating must remain enforced by the appropriate product layer.
5. **Blocked users:** blocked IDs are filtered again in the component even though the service also has blocking logic. Preserve safety until duplication is deliberately consolidated and tested.
6. **Offline fallback:** UI refactoring must not bypass `DiscoveryService` cache/fallback behaviour.
7. **Nested navigation:** converting the clickable card without preserving profile and chat destinations can break one route or create nested interactive controls.
8. **Audio cleanup:** migrating the play button must not leak media elements or allow multiple intros to play.
9. **Live-region duplication:** changing Empty State or error primitives can cause repeated announcements.
10. **Primitive drift:** local fixes to pills, language picker or gradient button would conflict with their dedicated migration work.
11. **Theme drift:** current use of celebratory accent/neon roles for routine filters can break the Relay duet and contrast model.
12. **Disabled regression suite:** the broad `DiscoveryComponent` test suite is `describe.skip`, so a visually small migration can currently bypass substantial behaviour coverage.
13. **Route ambiguity:** `/profile/user/:id` in this template must be reconciled with the canonical `/profile/:userId` route before link semantics are changed.
14. **Header height:** sticky multi-row filters can obscure content at high zoom or on short mobile viewports.

## Test and verification baseline

Existing coverage includes:

- `discovery.component.spec.ts`, which contains broad behaviour coverage but is entirely skipped;
- `discovery-search-race.spec.ts`, focused on cancellation/race behaviour;
- `discovery-map-rtl.verification.spec.ts`;
- `discovery-matchmaking-rtl.verification.spec.ts`;
- `discovery-map-error-boundary.component.spec.ts`;
- `discovery-skeleton-card.component.spec.ts`.

The implementation stage must first make the primary suite runnable or replace it with equivalent active tests. Do not claim regression protection from a skipped suite.

Minimum active regression coverage for conversion should verify:

1. `/discovery` renders the expected initial loading state;
2. profile target languages initialise the quick selector;
3. serious learner profile state restores correctly;
4. blocked users never render;
5. each top filter produces the documented distance/serious-mode query changes;
6. target-language single selection searches with the expected code;
7. interest single selection can select and clear;
8. sort changes search once with the selected mode;
9. non-VIP gender stays disabled and is not sent to the API;
10. VIP gender is sent;
11. age/distance changes remain debounced and do not create uncontrolled duplicate searches;
12. serious-learner persistence success and failure preserve the documented state contract;
13. voice-room filter toggles and resets correctly;
14. superseded searches cannot replace newer results;
15. loading, search-error, no-results and results states are mutually coherent;
16. offline and cached-data messaging remains correct;
17. reset restores every filter default;
18. notification and VIP links keep exact destinations;
19. profile and chat result actions expose valid, non-nested link semantics;
20. audio play/pause exposes correct accessible state, stops previous audio and cleans up on destroy/error;
21. keyboard focus can reach every filter/action in a deterministic order;
22. target-language and interest groups expose complete single-select semantics;
23. long translations reflow at 390 px and 200%/400% zoom;
24. RTL layout retains logical spacing and usable horizontal filter scrolling;
25. light, dark, forced-colour and reduced-motion modes preserve usable states.

Because this audit changes documentation only, it does not change runtime behaviour, tests or the mapped visual contract. No design-preview edit is required for this PR. The implementation/conversion tickets must update tests and Claude Design/design-preview when they change interaction or appearance.

## Primitive prerequisites and sequencing

Recommended sequence:

1. Complete or consume the dedicated Relay migrations for scrollable pills, language picker, gradient button, empty state, skeleton loader, age-range slider and distance slider where relevant.
2. Complete the separate `global-search` audit/conversion rather than embedding its behaviour into the parent.
3. Reactivate or replace the skipped primary discovery test suite.
4. Reconcile the partner profile route contract before changing card/link semantics.
5. Introduce an approved reusable single-select chip/radio composition only if the repository does not already have one.
6. Migrate target-language and interest quick selectors to that accessible composition.
7. Rework partner-card navigation into explicit native link semantics with separate profile/chat destinations.
8. Convert banner/media/filter colouring to Relay semantic roles and consume corrected shared primitives.
9. Preserve service-side search, safety, offline, onboarding and persistence behaviour while removing obsolete local styling and dead selectors.
10. Update representative discovery design-preview states in light/mobile and dark/wider modes, then run visual capture.

Do not combine unrelated discovery product changes, matching-algorithm changes or backend query changes with the primitive migration.

## Implementation checklist

- [ ] Preserve the lazy `/discovery` entry route.
- [ ] Keep all current filter/query inputs and reset defaults unless separately specified.
- [ ] Preserve AbortController stale-search protection.
- [ ] Preserve blocked-user and offline/cache safety boundaries.
- [ ] Preserve serious-learner persistence semantics and add pending/error feedback deliberately.
- [ ] Preserve one-active-audio-intro behaviour and cleanup.
- [ ] Replace incomplete hand-written radio semantics with native or approved Spartan-backed group semantics.
- [ ] Use explicit native navigation semantics for partner/profile/chat actions without nested interactive targets.
- [ ] Keep finite select and checkbox mechanics in approved Helm/Relay ownership.
- [ ] Consume shared primitive fixes instead of forking them locally.
- [ ] Remove routine use of celebratory accent/neon roles where Relay primary/secondary/surface semantics fit.
- [ ] Preserve first-class light/dark and dynamic per-user primary accent behaviour.
- [ ] Preserve logical RTL layout and test RTL horizontal scrolling.
- [ ] Meet mobile touch targets, high zoom/reflow and visible-focus requirements.
- [ ] Reactivate or replace the skipped main component test suite before behaviour-changing completion.
- [ ] Reconcile design-preview/Claude Design for material interaction or visual changes.

## Verification commands for implementation PRs

Run the repository frontend gate after behaviour or visual changes:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

If the mapped visual contract changes, also run the root design-sync check and the repository visual-capture workflow required by the UI governance gate.

## Acceptance-criteria traceability

- **No interactive element omitted:** the inventory above covers header navigation, all filter groups, selects, sliders, checkboxes, banner actions, global-search boundary, error/empty actions, partner navigation, audio playback and chat CTA.
- **Existing behaviour recorded:** search cancellation/debounce, filters, VIP gating, serious-mode persistence, offline state, blocked-user filtering, audio, onboarding, error reporting and route destinations are documented.
- **Analytics hooks recorded:** none were found in the main audited component; error reporting and onboarding are explicitly identified as separate side-effect boundaries.
- **Migration risks identified:** accessibility semantics, nested navigation, route ambiguity, search races, persistence, offline/safety ownership, skipped tests, theme roles, audio cleanup and responsive sticky-header risks are called out.
- **Prerequisite primitive work identified:** reusable pills, language picker, gradient button, sliders, empty/loading presentation and global search remain delegated to their dedicated migration work.

This audit changes no runtime or visual behaviour. It establishes the evidence and ownership map required for the following Spartan conversion, Relay-token/theme, accessibility and regression-preview stages.

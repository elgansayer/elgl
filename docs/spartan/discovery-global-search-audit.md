# Discovery global search Spartan / Relay audit

Issue: #6138 (`Spartan UI 0356`)

Target: `frontend/src/app/components/discovery/global-search`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining `GlobalSearchComponent` under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit inventories every control, state transition, output contract and presentation responsibility in the discovery global-search surface. It is intentionally behaviour-neutral. Later implementation tickets should preserve the discovery search contract while moving reusable interaction and visual concerns to the approved ownership layer.

The component is already partially converged. Its three selects use Spartan Helm `HlmNativeSelect`, and its Search action uses Spartan Helm `HlmButton`. The largest current ownership gap is that feature markup duplicates the select and button visual treatment instead of using the existing Relay `AppSelectComponent` and `AppButtonPrimaryComponent` wrappers.

There are no dialogs, popovers, menus, drawers, tooltips, drag interactions, navigation actions, analytics calls or direct API calls inside this component.

## Files and integration points

The current surface consists of:

- `global-search.component.ts`, which owns three filter signals, language-option derivation and the `searchFilters` output;
- `global-search.component.html`, which renders the search region, three labelled selects and Search action;
- `global-search.component.scss`, which only declares `:host { display: block; }`;
- `global-search.component.spec.ts`, which covers basic rendering, filter emission, language derivation and select changes;
- `DiscoveryComponent`, which renders `<app-global-search>` and consumes `(searchFilters)` through `onGlobalSearch()`;
- `DiscoveryService.SearchFilterParams`, whose wider filter contract includes the three fields emitted by this surface;
- `ALL_LANGUAGE_CODES` and `getLanguageFlag()` from the shared language-picker primitive.

The parent discovery page owns the actual search execution. `GlobalSearchComponent` emits filter intent only. It must not start calling `DiscoveryService.findPartners()` directly during migration.

## Current surface and state model

The component renders one `role="search"` region with:

1. translated `h2` heading;
2. Native Language select;
3. Target Language select;
4. Proficiency Level select;
5. Search Partners action.

The local state is deliberately small:

- `nativeLanguages`, default `''`;
- `targetLanguage`, default `''`;
- `level`, default `''`;
- `availableLanguages`, computed from `I18nService.currentLang()` and `Intl.DisplayNames`;
- `levels`, a fixed list of CEFR values A1 through C2 represented by translation keys.

There is no local loading, error, disabled or submitting state because this component does not own the asynchronous search operation.

## Existing primitive inventory

| Element / behaviour     | Current implementation                                   | Current state owner      | Target owner                                          | Migration action                                                    |
| ----------------------- | -------------------------------------------------------- | ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Search-region container | Feature `<div role="search">` with Relay token utilities | Feature                  | Feature composition / Relay tokens                    | Preserve semantic region; align surface tokens in visual ticket     |
| Search heading          | Native `h2` with translated copy                         | Feature                  | Native semantics / Relay typography                   | Preserve                                                            |
| Native-language label   | Native `<label for>`                                     | Feature                  | Relay Select label composition                        | Move into `AppSelectComponent` label API if practical               |
| Native-language control | `HlmNativeSelect` with feature-owned classes             | `nativeLanguages` signal | Relay `AppSelectComponent` over Helm native select    | Migrate to Relay wrapper                                            |
| Target-language label   | Native `<label for>`                                     | Feature                  | Relay Select label composition                        | Move into `AppSelectComponent` label API if practical               |
| Target-language control | `HlmNativeSelect` with feature-owned classes             | `targetLanguage` signal  | Relay `AppSelectComponent` over Helm native select    | Migrate to Relay wrapper                                            |
| Proficiency label       | Native `<label for>`                                     | Feature                  | Relay Select label composition                        | Move into `AppSelectComponent` label API if practical               |
| Proficiency control     | `HlmNativeSelect` with feature-owned classes             | `level` signal           | Relay `AppSelectComponent` over Helm native select    | Migrate to Relay wrapper                                            |
| Language option list    | Native `<option>` elements from `availableLanguages()`   | Computed signal          | Native option semantics inside Relay Select           | Preserve                                                            |
| Proficiency option list | Native `<option>` elements from `levels`                 | Component constant       | Native option semantics inside Relay Select           | Preserve                                                            |
| Search action           | `<button hlmBtn>` plus feature-owned visual classes      | Feature action           | Relay `AppButtonPrimaryComponent` over Spartan Button | Migrate to Relay wrapper                                            |
| Filter output           | `output<SearchFilterParams>()`                           | Feature                  | Feature                                               | Preserve contract, subject to clear-filter defect below             |
| Language display names  | `Intl.DisplayNames`                                      | Computed signal          | Feature/shared language data                          | Preserve until shared language metadata is deliberately centralised |
| Flag decoration         | `getLanguageFlag()`                                      | Shared language utility  | Shared language presentation data                     | Preserve; keep decorative meaning distinct from accessible name     |

## Spartan ownership decision

### Spartan Brain

No new Brain primitive is required for the current interaction model.

The three controls are native select elements underneath Helm. Native selection already supplies platform keyboard interaction, focus semantics, screen-reader support and mobile picker behaviour. Replacing these controls with a custom listbox solely to increase Spartan usage would add complexity without solving a demonstrated interaction problem.

A searchable Combobox may become appropriate if product requirements explicitly demand richer language searching. If that happens, use the existing Relay/Spartan language-selection architecture and let Spartan own combobox keyboard navigation, active option, focus and selection state. Do not implement a feature-local combobox state machine.

### Spartan Helm

`HlmNativeSelect` and `HlmButton` are already valid low-level Spartan owners. The issue is not missing Brain behaviour. The issue is that the feature imports Helm directly despite existing Relay product wrappers for both interaction classes.

The current template repeats a substantial custom class list on both the `class` and `selectClass` inputs of every native select. That duplicates presentation responsibility already centralised by `AppSelectComponent`.

The Search action similarly overrides the Helm button with product colour, radius, motion and sizing utilities that belong to Relay or the shared button wrapper.

### Relay

The repository already contains the preferred product-facing wrappers:

- `AppSelectComponent`, which wraps `HlmNativeSelect`, owns a translated label option and centralises Relay select styling;
- `AppButtonPrimaryComponent`, which wraps Spartan Button and maps the normal product action size to the touch-sized Helm button.

Later conversion should prefer these wrappers over direct feature imports from `@spartan-ng/helm/*` unless a verified capability gap makes the wrapper insufficient.

No new Relay primitive is needed for this component.

## Filter output contract

`applyFilters()` emits:

```text
native_languages -> current nativeLanguages value or undefined
target_language -> current targetLanguage value or undefined
proficiency_level -> current level value or undefined
```

The parent `DiscoveryComponent.onGlobalSearch()` then updates each parent signal only when the corresponding field is not `undefined`, and calls `searchPartners()`.

This creates an existing clear-filter defect:

1. a parent discovery filter is already set;
2. the user selects the `Any` option in global search, producing `''` locally;
3. `applyFilters()` converts `''` to `undefined`;
4. `onGlobalSearch()` ignores `undefined` rather than clearing the parent signal;
5. the previous parent filter remains active even though the global-search control displays `Any`.

The conversion stage must not accidentally hide this mismatch. The implementation should deliberately choose one contract and test it:

- emit empty strings for explicit `Any` selections so the parent clears those filters; or
- change the parent to distinguish omitted fields from explicit clearing.

Because this audit ticket is behaviour-neutral, it records the defect rather than changing the search contract here.

## Parent search behaviour

Global search is embedded inside the main Discovery screen. Its output is not navigation and is not a standalone API request.

The parent:

- copies emitted native language, target language and proficiency values into its own filter signals;
- calls `searchPartners()`;
- composes these values with the rest of the discovery filters;
- ultimately delegates the request to `DiscoveryService.findPartners()`.

`DiscoveryService` maps `proficiency_level` into the `level` query parameter and passes native/target language filters to the backend search request. Offline discovery and safety filtering also occur downstream in the service.

The global-search migration must not bypass this parent pipeline, duplicate cancellation/debounce logic, connect directly to the API or change safety filtering.

## Language option behaviour

`availableLanguages` recomputes when `I18nService.currentLang()` changes.

For every code in `ALL_LANGUAGE_CODES`, the component derives:

- a UI-locale display name using `Intl.DisplayNames([uiLanguage], { type: 'language' })`;
- a native-language display name using `Intl.DisplayNames([code], { type: 'language' })`;
- a flag/fallback globe through `getLanguageFlag()`.

The list is sorted by translated display name.

Fallback behaviour is defensive:

- unsupported UI locale falls back to English display names;
- failed translated-name resolution falls back to the upper-case code;
- failed native-name resolution falls back to the upper-case code.

The template currently renders the flag plus translated name. `nativeName` is computed but not rendered. This is not a functional problem, but migration code should not duplicate this derivation in another primitive.

## Accessibility audit

### Search landmark

The outer container uses `role="search"` and a translated `aria-label`. This is a valid landmark for the grouped partner-search controls.

The visible `h2` repeats the same conceptual title. A later accessibility pass may prefer `aria-labelledby` pointing at a stable heading ID to avoid maintaining parallel visible and accessible names. If this is changed, IDs must remain unique when multiple component instances exist.

### Labels and select relationships

All three controls currently have explicit `<label for>` relationships to fixed select IDs:

- `global-nativeLanguages`;
- `global-targetLanguage`;
- `global-proficiencyLevel`.

These relationships should be preserved by `AppSelectComponent`.

The fixed IDs are safe for the current single-instance discovery page, but they create duplicate-ID risk if more than one `GlobalSearchComponent` is rendered in the same document, including preview/test harnesses. `AppSelectComponent` supports caller-supplied IDs and also generates a default. A future migration should decide whether stable explicit IDs are required for tests or whether instance-safe IDs are preferable.

### Native select semantics

The underlying native select is desirable for:

- Tab focus;
- arrow-key navigation;
- native screen-reader semantics;
- native mobile picker behaviour;
- browser type-ahead behaviour.

Do not add manual `role="listbox"`, `aria-selected`, key handlers or roving tabindex to these native controls.

### Search button

The button has visible translated text and an identical translated `aria-label`. The explicit ARIA label is redundant because the visible text already provides the accessible name.

Migration can remove the duplicate ARIA attribute if the resulting name remains exactly the visible translated label. The action must stay a native button with `type="button"` semantics rather than a generic element with click/keyboard emulation.

The existing feature classes add `active:scale-[0.98]`. Any motion retained during the visual pass must respect reduced-motion preferences. Prefer the shared button's approved interaction treatment instead of feature-specific press animation.

### Focus visibility

Each select currently overrides focus styling with `focus:ring-*` plus `outline-none`. The migration should delegate focus treatment to the approved wrapper/Helm styling and verify visible focus in light theme, dark theme, forced colours and user-selected primary accents.

Do not remove browser focus indication unless the replacement is at least as visible.

### Touch and zoom

The Search action is full width and uses comfortable padding today. Migration to `AppButtonPrimaryComponent` should retain the shared touch target.

At 200% and 400% zoom:

- labels must wrap rather than overlap controls;
- translated option text must remain readable;
- the full-width controls must remain reachable without horizontal page scrolling;
- the Search action must not be clipped below a fixed-height container.

There is no fixed-height container in this component today, which is favourable for reflow.

## Internationalisation and RTL

All user-facing static copy in the template uses `TranslatePipe`.

Language names use `Intl.DisplayNames`, so the option list follows the current UI locale rather than hard-coded English naming. Preserve reactive recomputation when `currentLang` changes.

The component uses flex/gap layout and no physical left/right margin or border utilities. The current layout is therefore structurally RTL-safe.

Future migration should continue to avoid `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `border-l` and `border-r` utilities.

Flags are supplemental visual decoration and must not become the only language identifier. The translated language name must remain visible text.

Long language names and translated labels must be allowed to wrap or remain readable rather than being truncated solely to preserve a compact layout.

## Responsive layout and theme ownership

The component is mobile-first and currently uses:

- `p-3` with `sm:p-4`;
- `gap-3` with `sm:gap-4`;
- smaller labels/text at the mobile baseline;
- full-width selects;
- full-width Search action.

The overall one-column control stack is appropriate for the 390px baseline and can remain one column on wider layouts unless a deliberate design-preview decision calls for a denser arrangement.

The current feature template still owns several visual decisions that should move to Relay/shared variants in the styling stage:

- `rounded-xl` on the surface and Search button;
- `shadow-sm` on the surface;
- direct `bg-surface-*` and border composition for select controls;
- `bg-accent-500` / `hover:bg-accent-400` on the Search action;
- hard-coded `text-white` on the Search action instead of the semantic on-fill role;
- feature-specific transition and active-scale behaviour.

The later Relay-token ticket should use the repository's semantic radius, shadow, primary and on-fill roles. This audit does not change the visual contract.

Both light and dark themes must remain first-class, and primary action colour must continue to follow the per-user dynamic primary-accent contract rather than a fixed product colour.

## Filter-controls policy

Repository discovery guidance explicitly prefers compact controlled filters over free-text filter boxes. The current global-search surface follows that policy by using selects for all three fields.

The two language lists are large. Native select provides browser type-ahead but not the richer visible filtering behaviour of a searchable combobox. This audit does not require a combobox migration because native select is accessible and already owned by Relay/Helm.

If product testing shows language discovery is materially difficult with native type-ahead, treat searchable language selection as a separate capability decision and reuse an approved Relay/Spartan Combobox. Do not add a feature-local text filter plus bespoke option keyboard state.

## Error, loading and disabled states

There are no asynchronous operations owned by `GlobalSearchComponent`, so it currently has no loading/error state.

That separation should remain. Search loading and search failure belong to the parent Discovery content state, where the actual request is performed.

Do not add a permanent disabled or spinner state inside global search unless the parent exposes a real pending signal and the product intentionally prevents filter changes while a search is running.

If pending state is later wired in, the component API should receive it as an input rather than infer it through unrelated global state.

## Side effects, analytics and navigation

The component has exactly one outward side effect: emitting `searchFilters` when Search is activated.

It has:

- no Router injection;
- no `routerLink`;
- no analytics calls;
- no storage writes;
- no HTTP calls;
- no direct store mutation;
- no overlay open/close side effects.

Preserve this narrow boundary.

## Existing test coverage

The colocated Vitest suite currently verifies:

- component creation;
- translated heading rendering;
- three rendered native selects;
- Search button rendering;
- Search button accessible name;
- emitted values for populated filters;
- emitted `undefined` values for unset filters;
- language-option count and metadata;
- six CEFR levels;
- signal updates through native select change events;
- language-list recomputation when the UI locale changes.

This is a useful baseline, but later implementation should add coverage for the migration contract.

## Required regression coverage for follow-up tickets

At minimum, the conversion/accessibility/regression stages should cover:

1. the outer surface remains a named search landmark;
2. all three controls have associated translated labels;
3. all three selects are owned through the approved Relay/Helm path;
4. the Search action is owned through the approved Relay/Spartan button path;
5. keyboard Tab order follows native language, target language, proficiency level, Search;
6. native select keyboard behaviour is not replaced with manual key handling;
7. clicking Search emits all selected filters exactly once;
8. pressing Enter/Space on the Search button emits exactly once;
9. choosing `Any` after a parent filter was set actually clears that parent filter once the contract defect is fixed;
10. empty/default filters preserve the deliberately chosen clear/omit contract;
11. CEFR values remain `a1`, `a2`, `b1`, `b2`, `c1`, `c2`;
12. locale changes recompute translated language names;
13. unsupported locale/name resolution keeps the documented fallback behaviour;
14. labels and controls remain unique/associated if multiple component instances are rendered;
15. no raw hard-coded user-facing copy is introduced;
16. RTL direction does not require physical-direction overrides;
17. 390px layout keeps every control and action available;
18. 200% and 400% zoom preserve required content and action access;
19. light and dark themes retain WCAG AA focus and text contrast;
20. user-selected primary accent continues to drive the primary action where applicable;
21. Search does not bypass parent Discovery search orchestration;
22. migration does not introduce direct API, analytics, storage or navigation side effects.

## Dead and duplicative code noted during audit

`GlobalSearchComponent` still defines:

- `onNativeLanguageChange()`;
- `onTargetLanguageChange()`;
- `onLevelChange()`.

The current template does not use these methods. It binds Helm `(valueChange)` directly to the corresponding signals.

The conversion stage may remove these unused handlers after confirming there are no external template references. This is a cleanup, not a reason to change the public output contract.

The repeated select class strings are also duplicated three times and repeated between each `class` and `selectClass` input. Moving the controls to `AppSelectComponent` should remove that duplication rather than copying it into another feature helper.

## Migration risks

### 1. Clearing filters

This is the highest behavioural risk. Converting between Relay/Helm controls without fixing or explicitly preserving the current `'' -> undefined -> parent ignores` chain can leave displayed and active filters out of sync.

### 2. Double event wiring

Do not retain both old native/Helm event handlers and new Relay `valueChange` handlers. One user selection must update one signal once.

### 3. Duplicate IDs

Moving label rendering into `AppSelectComponent` can accidentally keep repeated hard-coded IDs across multiple component instances. Verify label/control association and instance safety.

### 4. Lost locale reactivity

Do not snapshot `availableLanguages()` into non-reactive state during migration. It must continue to derive from `currentLang()`.

### 5. Replacing native select unnecessarily

A custom Combobox migration would change mobile picker behaviour, keyboard handling and focus semantics. Do not make that change without an explicit searchable-selection requirement and dedicated tests.

### 6. Parent/child state divergence

The component has local filter signals while Discovery owns the effective search filters. A migration must not add a second store or service source of truth. If two-way synchronisation is required later, introduce an explicit input/output contract rather than reading parent state indirectly.

### 7. Visual token drift

Feature-level `text-white`, radius, shadow, colour and motion overrides can bypass Relay theme behaviour. The visual migration should remove those overrides rather than translating them one-for-one into new classes.

### 8. Language option performance

The two language selects each render the full `ALL_LANGUAGE_CODES` list. This is acceptable at the current scale, but a future richer combobox should avoid duplicating expensive derived lists or rebuilding language metadata per option interaction.

## Prerequisite and sequencing plan

Recommended order:

1. #6138: keep this audit as the baseline.
2. #6139: convert direct Helm usage to the existing Relay Select and primary-button wrappers where their verified APIs cover the requirement; fix the clear-filter contract deliberately with regression coverage.
3. #6140: remove off-token surface/control styling and align responsive/light/dark visual treatment with Relay.
4. #6141: run the dedicated accessibility, RTL, zoom, touch, reduced-motion and input-method pass.
5. #6142: lock final behaviour with regression coverage and synchronise the Claude Design/design-preview representation.

Do not create a new primitive before #6139 has confirmed that `AppSelectComponent` and `AppButtonPrimaryComponent` are insufficient.

## Implementation checklist

- Preserve `GlobalSearchComponent` as a feature composition boundary.
- Preserve `searchFilters` as the outward feature event unless a deliberate typed migration updates both parent and tests atomically.
- Keep API/search execution in `DiscoveryComponent` / `DiscoveryService`.
- Prefer `AppSelectComponent` over direct `HlmNativeSelect` usage.
- Prefer `AppButtonPrimaryComponent` over feature-styled direct `HlmButton` usage.
- Preserve native option semantics.
- Preserve translated labels and locale-reactive language names.
- Resolve the explicit-filter-clearing mismatch instead of carrying it silently forward.
- Preserve logical/RTL-safe layout.
- Use Relay semantic radius, shadow, colour and on-fill roles in the visual stage.
- Keep light/dark and user-primary-accent behaviour first-class.
- Do not add bespoke keyboard/listbox behaviour.
- Remove unused change handlers only after tests confirm no contract loss.
- Update focused tests with every behavioural migration.
- Update design preview only when a visual/interaction contract actually changes.

## Verification guidance

This audit changes documentation only and does not change runtime behaviour. The implementation stages should run the repository frontend gate described by `docs/spartan-relay-architecture.md`, including:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

For the conversion stage, run the focused `global-search.component.spec.ts` suite while iterating, then the full frontend and repository-required CI gates.

## Rollback

This audit is documentation-only. Reverting this file removes the migration baseline without changing application behaviour, routes, APIs, persistence, analytics or visual output.

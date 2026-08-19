# Emoji picker Spartan / Relay audit

Issue: #6163 (`Spartan UI 0381`)

Target: `frontend/src/app/components/emoji-picker`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining `EmojiPickerComponent` under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit covers every current control, state, output, bespoke utility, accessibility concern, RTL/i18n requirement, theme/responsive requirement and migration risk in the emoji picker. It does not redesign the emoji catalogue, add new emoji metadata, choose a product-specific host overlay, or change the `emojiSelect` output contract.

The component is currently self-contained and is not referenced elsewhere in the repository. That means there is no active route, host overlay, analytics hook, API request or persistence side effect to preserve today. Follow-up work must keep the picker reusable rather than coupling it to one composer before a concrete host contract is chosen.

## Current surface

`EmojiPickerComponent` is a standalone component with an inline template and inline styles.

It renders:

1. one fixed-size picker panel;
2. one search text input using Spartan `hlmInput`;
3. nine category-selection buttons using Spartan `hlmBtn`: Smileys, People, Animals, Food, Travel, Activities, Objects, Symbols and Flags;
4. a horizontally scrollable category strip with its scrollbar visually hidden;
5. one scrollable emoji grid containing a button for every emoji in the active category that matches the current filter;
6. no explicit empty-search result state;
7. no loading, error, disabled or pending state;
8. no dialog, popover, menu, tooltip, sheet or focus trap inside the component itself.

The component owns two local signals:

- `selectedCategory`, initially `Smileys`;
- `searchQuery`, initially empty.

It exposes one output:

- `emojiSelect: output<string>()`, emitted synchronously when an emoji button is activated.

It performs no network request, storage write, Router navigation, analytics call or other external side effect.

## Existing implementation inventory

| Element / behaviour         | Current implementation                                                                            | State owner                                       | Target owner                                                 | Audit action                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Picker panel                | `div` with `bg-surface-200`, `border-surface-100`, `rounded-xl`, `shadow-2xl`, `w-72`, `max-h-80` | Feature presentation                              | Relay / app composition                                      | Keep structure; replace off-contract radius/elevation/fixed sizing where required |
| Search field                | native `input` + `hlmInput` + `[(ngModel)]="searchQuery"`                                         | Feature filter state + Spartan Input presentation | Spartan Helm Input + Field/Label composition + feature state | Keep Input; add accessible label and translation-safe copy                        |
| Search placeholder          | hard-coded `Search emoji...`                                                                      | Feature copy                                      | I18n / Field composition                                     | Replace with translation key                                                      |
| Category strip              | horizontally scrollable `div`                                                                     | Feature presentation                              | Relay layout + Spartan selection primitive                   | Convert selection semantics; preserve horizontal overflow where useful            |
| Nine category actions       | native `button` + `hlmBtn`                                                                        | Feature category state                            | Spartan Tabs or Toggle Group, chosen from documented API     | Replace ad hoc selection semantics with one approved primitive                    |
| Active category style       | conditional full class string                                                                     | Feature styling                                   | Relay semantic variant/state styling                         | Move to primitive-supported selected state / semantic variant                     |
| Emoji grid                  | native CSS grid                                                                                   | Feature layout                                    | Relay layout                                                 | Keep grid concept; make responsive/density-safe                                   |
| Emoji actions               | native `button` + `hlmBtn`                                                                        | Feature selection                                 | Spartan Button or collection primitive                       | Keep native activation semantics; review focus strategy for large collections     |
| Emoji accessible name       | hard-coded `'Emoji ' + emoji`                                                                     | Feature copy                                      | I18n + emoji metadata                                        | Replace hard-coded English and provide meaningful names where metadata exists     |
| Search result computation   | plain `filteredEmojis()` function                                                                 | Feature state                                     | Angular `computed()`                                         | Convert to computed derived state                                                 |
| Search matching             | `emoji.includes(query)`                                                                           | Feature filtering                                 | Product/domain logic                                         | Preserve unless a separate metadata/search enhancement intentionally changes it   |
| Empty search state          | no dedicated output                                                                               | Feature presentation                              | Relay Empty/status composition                               | Add translated empty result when search yields no emoji                           |
| Scrollbar hiding            | inline component CSS                                                                              | Feature presentation                              | Relay/shared scroll treatment                                | Reassess; do not hide discoverability without an alternate cue                    |
| Emoji selection side effect | `emojiSelect.emit(emoji)`                                                                         | Feature contract                                  | Feature output                                               | Preserve exactly                                                                  |
| Host overlay                | none                                                                                              | N/A                                               | Host feature + Spartan overlay primitive                     | Do not invent inside this component                                               |
| API/storage/navigation      | none                                                                                              | N/A                                               | N/A                                                          | Preserve absence                                                                  |
| Analytics                   | none                                                                                              | N/A                                               | N/A                                                          | Do not invent during migration                                                    |

Every current interactive element is classified above: one search field, nine category controls, and the generated emoji buttons.

## Spartan ownership

### Search field: Input plus Field/Label

The picker already uses the owned Spartan `hlmInput` directive. The migration should preserve that primitive rather than replacing it with a bespoke text field.

The missing piece is form semantics. Placeholder text is not an accessible label. Follow-up implementation should compose the Input through the repository's approved Field/Label pattern, using either a visible label or a visually hidden translated label according to the final design.

Search state remains feature-owned. Spartan should not own the emoji filtering algorithm.

### Category selection: Tabs or Toggle Group

The nine category controls represent one mutually exclusive view selection. They are currently ordinary buttons with visual selected styling only.

The implementation stage should inspect the installed Spartan APIs and choose one documented selection primitive:

- Tabs if categories are treated as labelled views whose associated emoji grid is the tab panel;
- single-selection Toggle Group if the product deliberately treats the row as compact filter controls rather than tabs.

Tabs are the stronger semantic match to the current category-to-content relationship. Whichever primitive is selected must own keyboard selection behaviour, selected state semantics and focus management. Feature code should only own the selected category value.

Do not hand-roll `role="tab"`, `aria-selected`, roving `tabindex` or arrow-key state when the Spartan primitive can provide them.

### Emoji buttons

Selecting an emoji is an immediate action, so native buttons enhanced by Spartan Button remain appropriate.

A separate Brain state machine is not required for the activation itself. The implementation stage should, however, review keyboard focus density because a category can contain a very large number of emoji buttons. Hundreds of sequential Tab stops make keyboard traversal inefficient.

If the installed Spartan collection/grid primitives provide a documented roving-focus pattern suitable for this use case, prefer that behaviour. Otherwise keep native buttons and add a clearly documented focus strategy rather than inventing unsupported ARIA grid mechanics.

### Host overlay responsibility

`EmojiPickerComponent` does not currently render or control an overlay. Repository search shows no current consumer of `app-emoji-picker` or `EmojiPickerComponent` outside its own file.

The component must therefore stay overlay-neutral. A composer that later opens the picker should choose the appropriate Spartan Popover, Dialog, Sheet or other host primitive based on its product interaction. The picker itself should not add backdrop listeners, global Escape handlers, document click listeners or a focus trap.

This boundary avoids coupling a reusable picker to one desktop/mobile presentation.

## Relay ownership

Relay owns product presentation around the interaction primitives:

- panel surface, border, radius and elevation;
- spacing and density;
- responsive width/height limits;
- search/category/grid spacing;
- selected and hover visual roles exposed through approved primitive variants;
- light/dark parity;
- forced-colour behaviour;
- reduced-motion behaviour;
- high-zoom/reflow behaviour;
- per-user primary accent usage;
- shared empty-result presentation.

The current panel already uses semantic surface tokens for background and border, and category selection uses semantic primary/surface roles. The main visual ownership gaps are the generic `rounded-xl`, raw `shadow-2xl`, fixed `w-72`/`max-h-80`, and ad hoc button class strings.

Follow-up work should use Relay radius/elevation/layout roles rather than introducing new local colour, shadow or radius values.

## State model

The current state model is small but has distinct user-visible combinations.

| State                         | Trigger                              | Current result                                   | Required ownership                          |
| ----------------------------- | ------------------------------------ | ------------------------------------------------ | ------------------------------------------- |
| Initial                       | component renders                    | Smileys category, empty query                    | Feature state + Relay presentation          |
| Category changed              | category button activated            | selected category changes and grid is recomputed | Spartan selection primitive + feature value |
| Search active with matches    | query contains matching emoji glyphs | matching emoji subset in selected category       | Feature derived state                       |
| Search active without matches | query has no emoji match             | empty grid with no explanation                   | Feature state + Relay Empty/status gap      |
| Emoji selected                | emoji button activated               | `emojiSelect` emits selected string              | Feature output                              |
| Host dismissed                | controlled by future consumer        | no local dismissal contract                      | Host feature + Spartan overlay              |

### Derived state

`filteredEmojis` is currently a plain function that reads `searchQuery()` and `selectedCategory()` on every template evaluation.

Because the result is entirely derivable from signals, the implementation stage should use `computed()` so Angular owns dependency tracking and consumers receive a stable reactive contract.

### Search semantics

The current search algorithm performs `emoji.includes(query)`. It does not search Unicode names or keywords such as `smile`, `dog` or `food`.

That behaviour is surprising when the placeholder says `Search emoji...`, but enriching search requires an emoji metadata source and is beyond a primitive migration. The conversion ticket should either preserve current matching exactly or explicitly coordinate a product search enhancement. It must not silently add an unreviewed dependency or ship a second emoji catalogue.

## Data inventory and integrity

`EMOJI_CATEGORIES` is a static in-file catalogue grouped under nine English category names.

Audit observations:

- category names are user-facing English strings rather than translation keys;
- emoji glyphs are domain data and should not themselves be translated;
- there is no per-emoji descriptive name or keyword metadata;
- several emoji appear in more than one category, which is acceptable if intentional;
- the Flags collection contains `🇧長`, which is not a normal two-regional-indicator flag sequence and should be verified as a data-quality defect before the conversion stage relies on the catalogue for accessibility naming or search metadata.

Do not move the entire catalogue into a UI primitive merely to satisfy Spartan ownership. If metadata is introduced, keep emoji-domain data in a focused data module/service so the interaction component stays maintainable and testable.

## I18n and multilingual behaviour

The current component violates the repository's zero-hard-coded-UI-string rule in three places:

1. `Search emoji...` is hard-coded in the template;
2. category names such as `Smileys`, `People` and `Flags` are hard-coded in the TypeScript catalogue and rendered directly;
3. every emoji button uses the hard-coded accessible prefix `Emoji `.

The implementation stage should:

- add translation keys for the search label/placeholder and each category label;
- keep stable non-localised category IDs separate from translated display labels;
- avoid using translated labels as state identity or `@for` tracking keys;
- provide a translation-safe empty-result message;
- replace the English-only emoji accessible name strategy with metadata-backed names where practical;
- preserve the emoji glyph itself as the selected output value.

Translated labels may be substantially longer than English. Category controls must remain usable without clipping at 200 percent and 400 percent zoom.

## Accessibility audit

### Search input

The search input currently has only a placeholder. It needs a persistent accessible name through Label/Field composition.

Required regression coverage should verify:

- an accessible search name exists independently of placeholder text;
- keyboard focus is visible;
- the control remains usable in light, dark and forced-colour modes;
- typing updates the rendered result set without moving focus unexpectedly.

### Category controls

The current selected category is communicated by colour only. Ordinary buttons do not expose a mutually exclusive selected relationship to assistive technology.

A Spartan selection primitive should provide the missing semantics. Tests should verify:

- one category is selected at a time;
- selected state is exposed semantically, not only visually;
- arrow-key or documented primitive navigation works where applicable;
- activation changes the associated grid without unexpectedly moving focus;
- category labels are translated and remain unique.

### Emoji controls

Every emoji is currently a native button, which gives correct basic click/keyboard activation. The accessible name `Emoji <glyph>` is weak because many screen readers already announce Unicode emoji descriptions and the English prefix is not localised.

The implementation stage should define one authoritative naming strategy and test the rendered accessibility tree. Avoid duplicative announcements such as `Emoji grinning face grinning face`.

Large category collections also need an efficient keyboard strategy. At minimum, preserve visible focus and avoid trapping focus inside the grid.

### Empty results

An empty grid provides no feedback today. A translated visible empty state should explain that no emoji matched the current search. If filtering occurs immediately as the user types, any live-region announcement should be polite and bounded so it does not announce on every keystroke excessively.

### Touch targets

Emoji buttons are currently `w-8 h-8`, approximately 32px square, below the repository's preferred approximately 44px touch target for primary touch interactions.

The migration should increase touch hit areas without necessarily increasing the visible glyph size. Category controls should likewise use an approved Spartan size/variant instead of local `px-2 py-1` sizing when the documented primitive supports it.

## RTL audit

The current layout uses no physical left/right positioning utilities, which is a good baseline.

The category strip is horizontally scrollable. Follow-up work must verify its logical start position and keyboard navigation under `dir="rtl"`; browser scroll coordinate behaviour differs across engines, so do not add manual left/right scroll assumptions.

If Tabs or Toggle Group uses directional arrow navigation, rely on the Spartan primitive's RTL-aware behaviour rather than implementing key direction manually.

The emoji grid itself is visually symmetric, but category order and translated labels still need an RTL design check.

## Responsive, zoom and density audit

The panel uses `w-72` and `max-h-80`, while the grid is always eight columns with `w-8 h-8` buttons.

Risks:

- fixed width may overflow narrow host containers at high zoom;
- eight columns can force undersized touch targets;
- long translated category labels may require much more horizontal space;
- hidden scrollbars can make the category overflow affordance difficult to discover;
- increased browser text size can crowd the search and category strip;
- an overlay host may impose its own max-width/max-height constraints.

The conversion should be mobile-first and host-aware. Prefer a width that can shrink to the available inline size and a grid/density strategy that preserves minimum touch areas. Any desktop density optimisation must remain usable at 390px and high zoom.

## Theme, accent and forced-colour audit

Current strengths:

- panel/background/border use semantic surface roles;
- text uses semantic text roles;
- selected category uses `bg-primary text-on-fill`;
- hover state uses surface roles rather than raw palette colours.

Current gaps:

- `shadow-2xl` is generic rather than a Relay elevation role;
- `rounded-xl` and local rounded values do not express the documented Relay radius hierarchy;
- dynamic selected/unselected class strings duplicate interaction presentation at the feature call site;
- forced-colour behaviour is not explicitly tested.

The implementation stage should use the approved Relay/Helm variants so a user's primary accent remains valid in both light and dark themes without one-off colour overrides.

## Behaviour, route, analytics and side-effect contract

Repository search finds no current consumer of `EmojiPickerComponent`. Therefore the current contract is limited to local state plus `emojiSelect`.

There is currently:

- no Router navigation;
- no service/API call;
- no storage access;
- no analytics hook;
- no async task;
- no host open/close event;
- no focus-restoration contract because there is no host overlay;
- no mutation beyond local category/search state.

A Spartan migration must preserve that absence. Adding analytics, persistence, recent-emoji history, skin-tone preference, network emoji search or an overlay host would be separate product behaviour and should not be bundled silently into primitive conversion.

## Test inventory and required regression coverage

No `emoji-picker.component.spec.ts` exists beside the current component, and repository search did not identify another dedicated EmojiPicker test suite.

The implementation stage should create focused unit coverage for at least:

1. default category is stable and renders its emoji collection;
2. selecting each category changes the active collection;
3. only one category is semantically selected;
4. search filtering remains scoped to the selected category unless product requirements intentionally change it;
5. empty search results render translated feedback;
6. emoji activation emits exactly the selected glyph once;
7. search/category labels contain no hard-coded English contract;
8. keyboard focus and selection semantics come from the chosen Spartan primitive;
9. emoji buttons are keyboard activatable and visibly focusable;
10. touch targets meet the approved size contract;
11. RTL mode does not introduce physical-direction utilities or broken category navigation;
12. long translated labels and high zoom reflow without clipping essential controls;
13. light and dark themes use Relay semantic roles;
14. forced-colour mode preserves selected/focus state without relying on colour alone;
15. no API, navigation, storage or analytics side effect occurs during normal selection.

Because this audit changes documentation only, it intentionally does not modify runtime tests or the Claude Design preview. The implementation/conversion tickets should add the test suite and reconcile the mapped design preview when they change the shipped visual or interaction contract.

## Migration risks

### Accidental overlay coupling

The largest architectural risk is turning this reusable content component into its own Dialog/Popover without a known host contract. Keep overlay mechanics in the consuming feature.

### Incorrect ARIA grid implementation

A large emoji collection tempts custom roving-focus code. Do not add manual ARIA grid roles or arrow-key state unless the behaviour follows a documented, tested Spartan primitive. Native buttons are preferable to an incorrect composite widget.

### Search behaviour drift

Moving search logic while introducing metadata can silently change which emoji match. Lock the current contract in tests before any enhancement.

### Localised identity drift

Do not use translated category labels as internal IDs, state keys or tracking keys. Locale changes must not reset or corrupt selection merely because the displayed label changed.

### Touch-density regression

Increasing from 32px to touch-safe targets changes the number of visible columns and panel height. Treat this as a responsive composition change and update design-preview coverage intentionally.

### Catalogue maintenance

The large in-component static array dominates the file and makes behavioural code harder to review. Moving catalogue data to a focused module is reasonable, but it must remain a pure refactor unless a separate data-quality change is explicitly reviewed.

## Recommended implementation sequence

1. Add a focused EmojiPicker unit test suite that captures current selection/output behaviour.
2. Separate stable category IDs from translated category labels and add I18n keys.
3. Convert `filteredEmojis` to `computed()` without changing matching semantics.
4. Confirm installed Spartan Tabs and Toggle Group APIs with the repository CLI/Spartan documentation.
5. Move category selection to the chosen Spartan primitive, preferring Tabs if the category/content relationship remains unchanged.
6. Keep emoji activation on native Spartan Buttons and choose a documented focus strategy for the large collection.
7. Add Field/Label composition to the search Input.
8. Add translated empty-result feedback.
9. Replace local radius/elevation/density styling with Relay/Helm semantic roles.
10. Make panel/grid sizing mobile-first, host-aware and touch-safe.
11. Verify RTL, long translations, forced colours, reduced motion and 200/400 percent zoom.
12. Reconcile the Relay + Spartan design preview and run visual capture when the runtime visual contract changes.

## Primitive prerequisites

Before implementation, verify the checked-in Helm inventory and the current Spartan CLI output for:

- `input`;
- `field` / `label`;
- `button`;
- `tabs`;
- `toggle-group`;
- optional collection/scroll primitives if a documented keyboard model is required.

Do not generate a duplicate primitive if the repository already owns it under `frontend/src/app/components/ui`.

No new primitive is required merely to complete this audit.

## Verification contract for follow-up implementation

From `frontend/`, run the repository's actual verification commands after runtime changes:

```bash
npm test -- --watch=false
npm run lint:check
npm run build
npm run check:spartan-health
```

For a material visual-contract change, also run the repository's mapped design checks and visual capture workflow required by CI.

For this documentation-only audit, repository CI is authoritative for confirming that the new document does not disturb the codebase.

## Rollback

This audit changes documentation only and has no runtime rollback requirement.

If a later migration causes interaction or accessibility regressions, revert the runtime conversion while retaining this audit as the inventory of required behaviour and risks. Do not roll back by reintroducing hard-coded UI strings, ad hoc selection semantics or feature-owned keyboard state that Spartan can own correctly.

## Completion criteria

Issue #6163 is complete when this audit is reviewed as the implementation baseline and the follow-up conversion work can answer, without rediscovery:

- which controls exist;
- which state and output contracts must be preserved;
- which behaviour belongs to Spartan versus Relay versus the feature;
- which i18n and accessibility defects already exist;
- which RTL/theme/responsive constraints apply;
- which primitive prerequisites must be confirmed;
- which regression tests and design-preview states are required before shipping runtime changes.

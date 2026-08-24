# Flashcard deck Spartan / Relay audit

Issue: #6202 (`Spartan UI 0416`)

Target: `frontend/src/app/components/flashcard-deck`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for the `components/flashcard-deck` Spartan UI + Relay migration sequence.

The audit covers every current control, state, service call, navigation contract, accessibility concern, RTL/i18n requirement, responsive/theme requirement and migration risk in `FlashcardDeckComponent`. It follows `docs/spartan-relay-architecture.md`: feature code owns deck and SRS product behaviour, Relay owns reusable product presentation, Spartan owns generic accessible interaction mechanics when an appropriate primitive exists, and native HTML remains preferred when it already supplies the right semantics.

This audit does not change deck APIs, SRS behaviour, navigation, persistence, visual output or analytics/observability behaviour.

## Current surface

`FlashcardDeckComponent` is a standalone Angular component with an inline template and one small host style. It imports:

- Spartan Helm `HlmButton`;
- Relay `AppCardComponent`;
- Relay `AppButtonPrimaryComponent`;
- Relay `AppInputComponent`;
- Relay `AppChipComponent`;
- shared `SrsErrorBoundaryComponent`;
- shared `A11yClickableDirective`;
- `TranslatePipe` and `I18nService`;
- `DeckService`;
- `VocabularyStore`;
- `HtmlSanitisationService`;
- Angular `Router` and `ErrorHandler`.

The component has two local views:

1. `list`, containing deck browsing and deck creation;
2. `detail`, containing deck editing, card membership management and review launch.

There are no dialogs, popovers, menus, drag-and-drop interactions or direct analytics calls in this component. Error reporting is delegated through Angular `ErrorHandler` and the shared SRS error boundary.

## Route and navigation contracts

The learning route exposes the surface at:

```text
/decks
```

Starting review does not create a deck-specific URL. `startDeckReview()` copies the selected deck's currently loaded cards into:

```text
VocabularyStore.pendingReviewCards
```

and then navigates to:

```text
/review
```

The migration must preserve that route and hand-off contract unless a separate product ticket intentionally changes SRS navigation.

The list/detail transition itself is feature-local signal state. Opening a deck does not currently change the URL or browser history.

## Data and service contracts

`DeckService` owns the authenticated REST boundary under `/decks`:

```text
GET    /decks
GET    /decks/:id
POST   /decks
PATCH  /decks/:id
DELETE /decks/:id
GET    /decks/:id/flashcards
POST   /decks/:id/flashcards
DELETE /decks/:id/flashcards/:flashcardId
```

Every request includes the current bearer token from `AuthService`.

The component also depends on `VocabularyStore.loadAllFlashcards()` and reads `VocabularyStore.allFlashcards()` to resolve card IDs returned by `DeckService` into local `Flashcard` records.

The deck surface performs these mutations:

- create deck;
- edit deck metadata;
- delete deck;
- add a flashcard to a deck;
- remove a flashcard from a deck.

It performs these read operations:

- list decks;
- load a selected deck's flashcard IDs;
- load all flashcards from the vocabulary store.

There is no direct browser-storage write, WebSocket operation, media operation or analytics event in the component.

## Current reactive state

The component owns these signals:

### View and collection state

- `activeView`: `list` or `detail`;
- `decks`: loaded deck records;
- `isLoading`: initial/list reload state;
- `isCreating`: create mutation state.

### Create state

- `showCreateForm`;
- `newDeckName`;
- `newDeckDescription`;
- `newDeckColour`;
- `newDeckIcon`.

### Detail/edit state

- `selectedDeck`;
- `deckCardIds`;
- `deckCards`;
- `showEditForm`;
- `editDeckName`;
- `editDeckDescription`;
- `editDeckColour`;
- `editDeckIcon`.

### Derived state

- `availableFlashcards`: every vocabulary card not already in the selected deck;
- `errorContext`: SRS error metadata derived from current view and selected deck.

The component has no dedicated pending state for update, delete, add-card or remove-card mutations. That is an important migration risk because repeated activation can start overlapping requests.

## Complete control and state inventory

| Element / behaviour | Current implementation | Current owner | Target owner | Audit action |
| --- | --- | --- | --- | --- |
| SRS failure fallback | `app-srs-error-boundary` | Shared SRS composition | Shared Relay/SRS composition | Preserve; do not duplicate fallback UI in deck feature |
| Error Retry | child `AppButtonPrimaryComponent` | Shared SRS boundary | Shared SRS boundary | Preserve child ownership |
| Error Report | child native button + `hlmBtn` | Shared SRS boundary | Shared SRS boundary | Preserve child ownership |
| Browse/list reset | native `button` + `hlmBtn` | Feature state + Spartan Button | Relay button wrapper where useful, otherwise Helm Button | Preserve local `activeView='list'` behaviour |
| Create/Cancel form toggle | `AppButtonPrimaryComponent` | Relay Button + feature state | Relay Button | Keep primitive; product toggle remains feature-owned |
| Create name | `AppInputComponent` | Relay Input | Relay Input | Keep |
| Create description | `AppInputComponent` | Relay Input | Relay Input | Keep |
| Create colour selection | 8 `button hlmBtn` swatches with manual selected classes | Feature-owned selection + Spartan Button | Spartan single-selection primitive wrapped by Relay presentation | Replace manual mutually exclusive selection semantics |
| Create icon selection | 15 `button hlmBtn` emoji actions with manual selected classes | Feature-owned selection + Spartan Button | Spartan single-selection primitive wrapped by Relay presentation | Replace manual mutually exclusive selection semantics |
| Save new deck | `AppButtonPrimaryComponent` | Relay Button | Relay Button | Keep; strengthen busy semantics |
| Initial loading | `role=status`, `aria-busy=true` text block | Feature presentation | Relay loading/status composition | Preserve state distinction; converge presentation if shared primitive fits |
| Empty deck collection | bespoke `app-empty-state` classes | Feature presentation | `AppEmptyStateComponent` if its API fits | Converge to approved Relay empty state |
| Deck card open action | clickable `article` + `appA11yClickable` + explicit `tabindex=0` | Feature hand-rolled interaction | Native interactive control/link or approved Relay interactive item/card | Replace synthetic click/keyboard ownership |
| Deck delete | nested `button hlmBtn`, visually hidden until hover | Feature mutation + Spartan Button | Relay/Helm Button + feature mutation | Keep native button, fix touch/keyboard visibility and pending state |
| Deck card count | `AppChipComponent` with no click handler | Relay interactive Chip used as static content | `AppPillComponent` or other static Relay badge | Replace interactive chip semantics for static metadata |
| Detail Back | native `button` + `hlmBtn` | Feature state + Spartan Button | Relay/Helm Button | Keep product state transition |
| Detail Edit | native `button` + `hlmBtn` | Feature state + Spartan Button | Relay/Helm Button | Keep product state transition |
| Start Review | `AppButtonPrimaryComponent` | Relay Button + feature navigation | Relay Button | Keep; preserve `/review` hand-off |
| Detail card count | `AppChipComponent` | Relay interactive Chip used as static content | `AppPillComponent` or static badge | Replace interactive semantics |
| Edit name | `AppInputComponent` | Relay Input | Relay Input | Keep |
| Edit description | `AppInputComponent` | Relay Input | Relay Input | Keep |
| Edit colour selection | 8 `button hlmBtn` swatches | Feature-owned selection + Spartan Button | Spartan single-selection primitive wrapped by Relay presentation | Replace manual selected-state mechanics |
| Edit icon selection | 15 `button hlmBtn` emoji actions | Feature-owned selection + Spartan Button | Spartan single-selection primitive wrapped by Relay presentation | Replace manual selected-state mechanics |
| Save edits | `AppButtonPrimaryComponent` | Relay Button | Relay Button | Keep; add mutation state/disabled semantics |
| Cancel edits | native `button` + `hlmBtn` | Feature state + Spartan Button | Relay/Helm Button | Keep |
| Available-card list | native layout containers | Feature composition | Relay card/list composition | Keep content ownership; review list semantics |
| Add card | repeated native `button hlmBtn` | Feature mutation + Spartan Button | Relay/Helm Button | Keep native semantics; add contextual naming/pending guard |
| Cards-in-deck list | native layout containers | Feature composition | Relay card/list composition | Keep content ownership; review list semantics |
| SRS level label | `AppChipComponent` containing `L{level}` | Relay interactive Chip used as static content | static `AppPillComponent`/badge | Replace interactive semantics and localise accessible meaning |
| Remove card | repeated icon `button hlmBtn` | Feature mutation + Spartan Button | Relay/Helm Button | Keep native semantics; add pending guard |
| Deck colour accent bars | inline style from persisted deck colour | User-owned content metadata | Feature content + constrained visual presentation | Preserve as user-authored deck identity, not product token |
| Overlay behaviour | none | N/A | N/A | Do not introduce an overlay solely for migration |
| Analytics | none | N/A | N/A | Do not add incidentally |

Every currently rendered interactive element, including controls inside the shared error fallback, is classified above.

## Spartan ownership

### Ordinary command buttons

Browse, Back, Edit, Cancel, Add, Remove and Delete are ordinary command controls. They already use native `<button>` elements and `hlmBtn`, so generic press and focus semantics are already Spartan-backed.

Follow-up #6203 should not replace them with feature-specific click abstractions. It should instead:

- retain real button semantics;
- use Relay wrappers where an existing product button API expresses the required variant cleanly;
- use `type="button"` consistently;
- expose pending/disabled state for network mutations;
- keep product actions in `FlashcardDeckComponent`/services;
- avoid custom key handlers.

### Colour and icon pickers are selection controls

The colour and icon grids are not independent command buttons. Each grid is a mutually exclusive choice set with one current value.

The current implementation expresses selection only through feature signals and visual `scale-125`/border classes. That means each option behaves as a command button rather than as a member of a single-selection group.

Follow-up #6203 should use the repository's approved Spartan single-selection pattern, likely a radio-group based composition if its visual API can preserve swatches and emoji choices. The interaction primitive should own:

- one selected value;
- Arrow-key movement where the chosen primitive defines it;
- selected-state semantics;
- disabled behavior;
- focus management.

Relay should own the swatch/icon visual treatment and product-level API.

Do not build another roving-tabindex implementation in this feature.

### Deck cards are the largest interaction ownership problem

Each deck is currently an `<article>` made interactive through `appA11yClickable`. That directive adds `role="button"`, `tabindex="0"` and Enter/Space key emulation to a non-interactive element.

This creates several problems:

1. feature code depends on synthetic button behavior for a primary navigation-like action;
2. a Delete button is nested inside the synthetic clickable container;
3. focus and activation behavior depend on event bubbling and `stopPropagation()`;
4. the interaction is harder to reason about than a native control;
5. the entire article becomes one activation target even though it contains another interactive target.

The migration should remove `appA11yClickable` from deck cards. Prefer a native button/link or an approved Relay interactive item/card composition that separates the open action from the Delete action without nested interactive semantics.

Because opening a deck currently changes local component state rather than URL state, a native button is the simplest semantic fit unless product routing changes separately.

### No new Brain primitive for cards

Cards are presentation. Do not introduce Spartan Brain merely because a deck is visually card-shaped. If the whole deck card remains activatable, use a native control or an existing Relay interactive-item pattern around Relay card presentation.

## Relay ownership

### Existing Relay primitives to retain

The component already uses approved shared primitives for:

- primary buttons;
- text inputs;
- cards;
- SRS error presentation.

Those should remain the stable product-facing API where their current capabilities fit.

### Static chip misuse

`AppChipComponent` always renders a native Spartan button and exposes `aria-pressed`, even when callers do not subscribe to its click output. The deck screen uses it for three static metadata cases:

- deck card count in the list;
- deck card count in the detail summary;
- flashcard SRS level.

These values are not interactive selections. Rendering them as buttons introduces unnecessary focus stops and button semantics.

The visual migration should replace these usages with a static Relay primitive such as `AppPillComponent` or an equivalent badge. Do not modify `AppChipComponent` globally as part of this feature ticket unless a shared primitive issue explicitly owns that change.

### Empty/loading/error states

The list currently has bespoke loading and empty markup, while failure handling relies on `SrsErrorBoundaryComponent`.

The migration should keep these states distinct:

- unresolved initial list load;
- successful empty deck list;
- failure surfaced by the SRS error boundary;
- selected deck with zero cards;
- no available cards left to add.

Where `AppEmptyStateComponent` or another approved Relay status primitive fits, use it rather than keeping deck-specific empty-state markup.

## Product behaviour that must remain feature-owned

Spartan/Relay migration must not change:

- list versus detail state;
- create/edit form state;
- name/description trimming;
- selected colour and icon values;
- deck sanitisation boundary;
- local deck count updates after add/remove;
- available-card filtering;
- `VocabularyStore.pendingReviewCards` hand-off;
- `/review` navigation;
- authenticated `/decks` service contracts;
- retrying `loadDecks()` through the SRS error boundary.

These are product/data responsibilities, not generic interaction mechanics.

## Mutation and concurrency audit

Only creation has an explicit `isCreating` signal. The following mutations have no equivalent pending guard:

- update deck;
- delete deck;
- add card;
- remove card.

Repeated activation can therefore issue overlapping requests. Local card-count state is updated after each successful add/remove request, so duplicate successful requests or retries could also make the local count diverge from server truth if backend idempotency is not guaranteed.

Follow-up interaction work should add bounded feature-owned pending state and use it to drive native/Spartan disabled and busy semantics. It should not move API concurrency logic into Relay or Spartan.

Recommended granularity:

- one create pending state, already present;
- one edit-save pending state for the selected deck;
- per-deck delete pending state;
- per-card add/remove pending state or a bounded membership-mutation set.

The UI should remain retryable after failure.

## Error handling audit

All caught errors are reported through `reportDeckError()`, which wraps the error with SRS context and forwards it to Angular `ErrorHandler`.

Several catch blocks then intentionally leave local UI state unchanged. This means users may receive the shared/global error treatment but local controls have no explicit inline failure state.

`loadDeckDetail()` is notable because it has no local `try/catch`; a rejection propagates from `openDeckDetail()` after the component has already switched to detail view. Follow-up work should verify the shared error boundary actually captures this asynchronous path and does not leave an apparently empty detail view.

Do not solve this by swallowing errors or fabricating empty-success data.

## Accessibility audit

### Existing strengths

- most command actions are real buttons;
- `AppInputComponent` provides visible translated labels associated with native inputs;
- Delete/Remove icon actions have contextual translated accessible names;
- initial loading uses a status role and busy state;
- empty collection states are visually distinct;
- the component uses logical `ms-*`, `ps-*` and `pe-*` utilities in many directional locations;
- the SRS error fallback exposes an alert plus Retry/Report actions.

### Deck-card semantics

Replace synthetic clickable articles as described above. A deck open action needs one clear native interactive target with an accessible name including the deck name.

The Delete action must remain a separate sibling/contained action without relying on click propagation hacks for correctness.

### Delete button visibility

The deck Delete button starts at `opacity-0` and becomes visible only on `group-hover`.

That is insufficient for:

- keyboard users who focus the Delete button without hover;
- touch-only users with no hover state;
- high-zoom users whose pointer and focus behavior may differ.

Follow-up work must keep the destructive action discoverable through focus/touch, for example with `focus-visible`/`focus-within` treatment or an always-available mobile action. Do not make destructive actions permanently invisible to non-pointer users.

### Touch targets

The colour swatches are `h-6 w-6` (24px), icon options are `h-7 w-7` (28px), and several Add/Remove/Delete actions use compact custom padding. These are below the repository's documented 44px baseline for important standalone touch controls.

The migration should separate visual mark size from hit-area size. A 24px colour circle may remain visually appropriate while its interactive target is at least the approved touch size.

### Selection semantics

Colour/icon selection currently relies mainly on border/scale styling. Selected values need programmatic selection state supplied by the chosen single-selection primitive. Do not communicate selection only through scale or colour.

### Static metadata focus stops

Replace static `AppChipComponent` usages as described above so card counts and SRS levels do not appear in the tab order as inert buttons.

### Focus after state transitions

Current list/detail and create/edit transitions do not explicitly manage focus.

Follow-up #6205 should verify:

- opening a deck gives users an understandable reading/focus position without unexpectedly trapping focus;
- returning to list does not strand focus on removed detail controls;
- opening/closing create and edit forms leaves deterministic focus order;
- deleting a deck or removing a card does not strand focus on a removed element;
- errors/retries remain discoverable.

Do not force focus merely because content changed. Prefer preserving the triggering control when it remains in the DOM and moving focus only when the active element disappears or the new state requires it.

## Keyboard audit

There are no component-specific keyboard handlers except those injected indirectly by `A11yClickableDirective`.

That is a good baseline for native controls, but the synthetic article handling should be removed. After migration:

- command buttons should use native Enter/Space activation;
- colour/icon single-selection should use the selected Spartan primitive's keyboard model;
- input fields should retain native text-editing and IME behavior;
- no feature-level roving tabindex should be introduced.

## Internationalisation audit

Most visible UI copy uses translation keys through `TranslatePipe`.

Risks to address:

1. icon choice accessible names are currently the raw emoji character rather than translated product descriptions;
2. SRS level is rendered as raw `L{number}` without an expanded accessible description;
3. arrow text in the Back control contains a literal left arrow before translated copy;
4. deck names, descriptions, flashcard tokens and translations are user/server content and must be allowed to wrap for CJK, Arabic, Devanagari and long Latin strings;
5. hard-coded deck colour values are persisted user choices, so screen-reader names should describe the choice in meaningful language rather than exposing only raw hex where possible.

Translation strings must not acquire styling classes. Layout remains component-owned.

## RTL audit

The component already uses several logical utilities such as `ms-2`, `ps-*`, `pe-*` and logical `start-0`.

Remaining risks:

- the literal `←` in the Back button encodes a physical direction;
- any follow-up card action layout must avoid reintroducing `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*` or `pr-*`;
- colour/icon selection order should remain product-defined rather than being blindly reversed by layout direction;
- user/server text should inherit the correct locale/content direction rather than forcing LTR.

Use a direction-aware icon or omit the directional glyph if translated text is sufficient.

## Theme and token audit

Most product styling already uses Relay semantic roles such as:

- `surface-*`;
- `text-primary`, `text-secondary`, `text-muted`;
- `primary` and `on-fill`;
- `success` and `danger`;
- `rounded-card` and `rounded-app`.

This is a strong starting point for #6204.

### Deck colours are content, not global product tokens

`DECK_COLOURS` contains eight literal hex values and each deck persists a selected colour. Those colours identify user-owned deck metadata rather than generic product roles.

Do not mechanically replace them with the current user's dynamic `primary` token because that would collapse distinct persisted deck identities and change product behaviour. Instead:

- treat the palette as constrained feature content;
- document/verify contrast requirements for any text or borders derived from it;
- avoid using those values for unrelated product actions or status semantics;
- keep primary/secondary UI actions on Relay semantic tokens.

### Remaining visual risks

- colour/icon selectors use `rounded-full` and manual scale transforms;
- direct `bg-primary` command-button styling should be reconciled with Relay Button variants rather than feature classes where possible;
- `text-success` is used for translations, which is content styling rather than success feedback and should be reviewed in #6204;
- destructive hover styling needs matching focus/touch treatment;
- several surfaces compose raw Relay classes instead of shared primitives.

## Responsive and zoom audit

The surface is mobile-first in several areas:

- deck list is 1 column, then 2 at `sm`, then 3 at `lg`;
- card membership lists are 1 column, then 2 at `sm`;
- main content is capped at `max-w-4xl`;
- colour/icon options use wrapping flex layouts.

### 390px mobile baseline

Verify:

- create/edit action rows wrap rather than squeeze translated text;
- colour/icon choice hit areas meet touch requirements;
- deck card Delete remains discoverable without hover;
- flashcard word/translation pairs wrap without pushing Add/Remove off-screen;
- the detail header's Back/Edit/Start Review controls wrap safely;
- fixed-height `max-h-64` available-card scrolling remains usable with keyboard and touch.

### 200% and 400% zoom

Current `truncate` classes on deck names, descriptions and flashcard tokens can hide important content at high zoom. Follow-up #6205 should determine where wrapping is required instead of truncation.

Required actions must remain reachable without horizontal clipping. Internal vertical scrolling should not create a keyboard trap.

### Tablet and desktop

Wider layouts may retain the current two/three-column density, but should not create a separate interaction implementation. Relay responsive presentation should change layout only; feature and Spartan ownership should remain identical across widths.

## Security and content-safety audit

Deck names and descriptions are sanitised with `HtmlSanitisationService.sanitiseText()` both when loaded and before create/update requests.

The migration must not weaken this boundary or introduce `innerHTML` rendering for deck or flashcard content.

Additional considerations:

- `DeckService` sends bearer authentication for every endpoint;
- no credential/token data is rendered by the component;
- deck IDs and flashcard IDs remain service parameters, not DOM trust boundaries;
- persisted deck colour should stay constrained by the backend/service contract rather than accepting arbitrary style fragments;
- user-authored deck content should be rendered through normal text interpolation.

Do not log bearer tokens, full API responses or user-authored study content as part of migration diagnostics.

## Analytics and observability

There are no explicit analytics hooks in `FlashcardDeckComponent`.

Operational errors are reported through:

```text
reportDeckError()
  -> Angular ErrorHandler
```

with an `SrsDeckError` name plus feature operation metadata. The shared SRS boundary also supports manual crash reporting.

Do not add analytics events incidentally during a UI migration. If product analytics are later required for deck open/create/review actions, they need a separate contract covering privacy and event naming.

## Migration risks

### High priority

1. **Synthetic deck-card interaction**: replacing `appA11yClickable` must preserve open behavior without nested-interactive conflicts.
2. **Selection semantics**: colour/icon choice needs a true single-selection model rather than many independent command buttons.
3. **Static Chip misuse**: current card-count and SRS-level chips create unnecessary button semantics/focus stops.
4. **Touch-target size**: 24px/28px selection controls are too small as standalone hit targets.
5. **Mutation races**: update/delete/add/remove lack pending guards.
6. **Delete discoverability**: hover-only opacity hides a destructive action from keyboard/touch users.

### Medium priority

7. **Async detail failure**: `loadDeckDetail()` can reject after entering detail state without local recovery state.
8. **Focus after destructive/state transitions**: deleted controls or closed forms can strand focus.
9. **Hard truncation**: important user/study content can disappear under long translations and high zoom.
10. **Direction-specific Back glyph**: literal left arrow needs RTL-aware treatment.
11. **Raw emoji/hex accessible names**: selector options need more meaningful accessible descriptions.
12. **Direct primary/danger utility composition**: should converge on approved Relay variants where available.

### Product/data risks to preserve rather than silently fix

13. deck detail is local state rather than URL state;
14. review receives cards through `VocabularyStore.pendingReviewCards` rather than a deck route parameter;
15. deck card counts are optimistically adjusted locally after successful membership mutations;
16. deck colour is persisted feature metadata, not the user's global primary accent.

## Primitive prerequisites

No new global primitive is required before implementation if the repository's existing single-selection/radio-group capability is sufficient for colour and icon choice.

Follow-up #6203 should verify these existing capabilities before writing new code:

- Relay Button / `AppButtonPrimaryComponent` for product actions;
- Spartan Button for one-off command actions;
- Spartan radio-group/single-selection capability for swatches and icons;
- Relay `AppInputComponent` for text fields;
- Relay `AppCardComponent` for presentation;
- static `AppPillComponent` or equivalent for non-interactive counts/levels;
- Relay empty/loading/error presentation where applicable.

If a visual swatch radio wrapper is useful across multiple surfaces, add the smallest reusable Relay composition rather than a deck-specific Brain abstraction.

## Recommended implementation sequence

### #6203 - interaction conversion

1. remove `A11yClickableDirective` from deck cards and use a native/approved interactive target;
2. migrate colour and icon grids to an approved single-selection primitive;
3. replace static interactive chips with non-interactive pills/badges;
4. add mutation pending guards and connect disabled/busy states;
5. make Delete discoverable for keyboard and touch;
6. preserve all deck/SRS service and navigation behavior.

### #6204 - Relay tokens and responsive parity

1. reconcile direct button classes with Relay variants;
2. review translation text colour and destructive state roles;
3. verify constrained deck colours against light/dark surfaces;
4. verify 390px, tablet and desktop layouts;
5. update mapped design preview if visual contracts change.

### #6205 - accessibility, RTL, zoom and input methods

1. verify focus after list/detail/form/deletion transitions;
2. verify touch targets and visible focus;
3. add meaningful selection and static metadata semantics;
4. make Back direction RTL-safe;
5. verify long translations, CJK/Arabic/Devanagari content and IME input;
6. verify 200%/400% zoom and reduced motion.

### #6206 - regression and design-preview lock

1. cover list loading/empty/populated states;
2. cover create success/failure/duplicate suppression;
3. cover deck open/delete and focus behavior;
4. cover edit success/failure;
5. cover colour/icon keyboard selection;
6. cover card add/remove and duplicate suppression;
7. cover review hand-off to `/review`;
8. cover error-boundary retry behavior;
9. capture light/dark, 390px and wider representative states;
10. update audit/completion status.

## Required regression matrix

The final migrated surface should have automated coverage for at least:

1. initial loading is distinct from empty success;
2. empty deck list is announced without fake controls;
3. deck cards expose one native open action;
4. Delete remains separately operable with keyboard and touch;
5. opening a deck loads its flashcard membership;
6. returning to list preserves deterministic focus/reading order;
7. create form opens/closes and resets draft values as expected;
8. blank names cannot be submitted;
9. create pending state prevents duplicate submission;
10. colour selection exposes one selected value and keyboard semantics;
11. icon selection exposes one selected value and keyboard semantics;
12. successful create prepends the sanitised deck;
13. failed create remains retryable;
14. edit form seeds current values;
15. save edits preserves service contract and sanitisation;
16. failed edit remains retryable;
17. delete success removes the correct deck;
18. delete failure leaves the deck visible;
19. available cards exclude cards already in the selected deck;
20. add-card success updates membership and count exactly once;
21. remove-card success updates membership and count without going below zero;
22. repeated add/remove activation is suppressed while pending;
23. static card counts and SRS levels are not keyboard focus stops;
24. review hand-off writes the selected cards and navigates exactly to `/review`;
25. SRS retry calls `loadDecks()`;
26. RTL contains no new physical-direction utilities and Back treatment is correct;
27. 390px mobile retains all actions and 44px touch targets;
28. long translated/user content remains available at 200%/400% zoom;
29. light/dark themes preserve contrast with every allowed deck colour;
30. reduced-motion users are not required to consume scale/transition animation to understand state.

## Design-preview requirements

#6202 itself is documentation-only and intentionally does not change the visual contract, so no preview file should change in this audit PR.

When #6203-#6205 change interaction or presentation, #6206 should represent at minimum:

- light mobile list with multiple decks;
- dark wider list;
- empty list;
- create form open;
- detail view with cards;
- detail view with no cards;
- edit form open;
- a pending mutation state;
- an error/retry state;
- selected colour/icon state with visible focus;
- RTL/long-translation state where supported by the visual contract harness.

## Acceptance mapping for #6202

- **No interactive element omitted**: the complete inventory includes header/list/detail/create/edit/card-membership controls plus Retry/Report controls supplied by the shared error boundary.
- **Existing behaviour recorded**: list/detail state, create/edit/delete/membership mutations, vocabulary-store hand-off, sanitisation, error reporting and `/review` navigation are documented.
- **Analytics hooks and route contracts recorded**: there are no explicit analytics hooks; `/decks` and `/review` contracts are documented.
- **Migration risks identified**: synthetic card interaction, selection semantics, static Chip misuse, touch targets, mutation races, focus, RTL and high-zoom risks are enumerated.
- **Primitive prerequisites identified**: existing Relay Button/Input/Card/Pill and Spartan single-selection capabilities should be reused before any new primitive is proposed.

## Rollback

This audit changes documentation only. Rollback is a normal revert of this file. No API, schema, route, persisted state, design-preview or runtime behavior changes are included.
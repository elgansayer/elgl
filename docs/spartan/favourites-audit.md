# Favourites Spartan / Relay audit

Issue: #6197 (`Spartan UI 0411`)

Target: `frontend/src/app/components/favourites`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining `FavouritesComponent` under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit inventories every control, derived state, asynchronous transition, nested action, API side effect and presentation primitive currently reachable from the `/favourites` surface. It is behaviour-neutral. Follow-up implementation must preserve the existing favourites contract while moving reusable interaction and visual ownership into the approved Spartan and Relay layers.

The component is already partly converged. Page and item surfaces use `AppCardComponent`, command buttons use Spartan Helm Button, and the primary colours are mostly semantic Relay tokens. The largest ownership gaps are the hand-managed five-way filter selector, static item-type badges rendered through an interactive chip component, feature-owned audio playback state, incomplete destructive/error handling, and duplicated favourites API ownership between `ChatService` and `FavouriteService`.

No dialog, popover, menu, drag interaction, route navigation action or analytics hook is owned directly by `FavouritesComponent` today. Correction rows can, however, expose nested translation and flashcard actions through `VisualDiffComponent`, so those controls are part of the effective interaction surface and are included below.

## Discovery summary

The reviewed implementation consists of:

- `frontend/src/app/components/favourites/favourites.component.ts`, which owns loading, filter state, deletion, audio playback and payload narrowing;
- `frontend/src/app/components/favourites/favourites.component.html`, which renders the heading, five filters, loading/empty states, favourite cards, delete/audio controls and nested correction actions;
- `frontend/src/app/components/favourites/favourites.component.scss`, which contains a legacy hard-coded purple `.app-chip-active` rule that is not referenced by the current template;
- `frontend/src/app/components/favourites/favourites.component.spec.ts`, which covers loading, filter derivation, empty-state keys and successful deletion but not the rendered interaction/accessibility contract;
- `frontend/src/app/services/chat.service.ts`, which currently supplies `FavouriteRecord` plus favourites requests used by this component;
- `frontend/src/app/services/favourite.service.ts`, a second dedicated client exposing the same `GET`, `POST` and `DELETE /chat/favourites` API family;
- `frontend/src/app/components/visual-diff/visual-diff.component.ts`, whose `showActions=true` mode adds translation and flashcard actions inside correction favourites;
- `frontend/src/app/components/primitives/chip/chip.component.ts`, which always renders a Spartan-backed button and exposes `aria-pressed`;
- `frontend/src/app/components/primitives/pill/pill.component.ts`, which is the existing static Relay status/tag primitive;
- `frontend/src/app/components/primitives/card/card.component.ts`, which owns Relay surface/radius/elevation styling;
- the lazy `/favourites` route in `frontend/src/app/routes/social.routes.ts`;
- authenticated NestJS `GET /chat/favourites` and `DELETE /chat/favourites/:id` endpoints in `backend/src/chat/chat.controller.ts`.

The backend `ChatController` is protected at controller scope by `SupabaseAuthGuard`. The favourites component does not need to reproduce authorization in the browser, but migration must not bypass the authenticated backend contract.

## Current product contract

### Initial load

The component starts with:

- `favourites = []`;
- `isLoading = true`;
- `activeTab = 'all'`;
- no active audio item.

The constructor immediately calls `loadFavourites()`. That method requests the authenticated favourites collection, replaces the signal on success, logs failures to the console, and always clears loading state.

There is currently no distinct failure signal. A failed initial request therefore becomes visually indistinguishable from a successfully loaded empty collection after loading completes.

### Filter model

The surface exposes five local-only filters:

1. All
2. Messages
3. Corrections
4. Audio
5. Moments

Changing a filter does not issue a network request. `filteredFavourites` derives the visible list from the already loaded collection.

The current classification rules are:

- Messages: `item_type === 'message'` and payload `message_type === 'text'`;
- Corrections: payload `message_type === 'correction'` or `item_type === 'correction'`;
- Audio: `item_type === 'audio'` or payload `message_type === 'voice'`;
- Moments: `item_type === 'moment'`;
- All: every loaded favourite.

Preserve these rules unless a separate API/data-contract change deliberately normalises favourite types.

### Delete

Each item exposes a delete button. Activating it calls `DELETE /chat/favourites/:id`. Only after a successful request is the item removed from local state.

Failure is logged to the console and otherwise silent. There is no pending state, duplicate-click guard, confirmation, retry affordance or user-facing failure message.

### Audio playback

Audio/voice favourites with `media_url` expose one play/pause action.

Activating a stopped item:

1. stops any currently tracked audio;
2. constructs `new Audio(media_url)`;
3. installs an `onended` callback;
4. calls `play()`;
5. stores the element and marks the favourite as playing.

Activating the same item again pauses it, resets `currentTime` to zero and clears active state. Activating a different audio item stops the previous item first.

A rejected `play()` clears active state but produces no visible error. There is no component-destroy cleanup, so follow-up work must verify that playback cannot continue after the surface is destroyed or navigated away from.

### Correction actions

Correction favourites use `VisualDiffComponent` with `showActions=true`. This means the effective favourites surface also exposes:

- Translate explanation, when an explanation exists;
- Create flashcard.

Those actions are already Spartan Helm buttons inside `VisualDiffComponent`. Translation uses the shared chat translation path and translation cache. Flashcard creation uses `FlashcardService`. Their loading/error/toast behaviour belongs to `VisualDiffComponent`; `FavouritesComponent` must not duplicate those state machines.

### Route contract

The route is `/favourites`, lazy-loaded from `social.routes.ts`.

The component itself currently has no Router dependency and no profile, message, moment or chat navigation action. A migration should not make whole cards clickable or invent destinations merely to create an interactive visual treatment.

## Existing control and state inventory

| Element / state | Current implementation | Current owner | Target owner | Required action |
| --- | --- | --- | --- | --- |
| Page heading | Native `h1` in `AppCardComponent` | Feature + Relay card | Native semantics + Relay | Preserve |
| Subtitle | Native paragraph | Feature | Relay typography | Preserve |
| Filter container | `nav` plus horizontal flex row | Feature | Feature layout + Spartan selection semantics | Keep scroll/reflow, improve group semantics |
| All filter | `AppChipComponent` button | Feature signal + Relay chip/Helm Button | Spartan Tabs or approved single-selection primitive | Migrate selection semantics |
| Messages filter | `AppChipComponent` button | Feature signal + Relay chip/Helm Button | Spartan Tabs or approved single-selection primitive | Migrate selection semantics |
| Corrections filter | `AppChipComponent` button | Feature signal + Relay chip/Helm Button | Spartan Tabs or approved single-selection primitive | Migrate selection semantics |
| Audio filter | `AppChipComponent` button | Feature signal + Relay chip/Helm Button | Spartan Tabs or approved single-selection primitive | Migrate selection semantics |
| Moments filter | `AppChipComponent` button | Feature signal + Relay chip/Helm Button | Spartan Tabs or approved single-selection primitive | Migrate selection semantics |
| All count | Text inside All filter | Feature-derived state | Feature content | Preserve, ensure label remains understandable |
| Initial loading | Plain text empty-state block | Feature request state | Relay loading/status presentation | Add explicit accessible status |
| Loaded empty | Plain translated empty-state block | Feature-derived state | Relay empty-state primitive/presentation | Converge if visual contract matches |
| Per-tab empty | Computed translation key | Feature-derived state | Feature + Relay empty presentation | Preserve distinctions |
| Favourite item surface | `AppCardComponent` | Relay | Relay card | Preserve non-interactive ownership |
| Sender avatar | Native `img` plus remote placeholder fallback | Feature | Relay avatar/native image | Replace generic fallback with approved avatar treatment |
| Sender name | Native text | Feature data | Native content | Preserve |
| Created date | Angular `DatePipe` | Feature presentation | Locale-aware presentation | Verify locale ownership |
| Delete action | `<button hlmBtn>` with feature classes | Helm Button + feature mutation | Helm/Relay destructive action | Add pending/error/confirmation contract |
| Voice type badge | `AppChipComponent` | Interactive Relay chip | Static `AppPillComponent` | Replace false button semantics |
| Moment type badge | `AppChipComponent` | Interactive Relay chip | Static `AppPillComponent` | Replace false button semantics |
| Correction type badge | `AppChipComponent` | Interactive Relay chip | Static `AppPillComponent` | Replace false button semantics |
| Text content | Native paragraph on Relay surface tokens | Feature presentation | Native/Relay | Preserve |
| Correction diff | `VisualDiffComponent` | Shared feature component | Existing shared component | Preserve |
| Translate explanation | Nested Helm icon button | `VisualDiffComponent` | `VisualDiffComponent` | Do not duplicate in favourites |
| Create flashcard | Nested Helm outline button | `VisualDiffComponent` | `VisualDiffComponent` | Do not duplicate in favourites |
| Audio play/pause | `<button hlmBtn>` plus feature audio state | Helm Button + feature media state | Helm Button + dedicated/shared media state | Preserve one-active-item contract, harden lifecycle |
| Audio transcript | Native text | Feature data | Native content | Preserve |
| Moment content | Native paragraph | Feature data | Native/Relay | Preserve |
| Legacy correction fallback | Native spans | Feature presentation | Native/Relay or shared diff | Converge without changing data semantics |
| Notes callout | Hand-composed warning surface | Feature presentation | Relay callout/content surface | Use semantic role appropriate to a note, not warning by default |
| Load failure | Console error only | Feature | Feature state + Relay error/retry presentation | Add explicit failure state |
| Delete failure | Console error only | Feature | Feature state + Relay feedback | Add recoverable feedback |
| Audio failure | Silent state reset | Feature | Feature state + Relay feedback | Add non-technical failure feedback |

## Spartan ownership decisions

### Five-way filter selection

The five filters are one mutually exclusive view selection, not five unrelated commands. `AppChipComponent` improves on raw clickable elements by using a native Spartan-backed button and `aria-pressed`, but the page still owns the selection model manually and places command buttons inside a `nav` element without tab semantics.

The preferred target is the repository-owned Spartan Tabs boundary when available. A current open developer-dashboard migration is establishing Helm Tabs ownership, so follow-up #6198 should reuse that adapter once merged rather than importing Spartan Brain directly from feature code.

If Tabs is unavailable on the implementation base, verify the installed Spartan version and use the approved single-selection primitive already owned by the repository. Do not hand-build roving tabindex, arrow-key logic or `role=tab` behaviour in `FavouritesComponent`.

Required behaviour:

- exactly one filter is selected;
- the selected value is programmatically exposed;
- keyboard behaviour is primitive-owned;
- activation changes only local filtering and performs no network request;
- focus remains stable when the list content changes;
- the control remains horizontally usable at 390px and high zoom without trapping page scroll;
- selection is not communicated by colour alone.

The filter labels include emoji. Emoji are decorative and must not become the only accessible identification of a filter.

### Static type badges

The item-type badges currently use `AppChipComponent`. That component always renders a button, so Voice Note, Moment and Correction badges are currently focusable controls even though no click handler or action exists.

These are status labels and should use the static Relay `AppPillComponent` or an equivalent non-interactive text treatment. Do not add click behaviour solely to justify the existing chip semantics.

### Delete action

Delete is a real command and should remain a native Spartan Helm button or the approved Relay destructive wrapper. Interaction mechanics, focus-visible styling, disabled state and touch sizing belong to Helm/Relay. The feature owns the mutation and row state.

Because removing a favourite changes saved user data, follow-up work should define an explicit product decision for confirmation or immediately reversible feedback. At minimum it must prevent duplicate requests, expose pending state and surface failure without removing the local row prematurely.

Do not use a clickable icon-only span or feature-owned keyboard handlers.

### Audio play/pause

Play/pause is a command button. Keep native button semantics and use an approved Helm variant/size rather than recreating hover/focus/disabled behaviour with utility classes.

The actual media lifecycle remains feature/application responsibility. Spartan does not own `HTMLAudioElement`, media permissions or playback promises.

A reusable media controller may be appropriate if other voice-note surfaces already own the same one-at-a-time playback contract. Do not introduce a new shared abstraction unless it replaces real duplicated behaviour.

### Cards

Favourite rows are presentation containers, not actions. Keep them non-interactive. Do not use `AppCardComponent`'s `interactive` variant without a real destination or activation contract.

`AppCardComponent` currently gives every non-interactive card `role="region"`. Repeating many unnamed regions can create screen-reader landmark noise. The implementation stage should verify whether these repeated rows should remain card components with that host role, or whether the Relay card primitive should be adjusted separately. Do not solve a shared primitive semantic issue with per-row fake labels.

### Nested correction actions

`VisualDiffComponent` owns its own Spartan actions, translation state, flashcard mutation and feedback. Favourites should pass correction data and avoid reaching into those actions.

Any accessibility or stale-response defects inside Visual Diff should be fixed at that shared component boundary so all consumers benefit.

## Data and side-effect map

| Trigger | Request / side effect | Mutation | Navigation | Analytics | Contract |
| --- | --- | --- | --- | --- | --- |
| Component construction | `GET /chat/favourites` | Local list replacement | None | None | Load authenticated saved items |
| Select filter | None | `activeTab` only | None | None | Client-only view filtering |
| Delete favourite | `DELETE /chat/favourites/:id` | Remove local item after success | None | None | Persist removal then update UI |
| Play audio | Browser `Audio.play()` against `media_url` | Active playback state | None | None | One tracked item at a time |
| Pause audio | Browser `pause()` and `currentTime=0` | Clear active playback state | None | None | Stop and reset current item |
| Translate correction explanation | Shared translation request from `VisualDiffComponent` | Nested translated explanation state/cache | None | None | Shared correction action |
| Create correction flashcard | Shared `FlashcardService` request | Server flashcard collection | None | None | Shared correction action |

There is no direct component analytics call in the reviewed code.

## Service ownership and API boundary

There are currently two frontend owners for the same favourites endpoints:

- favourites methods on the broad `ChatService`;
- dedicated `FavouriteService` methods.

`FavouritesComponent` injects `ChatService`, while `FavouriteService` independently exposes add/remove/get calls.

Follow-up #6198 should choose one canonical client boundary and remove feature-level ambiguity. Prefer the dedicated service if it is the repository's intended bounded ownership, but first verify other consumers and authentication/header behaviour so convergence does not silently change the API contract.

Do not keep both clients indefinitely with divergent DTOs, error handling or auth behaviour.

The backend endpoints are protected by `SupabaseAuthGuard` at `ChatController` scope and scope reads/deletes to the authenticated user through `ChatService`. The UI migration must not move favourites reads directly to Supabase or trust a client-provided user ID.

## Async, concurrency and lifecycle audit

### Initial load failure

`loadFavourites()` catches the request and only logs it. After `finally`, `isLoading=false` and the empty list renders an ordinary empty message.

Target state model:

- initial loading;
- loaded with items;
- loaded empty;
- failed to load with retry;
- retry pending.

Failure copy must be translated and non-technical. Do not render raw backend exception text.

### Delete concurrency

There is no per-item pending set. Multiple rapid activations can send duplicate DELETE requests. The row remains interactive until the first request resolves.

Target behaviour:

- one in-flight delete per favourite ID;
- affected action disabled/busy while pending;
- unrelated rows remain usable;
- row removed only after authoritative success;
- failure preserves the row and exposes retryable feedback.

If confirmation is adopted, confirmation state must not permit duplicate mutation dispatch.

### Audio lifecycle

The component owns one `HTMLAudioElement`, but it does not implement destroy cleanup. Follow-up should stop playback when the component is destroyed and clear callbacks/references so navigation cannot leave orphaned playback.

The UI also marks an item as playing immediately after initiating `play()`. A rejected promise later clears it. Prefer state that reflects successful playback, while retaining quick feedback and avoiding a stale paused/playing label.

When switching items, stopping the prior audio before starting the new item is correct and should be preserved.

### Nested async actions

Translation and flashcard creation are nested inside `VisualDiffComponent`. Their pending/error states must remain isolated from delete/audio state for the favourite row. One nested action must not disable the entire collection.

## Accessibility audit

### Filter semantics and naming

The five filter controls have translated accessible labels, but the surrounding `nav` has no label and the controls represent content views rather than destinations.

A Tabs/single-selection primitive should expose the group relationship and selected item correctly. Avoid manually layering both `aria-pressed` and tab roles.

### Static badges are false controls

Voice Note, Moment and Correction badges are `AppChipComponent` instances and therefore buttons. Screen-reader and keyboard users can focus them but activation does nothing. This is a concrete semantic defect. Replace with `AppPillComponent` or static text.

### Delete naming

Every delete button currently uses the same translated `favourites.delete` accessible name. In a repeated list, users need enough context to understand which saved item will be removed.

Use a translated contextual label based on safe visible context such as sender/type, while avoiding sensitive text content in accessible names where it would create excessive verbosity.

### Audio naming defect

The audio button's `aria-label` is always bound to `favourites.audioPause`, even when the visible action is Play. This creates a mismatch between visible and accessible names in the stopped state.

The accessible label must follow the actual command state and include row context when necessary to distinguish repeated play controls.

### Avatar alternative text

The current hard-coded `alt="avatar"` is untranslated and gives no useful identity. If the adjacent visible sender name already conveys identity, the avatar should generally be decorative (`alt=""`). If the image is intended to carry identity, use translated/contextual alternative text. Do not leave generic English `avatar` on every row.

The `https://via.placeholder.com/80` fallback also introduces a third-party request for missing avatars. Prefer the repository's local/Relay avatar fallback rather than sending a browser request to an unrelated host.

### Loading and failure announcements

Initial loading should expose concise `status` semantics. Failed loading/deletion/audio playback should be announced through a bounded status/alert pattern where appropriate, without turning the whole list into a live region.

### Touch and keyboard

Delete and audio controls must satisfy the repository touch target contract at the 390px baseline. The current custom padding should not be assumed to satisfy it merely because `hlmBtn` is present.

Keyboard focus order should remain:

1. filter selection controls;
2. row actions in document order;
3. nested Visual Diff actions when present.

Do not make non-interactive card content focusable.

### Heading and region structure

The page contains one `h1`. Favourite rows currently contain sender names as paragraphs, not headings. Preserve a coherent page hierarchy if row headings are added later.

Repeated unnamed `role=region` hosts from `AppCardComponent` should be assessed at the shared primitive boundary as noted above.

## Internationalisation, RTL and locale audit

All primary Favourites UI copy is translated through `TranslatePipe`, which is correct. Remaining issues include:

- hard-coded `alt="avatar"`;
- emoji that must remain decorative rather than substitute for translated names;
- Angular `DatePipe` must be verified against the app's active locale rather than assumed to follow `I18nService` automatically;
- `VisualDiffComponent` fallback toast strings contain English fallback text, owned by that shared component;
- the static `AppPillComponent` replacement must not hard-code English type names.

The template mostly uses logical spacing utilities (`ms`, `me`, `ps`, `pe`) and direction-neutral flex alignment. Preserve that contract. The horizontal filter scroller must work in RTL without custom `left`/`right` positioning or transform assumptions.

Long translations and user-provided notes/transcripts must wrap without forcing horizontal page overflow at 390px or high zoom.

## Theme and token audit

Most current styling uses Relay roles such as:

- `surface-100`, `surface-200`, `surface-300`;
- `text-primary`, `text-muted`, `text-secondary`;
- `primary`, `secondary`, `warning`, `danger`, `success`;
- `rounded-card`.

The component SCSS still contains an unused hard-coded purple gradient and rgba shadow in `.app-chip-active`. Remove this stale rule during the styling stage rather than preserving dead off-token CSS.

Additional risks:

- Delete adds custom hover colour on top of Helm Button instead of relying on an approved destructive/ghost role.
- Audio play/pause hand-builds rounded/surface/hover styling around Helm Button.
- Notes are always styled as warning content even though user notes are informational, not necessarily warnings.
- Type badges hand-compose colour-opacity classes through an interactive chip instead of using the static Relay pill colour contract.

Follow-up styling must preserve light/dark themes and per-user primary accent behaviour. Do not introduce literal colour values.

## Responsive and high-zoom contract

The current page relies on `.app-screen`, cards with horizontal margins, and a horizontally scrollable filter row.

Required implementation contract:

- 390px remains the mobile baseline;
- filter controls may scroll horizontally without causing document-level overflow;
- users can still vertically scroll the page when touching the filter strip;
- sender identity, date and delete action do not collapse into unreadable widths;
- long notes, transcripts and corrections wrap with `min-width: 0` where required;
- audio controls and transcript content wrap or stack rather than overflow;
- 200% and 400% zoom preserve all required actions;
- no fixed height may clip translated copy or nested Visual Diff actions.

Tablet/desktop changes should be intentional composition improvements, not assumptions that larger widths hide mobile overflow defects.

## Security and privacy review

The favourites surface displays user-owned saved content and sender metadata. Migration must preserve these boundaries:

- all collection/delete requests remain authenticated;
- never accept a user ID from the UI as ownership proof;
- never log favourite payload text, correction content, notes, media URLs or auth credentials merely to diagnose UI failures;
- render message, moment, correction and note content through Angular text interpolation, not trusted HTML;
- treat `media_url` as untrusted remote data and preserve the repository's media URL policy;
- do not expose private item content in analytics events or overly verbose accessible labels;
- do not reintroduce third-party placeholder image requests for missing identity data.

The current component uses Angular interpolation for user content, which should be preserved.

## Migration risks and prerequisites

### 1. Tabs ownership depends on the repository-owned adapter

A current developer-dashboard migration is introducing the owned Helm Tabs boundary. #6198 should reuse it once available or verify the installed Spartan capability before choosing an alternative. Do not import Brain directly into feature code.

### 2. Interactive chip and static pill semantics must be separated

`AppChipComponent` is a button. It is suitable only for genuinely interactive chip behaviour. Status/type labels need `AppPillComponent` or static content.

### 3. Duplicate service ownership can drift

`ChatService` and `FavouriteService` both expose favourites operations. Converge on one canonical API client before adding more favourites behaviour.

### 4. Destructive-state design is incomplete

Delete has no pending, confirmation, failure or retry UI. Define this explicitly rather than hiding failures behind console logging.

### 5. Audio is browser lifecycle state

Destroy cleanup and failed playback need tests. Avoid creating server-render-time browser globals. `new Audio()` must remain user-action/browser-only.

### 6. Visual Diff is a nested interaction surface

Do not accidentally remove translation/flashcard actions while migrating correction rendering. Regression tests must include a correction row with `showActions=true`.

### 7. Shared card semantics may need separate primitive work

Repeated non-interactive `AppCardComponent` instances currently become unnamed `region` elements. If that is changed, do it at the shared primitive with cross-consumer review, not as a Favourites-only semantic hack.

## Recommended implementation sequence

1. Confirm the canonical favourites API client and remove duplicate ownership where safe.
2. Move five-way filtering to the approved Spartan Tabs/single-selection boundary without changing filter results.
3. Replace static type `AppChipComponent` instances with `AppPillComponent`.
4. Normalize delete and audio buttons to documented Helm/Relay variants and touch sizes.
5. Add explicit load/delete/audio failure and pending state, including retry behaviour.
6. Add component-destroy audio cleanup and successful-play state handling.
7. Replace generic/third-party avatar fallback with the approved local/Relay identity treatment.
8. Remove stale `.app-chip-active` hard-coded CSS and converge notes/type badges on semantic Relay roles.
9. Verify RTL, locale-aware dates, long translations, 390px layout and 200%/400% zoom.
10. Lock the result with focused tests and mapped design-preview states in the follow-up regression ticket.

## Regression coverage required by follow-up tickets

At minimum cover:

1. initial loading state;
2. successful collection load;
3. loaded empty state;
4. failed load plus retry;
5. all five filter selections and exact classification rules;
6. selected filter semantics and keyboard operation;
7. static type labels are not focusable controls;
8. All count updates after deletion;
9. successful delete removes only the target row;
10. failed delete preserves the row;
11. duplicate delete activation is suppressed while pending;
12. contextual delete accessible name;
13. audio play starts the requested item;
14. audio pause resets the active item;
15. starting a second audio item stops the first;
16. rejected playback exposes failure and does not leave stale playing state;
17. destroy stops active audio;
18. Play/Pause accessible name matches visible state;
19. correction row retains Translate Explanation action;
20. correction row retains Create Flashcard action;
21. message, correction, audio and moment presentation all remain text-safe;
22. avatar fallback causes no third-party placeholder request;
23. translated labels and long user content wrap at 390px;
24. 200% and 400% zoom preserve actions and no document overflow;
25. RTL keeps logical spacing and usable horizontal filter navigation;
26. light and dark themes preserve semantic contrast;
27. user primary accent continues to flow through primary token roles;
28. no new raw colour literals or feature-owned keyboard handlers are introduced.

## Design-preview requirements

This audit does not change the runtime or visual contract, so no design-preview modification is required here.

The final regression/design-preview stage should represent at least:

- light theme, 390px, populated All view;
- dark theme, wider viewport, populated Corrections view;
- light theme, 390px, Audio view with one playing item;
- loaded empty state for a non-All filter;
- load failure with Retry;
- delete pending/failure state if that product state is introduced;
- long translated copy/high-zoom-safe wrapping;
- RTL filter ordering/alignment.

Correction preview coverage must retain the nested Visual Diff actions if the production surface renders them.

## Completion checklist for #6197

- Every direct filter/button and nested correction action is inventoried.
- Loading, empty, failure, deletion and audio states are recorded.
- `/favourites`, authenticated API and side-effect contracts are documented.
- Spartan ownership is defined for filters and command buttons.
- Relay ownership is defined for cards, static pills, feedback and visual roles.
- Accessibility defects are identified, including false-control badges and the Play/Pause label mismatch.
- RTL, locale, light/dark, accent, mobile and high-zoom requirements are recorded.
- Duplicate API-service ownership and shared-card semantic risk are identified.
- Migration sequencing and regression requirements are explicit.
- No runtime or visual behaviour is changed by this audit.
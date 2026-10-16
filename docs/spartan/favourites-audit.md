# Favourites Spartan / Relay audit

Issue: #6197 (`Spartan UI 0411`)

Target: `frontend/src/app/components/favourites`

Program dependency: #5462 (`Spartan UI 0001`)

## Scope

This document records the current implementation baseline for `FavouritesComponent` and the remaining work needed to converge the surface on the repository-owned Spartan Helm and Relay boundaries.

The audit is behaviour-neutral. It documents existing product behaviour, identifies remaining ownership and accessibility gaps, and defines the contract for follow-up implementation. It does not change runtime behaviour, APIs, persistence, routes, analytics or visual output.

This audit was refreshed against the current PR base after several Favourites hardening changes had already landed. Earlier observations that load errors were silent, delete requests were unguarded, audio was not cleaned up on destroy, audio state was set before `play()` resolved, static badges were interactive chips, and the Play button always exposed a Pause label are no longer true. The current state below is authoritative.

## Reviewed implementation

The effective surface currently spans:

- `frontend/src/app/components/favourites/favourites.component.ts`;
- `frontend/src/app/components/favourites/favourites.component.html`;
- `frontend/src/app/components/favourites/favourites.component.scss`;
- `frontend/src/app/components/favourites/favourites.component.spec.ts`;
- `frontend/src/app/services/chat.service.ts`;
- `frontend/src/app/services/favourite.service.ts`;
- `frontend/src/app/components/visual-diff/visual-diff.component.ts`;
- `frontend/src/app/components/primitives/chip/chip.component.ts`;
- `frontend/src/app/components/primitives/pill/pill.component.ts`;
- `frontend/src/app/components/primitives/card/card.component.ts`;
- the lazy `/favourites` route in `frontend/src/app/routes/social.routes.ts`;
- authenticated favourites endpoints in `backend/src/chat/chat.controller.ts`.

`FavouritesComponent` still uses `ChatService` for its favourites requests. A dedicated `FavouriteService` also exists for the same API family, so service ownership remains duplicated.

## Current product contract

### Initial load and retry

The component starts with an empty favourites signal, `isLoading=true`, no load error, the `all` filter selected, no pending deletes and no active audio item.

Construction starts `loadFavourites()`. The loader uses a generation counter so an older request cannot overwrite state from a newer retry or from component destruction. It clears the prior load error, requests the collection, replaces local state on the latest successful response and exposes a translated retryable error state on failure.

The template now distinguishes:

- loading, announced with `role="status"` and `aria-live="polite"`;
- loaded with items;
- loaded empty;
- failed load, announced with `role="alert"` and a retry button.

The error copy is generic and translated rather than exposing backend exception text.

### Filter model

The surface exposes five local-only filters:

1. All
2. Messages
3. Corrections
4. Audio
5. Moments

Changing a filter performs no network request. `filteredFavourites` derives the visible list from the already loaded collection.

Current classification rules are:

- Messages: `item_type === 'message'` and payload `message_type === 'text'`;
- Corrections: payload `message_type === 'correction'` or `item_type === 'correction'`;
- Audio: `item_type === 'audio'` or payload `message_type === 'voice'`;
- Moments: `item_type === 'moment'`;
- All: every loaded favourite.

These rules are part of the current product contract and should not change incidentally during UI migration.

### Delete

Delete remains an authenticated `DELETE /chat/favourites/:id` mutation through `ChatService`.

The current component already prevents duplicate requests per favourite ID with `pendingDeleteIds`. The affected button is disabled and exposes `aria-busy` while the request is pending. The row is removed only after a successful response. If the deleted row owns current audio playback, playback is stopped before local removal.

Delete failure keeps the row and displays a translated generic alert. The remaining weakness is that `deleteError` is one page-level boolean rather than row-scoped state, so the UI cannot identify which mutation failed and a later delete clears the same global error.

There is still no explicit confirmation or undo contract. Follow-up work should make a deliberate product decision rather than add either mechanism accidentally.

### Audio playback

Audio and voice favourites with `media_url` expose one Helm button.

Starting playback:

1. stops any tracked previous audio;
2. creates `new Audio(media_url)`;
3. installs an `onended` callback guarded against stale elements;
4. invokes `play()`;
5. marks the favourite as playing only after the play promise resolves successfully.

Pausing the active row calls the shared `stopAudio()` path, resets `currentTime`, clears the element reference and clears active state. Starting a second row stops the first. `ngOnDestroy()` invalidates outstanding loads and stops current audio, so navigation no longer leaves tracked playback running.

The visible text and accessible label both switch correctly between translated Play and Pause strings.

A rejected `play()` clears local media state, but still has no user-facing playback failure message. That remains a follow-up feedback gap.

### Correction actions

Correction favourites render `VisualDiffComponent` with `showActions=true`. The effective Favourites surface therefore includes nested translation and flashcard actions.

Those actions are already owned by `VisualDiffComponent`. Favourites should continue passing correction data without duplicating its translation, flashcard, pending or feedback state machines.

### Route contract

The route remains `/favourites`, lazy-loaded from the social routes.

The component itself has no Router dependency and does not currently provide sender-profile, chat, message or moment navigation. Favourite cards must therefore remain non-interactive unless a separate product change introduces a real destination.

## Current control and state inventory

| Element / state | Current implementation | Current owner | Target / remaining action |
| --- | --- | --- | --- |
| Page heading | Native `h1` inside `AppCardComponent` | Native semantics + Relay card | Preserve |
| Subtitle | Native paragraph | Feature + Relay typography | Preserve |
| Filter group | labelled `nav` containing five `AppChipComponent` buttons | Feature selection + Relay/Helm chip | Prefer repository-owned Spartan single-selection/Tabs semantics |
| All count | Text inside All chip | Feature-derived state | Preserve |
| Loading | translated status block | Feature state + native ARIA | Preserve |
| Load failure | translated alert plus Helm retry button | Feature state + Helm | Preserve and test retry races |
| Empty state | translated per-filter block | Feature presentation | Preserve or converge on Relay empty-state presentation if available |
| Favourite collection | `role="list"` with `role="listitem"` card hosts | Feature semantics + Relay card | Preserve while reviewing shared card semantics separately |
| Sender avatar | native image with empty alt and third-party placeholder URL fallback | Feature | Keep decorative alt; replace third-party placeholder with approved local/Relay avatar fallback |
| Sender name | native text | Feature data | Preserve |
| Created date | Angular `DatePipe` | Feature presentation | Verify active application locale ownership |
| Delete action | Helm ghost icon-touch button | Helm + feature mutation state | Keep pending guard; improve repeated-control naming and row-scoped failure feedback |
| Voice type badge | static styled `span` | Feature presentation | Converge on `AppPillComponent` rather than hand-composed pill classes |
| Moment type badge | static styled `span` | Feature presentation | Converge on `AppPillComponent` |
| Correction type badge | static styled `span` | Feature presentation | Converge on `AppPillComponent` |
| Text content | native text on Relay tokens | Feature | Preserve |
| Correction diff | `VisualDiffComponent` | Shared component | Preserve |
| Translate explanation | nested Helm action | `VisualDiffComponent` | Do not duplicate |
| Create flashcard | nested Helm action | `VisualDiffComponent` | Do not duplicate |
| Audio play/pause | Helm secondary touch button | Helm + feature media state | Preserve state machine; add bounded playback-failure feedback |
| Audio transcript | native text | Feature | Preserve |
| Moment content | native text | Feature | Preserve |
| Notes callout | hand-composed warning-token surface | Feature presentation | Use an informational Relay treatment unless product semantics are genuinely warning-level |
| Delete pending | per-ID set | Feature state | Preserve |
| Delete failure | page-level boolean alert | Feature state | Prefer row-scoped or operation-scoped recoverable feedback |
| Audio failure | silent state reset | Feature state | Add translated non-technical feedback |

## Spartan ownership decisions

### Five-way filter selection

The five filters form one mutually exclusive view selector, not five unrelated commands. `AppChipComponent` provides native button semantics and selected state, but the feature still owns the five-way selection model and wraps it in navigation semantics.

The preferred follow-up is the repository-owned Spartan Tabs or approved single-selection boundary, if that boundary is available on the implementation base. Feature code should not import Spartan Brain directly or hand-build roving tabindex and arrow-key behaviour.

Required behaviour:

- exactly one filter is selected;
- selected state is exposed programmatically;
- primitive-owned keyboard behaviour is used when a tab/single-selection primitive owns the interaction;
- activation changes only local filtering;
- focus remains stable when result content changes;
- the group remains usable at 390px and high zoom;
- horizontal filter overflow does not trap vertical page scrolling;
- selection is not communicated by colour alone;
- emoji remain decorative supplements to translated labels.

### Static type badges

The current base has already removed the previous false-control bug: Voice Note, Moment and Correction labels are now static spans rather than `AppChipComponent` buttons.

The remaining issue is visual ownership. The spans hand-compose pill radius, fill and text classes. Where the established Relay `AppPillComponent` matches the required semantics and appearance, use it so feature code does not recreate the status/tag primitive.

### Delete action

Delete is a real command and correctly remains a native Helm button. Focus behaviour, disabled state and touch sizing should continue to come from Helm/Relay.

The feature should retain ownership of the mutation and pending set. Remaining work is primarily feedback and naming:

- preserve one in-flight request per favourite ID;
- keep unrelated rows usable;
- preserve the row on failure;
- move from one ambiguous page-level delete error toward operation-scoped feedback;
- give repeated delete controls enough accessible context to identify the target without reading sensitive favourite content into the accessible name;
- decide confirmation versus undo as an explicit product requirement.

### Audio play/pause

Play/pause is correctly a Helm button and the current state transition reflects successful `play()` resolution. Keep the one-active-item and destroy-cleanup contracts.

Spartan does not own `HTMLAudioElement` lifecycle. If a shared media controller already exists elsewhere, convergence may be useful, but a new abstraction should only be introduced if it replaces real duplication.

### Cards

Favourite rows are presentation containers, not actions. Do not use an interactive card variant without a real navigation/action contract.

Any semantic concern created by shared `AppCardComponent` host roles belongs at the shared primitive boundary and must be reviewed across consumers rather than patched with fake per-row labels in Favourites.

## Side-effect map

| Trigger | Request / side effect | Local mutation | Navigation | Analytics |
| --- | --- | --- | --- | --- |
| Component construction / Retry | `GET /chat/favourites` | collection, loading, load error | None | None |
| Select filter | None | `activeTab` | None | None |
| Delete favourite | `DELETE /chat/favourites/:id` | pending set, list or delete error | None | None |
| Play audio | browser `Audio.play()` against `media_url` | active media state | None | None |
| Pause/stop audio | browser `pause()` plus reset | clear active media state | None | None |
| Destroy | browser audio stop plus load-generation invalidation | clear/guard state | None | None |
| Translate correction explanation | shared Visual Diff request | nested shared state/cache | None | None |
| Create correction flashcard | shared `FlashcardService` request | server flashcard collection | None | None |

No direct Favourites analytics call is present in the reviewed implementation.

## Service ownership and API boundary

The frontend still has two owners for the favourites API family:

- favourites methods on the broad `ChatService`;
- a dedicated `FavouriteService`.

`FavouritesComponent` currently injects `ChatService`. Follow-up should determine the canonical boundary by inspecting all consumers and auth/header behaviour, then converge rather than allowing DTOs and error behaviour to drift.

The backend contract remains authenticated and user-scoped. UI migration must not move favourites reads directly to the data store, trust a client-provided user ID as ownership proof or weaken the existing authenticated controller/service path.

## Async, concurrency and lifecycle audit

### Load races

The generation counter is a meaningful hardening already present in the current base. A late response from a superseded retry does not overwrite current state, and destruction invalidates the active generation.

Regression tests should explicitly cover an older request resolving after a newer request, not only the successful initial load.

### Delete concurrency

Per-ID duplicate suppression is already implemented and unit-tested. Remaining test coverage should include:

- failure keeps the row;
- pending state clears after failure;
- unrelated rows can still delete while one row is pending;
- deleting the currently playing row stops playback;
- a successful later delete clears or supersedes prior operation feedback appropriately.

### Audio lifecycle

Destroy cleanup, successful-play state and one-at-a-time playback are implemented. Remaining cases worth locking down are:

- rejected `play()` does not leave stale active state;
- `onended` from an old audio object cannot clear state for a newer object;
- switching rows pauses and resets the previous object;
- deleting the playing row stops playback;
- playback failure feedback, once introduced, remains bounded to the relevant operation.

## Accessibility audit

### Filter group

The current `nav` now has an accessible label, which is an improvement over an unnamed group. The conceptual mismatch remains: these controls select local content views rather than navigate to destinations.

If migrated to Tabs/single-selection, rely on that primitive's semantics rather than layering custom tab roles over `aria-pressed` buttons.

### Static badges

The previous keyboard/screen-reader defect from no-op interactive chips is resolved in the current base. Static type labels are no longer focusable buttons.

### Delete naming

Every row still uses the same translated `favourites.delete` accessible label. In a repeated list, the user needs enough context to distinguish targets. Add safe sender/type context while avoiding full private message text in accessible names.

### Audio naming

The current base correctly switches both visible and accessible labels between translated Play and Pause. Preserve this behaviour.

### Avatar alternative text

Avatar images now use `alt=""`, which is appropriate when the adjacent visible sender name already conveys identity. Preserve the decorative treatment.

The fallback still points at `https://via.placeholder.com/80`, which creates an unnecessary third-party request when identity media is absent. Replace it with the approved local or Relay avatar fallback.

### Status and alerts

Loading is announced as status. Load and delete failures use alert semantics. Avoid turning the entire collection into a live region.

If audio failure feedback is added, use a bounded translated status/alert pattern and do not expose raw browser/backend errors.

### Touch, keyboard and focus

Helm `touch` and `icon-touch` sizes are already used for retry, audio and delete actions. Preserve the repository touch-target contract.

Expected focus order remains:

1. filter selection controls;
2. row actions in document order;
3. nested Visual Diff actions when present.

Do not make non-interactive cards or static badges focusable.

## Internationalisation, RTL and locale audit

Primary Favourites copy is translated through `TranslatePipe`. Remaining review points are:

- emoji are decorative and must not replace translated control names;
- Angular `DatePipe` should be verified against the app's active locale rather than assumed to follow `I18nService` automatically;
- type-pill migration must continue using translation keys;
- error feedback must stay generic, translated and non-technical;
- long notes, transcripts and translated labels must wrap without document-level horizontal overflow.

The template predominantly uses logical spacing utilities. Preserve that contract and avoid left/right positioning assumptions in RTL.

## Theme and token audit

Most runtime styling already uses semantic Relay roles such as surface, text, primary, secondary, warning, danger and `rounded-card` tokens.

The component SCSS still contains an unused `.app-chip-active` rule with a literal purple gradient, literal white and a literal rgba shadow. It is not referenced by the current template and should be removed in follow-up styling work rather than preserved as dead off-token CSS.

Other remaining ownership concerns:

- static type badges hand-compose semantic fills instead of using the Relay pill primitive;
- delete adds feature hover colour on top of Helm Button;
- notes always use warning treatment even though user notes are informational by default.

Follow-up must preserve light/dark themes and per-user primary accent behaviour. Do not introduce new raw colour literals.

## Responsive and high-zoom contract

Required behaviour remains:

- 390px is the mobile baseline;
- filter controls may scroll horizontally without creating page-level overflow;
- the filter strip must not trap vertical touch scrolling;
- sender identity, date and delete action remain usable at narrow widths;
- long notes, transcripts and correction content wrap using `min-width: 0` where needed;
- audio controls and transcript content wrap or stack instead of overflowing;
- 200% and 400% zoom preserve access to all required controls;
- no fixed height clips translated or nested Visual Diff content.

## Security and privacy review

Preserve these boundaries:

- collection and delete requests remain authenticated;
- client-provided user identity is never treated as ownership proof;
- favourite payload text, correction content, notes, media URLs and credentials are not logged for ordinary UI failures;
- user content continues to render through Angular text interpolation rather than trusted HTML;
- `media_url` remains untrusted remote data and follows repository media policy;
- private favourite content is not copied into analytics or overly verbose accessible labels;
- missing avatars should not trigger unrelated third-party placeholder requests.

## Remaining migration risks

### 1. Filter primitive ownership

The filter selector still uses feature-managed `AppChipComponent` state. Confirm the approved repository-owned Tabs/single-selection boundary on the implementation base before changing semantics.

### 2. Duplicate API service ownership

`ChatService` and `FavouriteService` still overlap. Converge carefully after checking all consumers and auth behaviour.

### 3. Delete feedback is global

Duplicate request prevention is solved, but the error model is one page-level boolean. Row or operation scoped feedback would be clearer and less ambiguous.

### 4. Audio failure is still silent

Lifecycle correctness is substantially improved, but rejected playback has no user-facing explanation.

### 5. Static badges are semantically fixed but not primitive-owned

The no-op button defect is resolved. The remaining concern is Relay visual ownership through `AppPillComponent` or equivalent.

### 6. Avatar fallback still makes a third-party request

Use the repository's approved local/Relay identity fallback.

### 7. Dead hard-coded SCSS remains

Remove `.app-chip-active` rather than carrying literal colours forward.

## Recommended follow-up sequence

1. Confirm the canonical favourites API client and converge duplicate service ownership safely.
2. Move the five-way filter selector to the approved Spartan Tabs/single-selection boundary without changing classification rules.
3. Move static item-type labels to `AppPillComponent` or the approved equivalent.
4. Replace the remote avatar placeholder with the approved local/Relay fallback.
5. Make delete failure feedback operation-scoped and improve repeated delete accessible names.
6. Add translated audio-playback failure feedback while preserving the current lifecycle state machine.
7. Remove stale `.app-chip-active` literal-colour SCSS and review the warning treatment used for notes.
8. Verify active-locale dates, RTL, long translations, 390px layout and 200%/400% zoom.
9. Lock the final contract with focused component and regression-preview coverage.

## Regression coverage required by follow-up tickets

At minimum cover:

1. initial loading status;
2. successful load;
3. loaded empty state;
4. failed load plus retry;
5. stale earlier load cannot overwrite a later retry;
6. all five filter selections and exact classification rules;
7. selected filter semantics and keyboard operation after primitive migration;
8. static type labels remain non-interactive;
9. All count updates after deletion;
10. successful delete removes only the target row;
11. failed delete preserves the row and clears pending state;
12. duplicate delete activation is suppressed per ID;
13. unrelated rows remain actionable during another row's delete;
14. delete accessible name distinguishes repeated controls safely;
15. audio play marks state only after successful playback;
16. audio pause resets active playback;
17. starting a second audio item stops the first;
18. rejected playback does not leave stale playing state;
19. stale `onended` callbacks cannot clear newer playback;
20. destroy stops active audio;
21. deleting the playing favourite stops its audio;
22. Play/Pause accessible name matches visible action state;
23. correction rows retain Translate Explanation;
24. correction rows retain Create Flashcard;
25. avatar fallback causes no unrelated third-party request;
26. translated labels and long user content wrap at 390px;
27. 200% and 400% zoom preserve actions without document overflow;
28. RTL keeps logical spacing and usable filter navigation;
29. light and dark themes preserve semantic contrast;
30. user primary accent continues to flow through semantic token roles;
31. no new raw colour literals or feature-owned keyboard handlers are introduced.

## Design-preview requirements

This audit itself changes documentation only, so no design-preview change is required in this PR.

The implementation/regression stage should represent at least:

- light theme, 390px, populated All view;
- dark theme, wider viewport, populated Corrections view;
- light theme, 390px, Audio view with one playing item;
- loaded empty state for a non-All filter;
- load failure with Retry;
- delete pending and delete failure states;
- audio playback failure if new feedback is introduced;
- long translated copy/high-zoom-safe wrapping;
- RTL filter ordering/alignment.

Correction preview coverage must retain nested Visual Diff actions when the production surface renders them.

## Completion checklist for #6197

- Direct filter, delete, retry and audio controls are inventoried.
- Nested correction translation and flashcard actions are included in the effective surface.
- Loading, empty, failure, deletion and audio states reflect the current implementation rather than an older snapshot.
- `/favourites`, authenticated API and side-effect contracts are documented.
- Already-landed hardening is explicitly distinguished from remaining work.
- Spartan ownership is defined for filters and command buttons.
- Relay ownership is defined for cards, pills, feedback and visual roles.
- Remaining accessibility issues are identified without repeating defects already fixed on the base.
- RTL, locale, light/dark, accent, mobile and high-zoom requirements are recorded.
- Duplicate API-service ownership, global delete feedback, remote avatar fallback and stale literal-colour SCSS are identified.
- Migration sequencing and regression requirements are explicit.
- No runtime or visual behaviour is changed by this audit.

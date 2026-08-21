# Visual diff Spartan/Relay audit

Tracks issue #6640 for `frontend/src/app/components/visual-diff/`.

## Scope and current ownership

`VisualDiffComponent` renders a token-level comparison between an original sentence and a corrected sentence. It can also show an explanation and, when `showActions` is enabled, lets the user translate that explanation or create a flashcard from the correction.

The component currently combines three kinds of ownership:

- feature-owned comparison and action state, including `Intl.Segmenter` tokenisation, translation state, cache lookup, and flashcard payload construction;
- Spartan Helm button mechanics through `HlmButtonImports` for both interactive actions;
- Relay-style semantic utility tokens for diff colours, translated explanation presentation, and typography.

There is no modal, menu, popover, combobox, route navigation, or selection state machine in this surface. No direct Spartan Brain primitive is required by the current product behaviour. The two existing actions are native buttons already backed by Spartan Helm. The migration work should therefore focus on product-facing Relay button ownership, action-state accessibility, and presentation consistency rather than adding a new Brain abstraction.

The component does not inject `Router` and contains no navigation contract. It does not call an analytics service and has no analytics hook. Its external side effects are limited to translation through `ChatService`, translation caching through `TranslationCacheService`, flashcard creation through `FlashcardService`, and user feedback through the shared toast helper.

## Inputs and integration contract

The public component inputs are:

| Input | Required | Current meaning |
| --- | --- | --- |
| `original` | yes | Original user text used as the removed-side source and as the flashcard `translation` value. |
| `corrected` | yes | Corrected text used as the added-side source and as the flashcard `word_token` value. |
| `explanation` | no | Optional correction explanation. When present it can be translated and is sent as flashcard `original_context`. |
| `showActions` | no, defaults to `false` | Gates both explanation translation and flashcard creation controls. |

Known current consumers include correction/chat surfaces such as `ChatMessageComponent`, where correction messages pass the correction payload into `VisualDiffComponent` and enable actions. The correction modal also embeds the component as a preview without moving correction submission behaviour into it.

The Spartan migration must preserve these input names and meanings. Changing the flashcard field mapping, diff algorithm, correction payload format, or caller routing is outside this UI ownership ticket.

## Control, content, and state inventory

| Surface | Current implementation | Behaviour/state | Target ownership | Migration action |
| --- | --- | --- | --- | --- |
| Diff text container | Presentation `<div>` with wrapping and semantic text token | Always renders the computed segments | Relay presentation | Keep presentation-only. No Brain primitive is needed. |
| Unchanged segment | Plain `<span data-type="unchanged">` | Displays corrected token when source and corrected token match case-insensitively | Semantic/native text + Relay typography | Keep as text. Preserve `data-type` if tests or diagnostics depend on it. |
| Added segment | `<span data-type="added">` with `bg-success/15 text-success` | Marks corrected-side insertions | Semantic diff markup + Relay success role | Preserve success-token ownership. Consider semantic change annotation in the accessibility stage rather than inventing an interactive primitive. |
| Removed segment | `<span data-type="removed">` with danger colour and line-through | Marks source-side removals | Semantic diff markup + Relay danger role | Preserve danger-token ownership and strike-through. Improve non-colour semantics in the accessibility stage. |
| Explanation text | Conditional static `<span>` | Shown only when `explanation()` is truthy | Relay presentation | Keep static content. No Brain primitive is required. |
| Translate explanation action | Native `<button hlmBtn variant="ghost" size="icon-sm">` | Toggles an existing translation off, returns cached translation immediately, or requests a translation | Relay/Helm button | Keep native button semantics. Prefer an approved Relay icon-action wrapper if one exists by #6641; otherwise direct Helm is acceptable for this feature-specific icon action. Do not add Brain solely for a button. |
| Translate disabled state | `[disabled]="isTranslating()"` | Prevents pointer/keyboard activation during the awaited request | Feature state + Spartan button mechanics | Preserve native disabled mechanics. Add explicit busy/status semantics in the accessibility stage. |
| Translation hover reveal | `opacity-0 group-hover:opacity-100` | Hides the action visually until the explanation group is hovered | Relay presentation | Do not retain hover-only discoverability. Keyboard and touch users must be able to discover the action. |
| Translation icon | `lucideLanguages` through `NgIcon` | Visual affordance inside an icon-only button | Relay icon presentation | Keep decorative inside a correctly named button. Ensure the icon does not become the accessible name. |
| Translated explanation block | Conditional `<div>` using surface/text/border tokens | Appears after cached or remote translation resolves; disappears when the translate action is toggled again | Relay status/content presentation | Keep non-interactive. Add announcement semantics if product expectations require newly inserted text to be announced. |
| Create flashcard action | Native `<button hlmBtn variant="outline" size="sm">` | Calls `createFlashcard()` and shows a toast on resolution/error | Relay/Helm button | Prefer the existing product Relay button layer where its public API fits. Preserve the feature-owned payload and service call. |
| Plus glyph | Literal `➕` in the flashcard button text | Decorative lead-in to the translated action label | Relay icon/presentation | Treat as decorative or replace with the approved icon path so it is not redundantly announced as content. |
| Translation loading state | `isTranslating: signal(false)` | Set before remote translation and cleared in `finally` | Feature async state | Keep feature-owned. Spartan/Relay owns how the control exposes disabled/busy presentation. |
| Translated result state | `translatedExplanation: signal<string | null>(null)` | Stores the current rendered translation and also acts as the toggle state | Feature state | Preserve unless #6641 deliberately separates visibility from cached data with tests. |
| Diff segments | `computed<DiffSegment[]>` | Recomputes from `original` and `corrected` inputs | Feature-derived state | Keep feature-owned. This is product logic, not a UI primitive. |
| Toast feedback | `showToast(...)` | Reports translation failure, flashcard success, or flashcard failure | Shared Relay feedback | Preserve the shared feedback boundary. Do not add feature-specific toast mechanics. |

Every interactive element in the component is accounted for. There are exactly two user actions: translate/toggle explanation and create flashcard. There is no overlay or route-changing control.

## Diff algorithm contract

The current comparison algorithm is feature logic and should not be rewritten as incidental Spartan work.

1. `Intl.Segmenter(undefined, { granularity: 'word' })` tokenises both strings using the runtime default locale.
2. Tokens are compared case-insensitively with `toLowerCase()`.
3. Matching tokens are emitted as `unchanged`, using the corrected token text.
4. When the current original token does not appear in the next five corrected tokens, it is emitted as `removed`.
5. Otherwise the current corrected token is emitted as `added`.
6. Remaining original tokens are emitted as `removed` after the corrected sequence is exhausted.
7. Each emitted segment receives a monotonically increasing local index used by Angular tracking.

This is intentionally a lightweight visual diff rather than a general edit-distance engine. The migration must preserve its output unless a separate correctness change introduces a better algorithm with focused multilingual fixtures.

### Algorithm risks to keep outside the visual migration

- `Intl.Segmenter` receives `undefined` rather than the app locale, so behaviour follows the runtime locale instead of `I18nService.currentLang()`.
- Case folding uses `toLowerCase()` rather than locale-aware comparison.
- The five-token lookahead is a heuristic and can produce non-minimal diffs for longer rewrites.
- The current skipped unit suite means multilingual and punctuation behaviour is not actively protected in CI.

These are real correctness/testing concerns, but #6641 and #6642 should not silently change them while replacing interaction or visual ownership.

## Translation behaviour and side effects

`translateExplanation()` currently has this contract:

1. If there is no explanation, return without side effects.
2. If a translated explanation is currently rendered, clear it and return. The action therefore doubles as a show/hide toggle.
3. Read the active target language from `I18nService.currentLang()`.
4. Check `TranslationCacheService` using the explanation text and target language.
5. If cached data exists, render it without a network request.
6. Otherwise set `isTranslating` to true and call `ChatService.translateText(text, targetLang)`.
7. `ChatService` posts to the authenticated `/nlp/translate` endpoint with `{ text, target_language }`.
8. If `translated_text` is present, cache and render it.
9. On failure, log the error and show the translated `moments.translationError` toast, falling back to `Translation failed` only when the translation lookup is empty.
10. Always clear `isTranslating` in `finally`.

No analytics event is emitted by this flow.

### Translation migration risks

The current action state has several behaviours that the implementation and accessibility stages must make explicit:

- The button label remains the translate label even when activating it will hide an existing translation. If the product keeps toggle behaviour, the accessible name/state should describe the current action.
- The action is visually hidden with `opacity-0` until pointer hover. This is not a reliable touch or keyboard discovery model. `group-focus-within` alone would still require users to tab onto an initially invisible target, so the migration should provide a persistently discoverable or contextually visible control with a clear focus state.
- The disabled state does not expose `aria-busy` or an adjacent loading status.
- Newly inserted translated text has no live-region/status semantics.
- `translatedExplanation` is not automatically invalidated if a reused component receives a different `explanation` input while a translation is displayed.
- A locale change while translated text is displayed does not invalidate or re-key the rendered result.
- The template disables user activation while `isTranslating` is true, but the method itself has no re-entry guard and no request identity check. A stale response can therefore be applied if input state changes while a request is in flight.

Do not solve these by introducing a generic Spartan state machine. They are feature async-state rules. Spartan/Relay should own the button's accessible mechanics and presentation; feature code should own request identity, cache validity, and toggle semantics.

## Flashcard behaviour and side effects

`createFlashcard()` sends this existing payload to `FlashcardService.createFlashcard()`:

```ts
{
  word_token: corrected(),
  translation: original(),
  original_context: explanation() || undefined,
}
```

On a resolved promise, the component shows `correction.flashcardCreatedAlert`, falling back to `Flashcard created`. On rejection it logs and shows `error.general`, falling back to `Error`.

`FlashcardService.createFlashcard()` posts to the `/flashcards` API when reachable. If the request fails, the service creates and caches a local degraded flashcard for offline use and resolves rather than rejecting. The visual diff therefore treats a locally queued/degraded flashcard as a successful service result and shows the success toast. That is the current service contract and must not be reinterpreted by this migration.

### Flashcard migration risks

- There is no local pending signal for flashcard creation, so repeated clicks can start overlapping requests and produce duplicate cards or duplicate success feedback depending on backend/offline behaviour.
- The button has no disabled/busy state while creation is pending.
- There is no inline success/error state; feedback is entirely through the shared toast path.
- The literal plus emoji can be redundantly announced before the translated button label.
- The mapping of corrected text to `word_token` and original text to `translation` is existing product behaviour. A UI migration must not swap or reinterpret these fields.

A focused #6641 implementation may add a bounded in-flight guard while preserving the service contract if tests prove no duplicate action is intended. That is feature state, not generic button state.

## Spartan and Relay ownership

### No new Brain primitive is required

The surface contains no dialog, popover, menu, listbox, combobox, tabs, radio group, slider, or roving-selection behaviour. The two controls are native buttons. Direct Brain imports would add complexity without transferring any real accessible state machine.

### Button ownership

Both current controls already use Spartan Helm button behaviour. The repository architecture says feature code should prefer a Relay primitive when the reusable product control API fits.

For #6641:

- Evaluate the existing `AppButtonPrimaryComponent` and other Relay button wrappers for the visible Create Flashcard action.
- Do not force the icon-only Translate action through a wrapper that cannot correctly forward accessible naming, busy state, icon sizing, or focus behaviour. If no approved Relay icon button exists, keeping one direct Helm button is safer than creating an inaccessible wrapper usage.
- Do not create a new broad button abstraction solely for this component. If an icon-action capability gap is genuinely shared by multiple surfaces, add the smallest reusable Relay primitive with its own tests.
- Keep business actions in `VisualDiffComponent`; Relay/Spartan should not call translation or flashcard services.

### Presentation ownership

Diff spans, explanation copy, translated output, spacing, borders, radii, typography, and semantic success/danger treatment belong to Relay presentation. The current empty SCSS file contains no bespoke behaviour; almost all presentation is inline Tailwind utility composition.

## Accessibility findings and requirements

1. **Make diff changes understandable without colour.** Removed text has line-through, but added text currently differs from unchanged content primarily by colour/background. `data-type` attributes do not provide accessibility semantics. The accessibility stage should evaluate semantic `<ins>`/`<del>` markup or equivalent screen-reader labels while preserving visual styling.
2. **Do not announce every token noisily.** If semantic change labels are added, test full-sentence output with assistive technology so a correction remains understandable rather than becoming a repetitive sequence of "added" and "deleted" announcements.
3. **Fix hover-only action discovery.** The Translate control cannot rely on `group-hover` opacity. It must remain discoverable on keyboard, touch, high zoom, and pointerless devices.
4. **Keep visible focus.** Any Relay/Helm action must retain the repository focus-ring contract in light and dark themes.
5. **Expose translation busy state.** Native `disabled` is correct but does not tell users why the action changed. Add `aria-busy` and/or a nearby status when a remote request is active.
6. **Use state-appropriate translate naming.** When a translation is visible, the control currently performs a hide action while retaining a translate accessible name. Use a translated name that reflects the current operation or change the interaction to an explicit show-original/show-translation contract.
7. **Announce asynchronous results carefully.** Translation failure is already routed through toast feedback. Successful insertion may need a polite status/live region if it is not obvious to screen-reader users.
8. **Protect flashcard creation from repeated activation.** If duplicate creation is not intended, expose a real disabled/busy state during the request rather than relying on fast completion.
9. **Treat the plus glyph as decorative.** The translated visible text is already sufficient for the Create Flashcard control.
10. **Preserve native buttons.** Do not replace either action with clickable `div`/`span` elements or synthetic `role="button"` behaviour.
11. **Use explicit button types.** Both buttons currently omit `type="button"`. They are not inside a form in this component today, but explicit types prevent accidental submit behaviour when composed inside a form-like caller.
12. **Keep user text script-safe.** Original, corrected, and explanation content must remain in the system body font with broad glyph coverage.
13. **Support 200% and 400% zoom.** Explanation text, action controls, and translated output must wrap without overlap or horizontal clipping.
14. **Meet mobile touch targets.** `icon-sm` and `sm` sizing should be checked against the repository touch-target rule. A visually small action may need a larger hit area without making the icon itself oversized.

## RTL and multilingual requirements

The current component is mostly direction-neutral and already uses logical padding (`ps-*`/`pe-*`) for diff highlights. Preserve that.

- Do not introduce `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*`, or `pr-*` utilities during migration.
- User-provided original, corrected, and explanation text may contain mixed-direction content. Do not force LTR on the diff container.
- The row containing explanation plus the Translate action must remain readable in RTL and with long translated explanations.
- Product-authored labels and accessible names must use `TranslatePipe` or `I18nService`.
- The runtime tokeniser currently uses the host locale. Any move to app-locale tokenisation is a separate behaviour change and requires multilingual regression tests.
- Test CJK, Arabic, Cyrillic, Devanagari, combining marks, emoji, punctuation-only edits, and mixed-script sentences before changing the diff algorithm.

## Theme, token, and responsive findings

The component already uses semantic Relay roles for most visual colour decisions:

- `text-text-primary` and `text-text-secondary` for copy;
- `success` for inserted content;
- `danger` for removed content;
- `surface-200` and `surface-100` for translated explanation presentation.

No hardcoded hex/RGB product colour appears in the component. That is a strong starting point for #6642.

The theme stage should still audit these details:

- generic `rounded` is used on diff highlights and translated output rather than a documented Relay radius role;
- the translated explanation uses a bespoke inline surface composition instead of an existing Relay card/status primitive if one is appropriate;
- action spacing is fixed with `gap-2` and the action row has no explicit narrow-width wrapping contract;
- `text-xs` and `icon-sm` must remain legible/operable at the 390px baseline and high zoom;
- focus, success, and danger states need independent light/dark contrast verification;
- semantic `primary` usage introduced by a future Relay action must continue to follow the per-user accent contract and use `on-fill` for saturated fills.

#6642 owns broad token, responsive, and theme parity. #6641 should avoid unrelated visual restyling while it clarifies interaction ownership.

## Navigation, analytics, and persistence contracts

There is no direct route or navigation contract in `VisualDiffComponent`.

There is no direct analytics call or event emitted by this component.

The component does perform persistence-affecting side effects through services:

- translation results may be written to `TranslationCacheService`;
- `FlashcardService.createFlashcard()` may persist through the backend or cache an offline/degraded card locally;
- toast feedback is emitted for translation failure and flashcard completion/failure.

These boundaries must remain intact. A UI migration must not move navigation, analytics, cache ownership, or SRS persistence into a Relay primitive.

## Caller and reuse risks

`VisualDiffComponent` is embedded in multiple correction-oriented surfaces. That reuse makes input/state lifecycle especially important.

1. **Input reuse can leave stale translated text.** `translatedExplanation` is local state independent of the current `explanation` input. If a host reuses the component instance for a different correction, the old translation can remain unless the implementation explicitly resets it.
2. **Locale changes can leave a translation in the previous UI language.** Cache lookup is keyed by target language only when the action is invoked; rendered state is not derived from the current locale.
3. **In-flight translation can race input changes.** A response for an earlier explanation can be rendered after the input has changed.
4. **Actions are opt-in.** Callers that leave `showActions=false` must remain fully read-only. Migration must not add tab stops or action affordances to those instances.
5. **Caller visual context varies.** The component is used inside chat bubbles, correction surfaces, favourites, and Moments-related content. Avoid turning the root into a heavyweight card with its own fixed background unless every caller intentionally wants that contract.

## Migration risks and prerequisites

1. **Unnecessary Brain adoption.** There is no Brain interaction class to migrate. Adding one would violate the architecture rule against framework usage for its own sake.
2. **Relay wrapper mismatch.** Existing product button wrappers may not yet expose the attributes required for an icon-only translated/busy action. Do not lose accessible naming or native disabled semantics just to remove a direct Helm import.
3. **Hover regression on touch/keyboard.** Carrying `opacity-0 group-hover:opacity-100` into the new composition would preserve a known discoverability problem.
4. **Translation race/state drift.** Reworking the action without request identity or input invalidation can continue to display stale language/text.
5. **Duplicate flashcards.** Adding a more prominent action without an in-flight guard can make repeated creation easier.
6. **Diff semantic regression.** Replacing spans with a shared visual primitive must not change whitespace preservation, token order, line wrapping, or the current `data-type` hooks before tests are active.
7. **Algorithm scope creep.** Spartan migration is not an edit-distance rewrite. Keep tokenisation changes out unless separately specified.
8. **Toast contract drift.** Do not replace shared toast feedback with silent failure merely because a button primitive changes.
9. **Offline semantics drift.** A resolved degraded `FlashcardService` result is currently treated as success. UI work must not claim a network-only contract that the service does not have.
10. **Design-preview overreach.** This audit changes no visual contract. #6641/#6642/#6644 should update the mapped design preview only when their implementation changes interaction or appearance.

No prerequisite Spartan Brain capability is missing. The only possible shared primitive gap is a Relay icon-action/button wrapper that forwards accessible labels, busy state, native disabled semantics, and touch sizing. That gap should be confirmed across consumers before adding a new primitive.

## Follow-up sequencing

The numbered visual-diff stages should proceed in this order:

1. **#6641 - interaction ownership.** Preserve native buttons, converge onto Relay button wrappers where their API fits, remove hover-only discovery, make async action state explicit, and avoid duplicate action requests.
2. **#6642 - tokens/theme/responsive.** Reconcile radii/surface composition and verify 390px, tablet, desktop, light/dark, accent, and high-zoom behaviour without altering diff logic.
3. **#6643 - accessibility/RTL/input methods.** Add non-colour diff semantics, state-appropriate action names, status announcements, keyboard/touch coverage, RTL and multilingual validation.
4. **#6644 - regression/design-preview.** Lock the public input contract, async states, diff rendering, service boundaries, and representative design-preview states.

Keep each stage narrow enough to revert independently.

## Required regression coverage for implementation stages

The existing spec is entirely disabled with `describe.skip`. Before interaction or visual migration is considered complete, the suite should be re-enabled with deterministic service doubles and cover at least:

### Diff output

- equal source/corrected text yields unchanged segments;
- additions and removals are rendered in order;
- case-only differences preserve the current unchanged behaviour;
- punctuation-only edits preserve the current contract;
- monotonic stable segment indexes;
- representative Arabic and other non-Latin inputs;
- added/removed content exposes the chosen non-colour accessibility semantics.

### Translation action

- absent explanation produces no translation control/request;
- `showActions=false` produces no interactive controls;
- cached translation avoids the HTTP service;
- uncached translation uses the active target language and caches the result;
- request pending state disables/reports busy without losing focus;
- error feedback uses the shared toast path;
- toggle semantics have state-appropriate accessible naming;
- explanation/input changes do not render stale translations;
- locale changes do not leave stale translated content;
- stale in-flight responses are ignored if request identity changes.

### Flashcard action

- exact `word_token`, `translation`, and optional `original_context` mapping is preserved;
- a resolved service call emits the existing success feedback;
- a rejected service call emits the existing error feedback;
- repeated activation while pending does not create unintended duplicate requests;
- native button type, disabled/busy, focus, and touch semantics remain correct.

### Layout and themes

- long explanations and translated copy wrap at 390px;
- action layout remains reachable at 200% and 400% zoom;
- RTL uses logical spacing and does not reverse semantic diff order;
- light and dark contrast for success/danger/text/surface roles;
- per-user primary accent remains correct if a primary Relay action is introduced.

## Verification

This audit is documentation-only. It does not change runtime behaviour, interaction, API contracts, routes, or the mapped visual contract, so no component code, migration, or design-preview modification is required in this ticket.

The follow-up implementation stages should run the repository frontend gate from `frontend/`:

```bash
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

For a visual or interaction contract change that affects mapped design surfaces, also run the repository design-sync and visual coverage checks required by CI.

## Audit result

**Mapped and ready for staged migration.** The visual diff contains only two interactive controls and both already use native Spartan Helm buttons. No new Spartan Brain primitive is justified. The highest-value follow-up work is to move reusable button presentation into Relay where the existing API fits, remove hover-only Translate discovery, make translation/flashcard async state robust, re-enable the skipped regression suite, and improve non-colour diff semantics while preserving the existing service and caller contracts.
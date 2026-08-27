# Flashcard review Spartan/Relay audit

Issue: #6207 (`Spartan UI 0421`)

Target: `frontend/src/app/components/flashcard-review`

Status: implementation baseline for #6208-#6211.

## Purpose

This audit records the current `FlashcardReviewComponent` contract before the remaining Spartan UI and Relay migration stages. It inventories every state, control, interaction, side effect, and feature-owned visual utility, then assigns the appropriate ownership boundary so later conversion does not change SRS behavior accidentally.

The surface is a stateful learning workflow. It combines data loading, offline/degraded SRS behavior, a two-sided flashcard interaction, optional pronunciation playback, grading actions, session progress, completion state, haptics, focus movement, and shared SRS error handling. The migration must preserve those product contracts while moving generic interaction mechanics and product presentation to the approved shared layers.

## Files inspected

- `frontend/src/app/components/flashcard-review/flashcard-review.component.ts`
- `frontend/src/app/components/flashcard-review/flashcard-review.component.spec.ts`
- `frontend/src/app/services/vocabulary.store.ts`
- `frontend/src/app/components/srs-error-boundary/srs-error-boundary.component.ts`
- `frontend/src/app/components/primitives/a11y-clickable.ts`
- `frontend/src/app/components/primitives/button-primary/button-primary.component.ts`
- `frontend/src/app/routes/learning.routes.ts`
- `docs/spartan-relay-architecture.md`
- #6208 - control/interaction conversion
- #6209 - Relay tokens/responsive/theme parity
- #6210 - accessibility/RTL/zoom/input-method pass
- #6211 - regression/design-preview completion

## Route and feature boundary

The route is `/review`, declared in `frontend/src/app/routes/learning.routes.ts` and lazy-loading `FlashcardReviewComponent`.

The component does not navigate internally. It does not inject `Router`, declare `routerLink`, or emit a route request. The route contract therefore belongs to the learning route configuration and must not change as part of #6208-#6211.

The component accepts an optional `cards: Flashcard[]` input. When cards are supplied, they become the review session. When the input is empty, the component reads `VocabularyStore.pendingReviewCards()`.

This dual source is important for deck-specific sessions and default due-review sessions. A migration must not collapse the two modes or copy cards into a second local store.

## Data and side-effect contract

`VocabularyStore` remains the data owner. The review component currently uses it to:

1. load all flashcards;
2. load due reviews;
3. read pending review cards;
4. persist SRS grading through `updateSrsLevel()`;
5. mirror degraded/offline state.

The store owns authenticated HTTP calls, sanitisation, offline cache access, offline SRS queueing, and its own error reporting. Relay and Spartan must not receive those responsibilities.

Other side effects in the component are:

- haptic feedback for `again`, `good`, and `known` grading;
- browser `Audio` construction/playback for `pronunciation_url`;
- focus restoration to the next flashcard after card changes;
- shared SRS error-boundary reporting outside the main review markup.

There are no analytics hooks in `FlashcardReviewComponent` today. Do not add telemetry as an incidental migration change.

## State inventory

| State | Trigger | Current rendering/behavior | Intended owner |
| --- | --- | --- | --- |
| Loading | `isLoading() === true` | Two skeleton cards | Feature data state + Relay loading presentation |
| Empty | no review cards after loading | `AppEmptyStateComponent` | Feature state + Relay presentation |
| Degraded | store reports degraded SRS state | warning banner and optional reason | Feature/service state + Relay feedback presentation |
| Active, front | current card exists and `isFlipped() === false` | front word/context card | Feature state; generic activation semantics should be native/Spartan-owned |
| Active, back | current card exists and `isFlipped() === true` | translation/definition/audio | Feature state; card presentation Relay-owned |
| Grading available | card is flipped | Again, Good, Known controls | Feature grading decisions + shared button interaction |
| Saving grade | `isSaving() === true` | method rejects another grade, but buttons do not visibly disable | Feature async state + button disabled/busy presentation |
| Session progress | cards reviewed | count, progressbar, three counters | Feature state + Relay presentation |
| Complete | index is past final card | completion panel and Restart | Feature state + Relay feedback/action presentation |
| Pronunciation available | card has `pronunciation_url` | Play Audio button | Feature media side effect + shared button interaction |
| Pronunciation absent | no URL | no audio action | Feature data state |
| Shared SRS error | error boundary captures an error | alert, retry, optional report | Existing shared SRS boundary |
| Load error signal | `loadError()` | signal exists but is not rendered directly | Feature implementation debt, not a Spartan state |

### Important state ambiguities

`loadReviewData()` sets a local `loadError` flag only if `VocabularyStore.loadAllFlashcards()` or `loadDueReviews()` rejects. Those store methods currently catch their own provider errors and may use offline cache without rethrowing. As a result, the component's local load-error path is not a reliable representation of upstream failure.

Do not invent a new visual error state in #6208 solely from `loadError`. If product behavior requires a distinct online failure state, the store must expose an explicit state contract first.

The component also advances session stats and the current-card index even when an online SRS persistence request throws after the optimistic grade. That behavior is current product logic. The UI migration must not silently change it. A separate SRS correctness ticket should decide whether online persistence failure should block advancement, queue a retry, or visibly mark the grade unsynced.

## Complete control and interaction inventory

### 1. SRS Retry action

Rendered by `SrsErrorBoundaryComponent` when its error state is active.

Current owner: `AppButtonPrimaryComponent`, which wraps Spartan Helm Button.

Migration guidance: preserve the shared boundary. `FlashcardReviewComponent` should not duplicate its retry focus, button, or feedback mechanics.

### 2. SRS Report action

Rendered by `SrsErrorBoundaryComponent` when `showReportButton` is true.

Current owner: direct `hlmBtn` in the shared boundary.

Migration guidance: outside the target surface's feature ownership. Preserve the existing `reportError`/global `ErrorHandler` path.

### 3. Restart action

Rendered in the completion state as `AppButtonPrimaryComponent`.

Behavior: resets index, flip state, and session counters.

Migration guidance: already uses the approved Relay-facing button wrapper. Do not replace it with a feature-styled native button.

### 4. Flashcard flip surface

Current implementation: a clickable `<div>` with `appA11yClickable`, explicit `tabindex="0"`, click handling, `aria-pressed`, and front/back description IDs.

`A11yClickableDirective` adds synthetic `role="button"`, `tabindex`, Enter handling, and Space handling by calling `.click()`.

This is the largest interaction-ownership gap in #6208. Generic button keyboard behavior is being recreated in feature/shared directive code instead of using a native or approved Spartan interaction.

A direct conversion of the whole flashcard to `<button>` is **not** safe while the back face contains the nested Play Audio button. Interactive controls must not be nested. #6208 should first choose a structure that gives the flip action its own native/Spartan activation target while leaving audio as a sibling control, or otherwise provide a typed Relay flashcard interaction composition with valid semantics.

Do not preserve synthetic button behavior simply because it currently passes keyboard events.

### 5. Play Audio action

Current implementation: native `<button hlmBtn>` on the card back.

Behavior: stops event propagation, creates a new browser `Audio`, starts playback, and silently ignores playback rejection.

Migration guidance: the button interaction is already Spartan Helm-owned. Product audio lifecycle remains feature-owned. Avoid moving `Audio` creation into a generic button primitive.

Follow-up risks for #6210/#6211:

- there is no playing/busy state;
- there is no failure announcement;
- repeated clicks can create overlapping `Audio` instances;
- component destruction does not explicitly stop an active audio instance.

Those are media lifecycle concerns, not reasons to introduce a new Brain primitive.

### 6. Again grading action

Current implementation: native `<button hlmBtn>` with feature-owned danger styling.

Behavior: triggers haptic feedback, updates session statistics, persists the grade, then advances.

Migration guidance: preserve the native/Spartan button interaction. Move reusable product styling/state conventions to Relay where an appropriate button variant exists or is introduced.

### 7. Good grading action

Current implementation: native `<button hlmBtn>` spanning two grid columns with feature-owned warning styling.

Behavior: same lifecycle as Again with a different grade and interval hint.

Migration guidance: same as Again. The wider visual emphasis is feature composition, but generic disabled/focus/pressed styling belongs to the button layer.

### 8. Known grading action

Current implementation: native `<button hlmBtn>` with feature-owned success styling.

Behavior: same grading lifecycle with known-state haptic feedback.

Migration guidance: same as the other grading buttons.

## Overlay inventory

There are no dialogs, sheets, popovers, dropdowns, menus, or tooltips in `FlashcardReviewComponent`.

The two-sided flashcard is an in-page transform, not an overlay. Do not introduce Dialog/Popover Brain primitives to model card flipping.

## Keyboard and focus behavior

Current behavior includes:

- synthetic Enter/Space activation on the flashcard through `appA11yClickable`;
- native keyboard activation for audio and grading buttons;
- an `effect()` that returns focus to the flashcard when the card changes and is not flipped/complete;
- focusable grading controls only after flip because they are conditionally rendered.

Migration requirements:

- retain deterministic focus after grading advances to the next card;
- use native/Spartan activation semantics instead of recreating Enter/Space;
- ensure focus does not land on an element removed during front/back state changes;
- do not add keyboard shortcuts that fire while an IME composition is active;
- do not trap focus inside the flashcard;
- preserve visible focus in both light and dark themes.

The explicit `tabindex="0"` on the flashcard duplicates the same tabindex supplied by `A11yClickableDirective`. #6208 should remove that redundant synthetic contract rather than carrying it forward.

## Accessibility audit

### Current strengths

- progress uses `role="progressbar"` with value/min/max and translated accessible name;
- progress/session counts have live-region treatment;
- grading actions have translated accessible names;
- Play Audio has a card-specific translated accessible name;
- grading buttons are real buttons;
- decorative grade/audio glyphs are hidden from assistive technology where appropriate;
- empty and error states use shared presentation components;
- directional utility usage is mostly logical/direction-neutral.

### Risks to resolve

#### Synthetic flashcard role

The clickable `<div>` depends on a custom directive to behave like a button. This is more fragile than native semantics and creates a problematic parent-interactive region around a nested audio button on the back face.

#### Front/back accessibility tree

Both card faces remain in the DOM for the 3D transform. CSS visual rotation/backface hiding does not by itself guarantee that the inactive face is absent from the accessibility tree. The card also references both front and back IDs through `aria-describedby` regardless of flip state.

#6210 must verify actual screen-reader semantics and expose only the active face's meaningful content to assistive technology.

#### Saving state

`gradeReview()` guards `isSaving()`, but the rendered grading buttons do not bind `disabled` or `aria-busy`. A second activation is ignored programmatically with no visible or announced reason.

#6208 should connect the feature's existing saving state to the shared button disabled/busy contract.

#### Completion/progress announcement volume

Several live regions can update during a single grade: progress count, session counters, card container content, and completion status. #6210 should verify that announcements are useful rather than repetitive.

#### Error detail privacy

The shared SRS boundary can render an error message and can construct crash metadata containing component context. #6208 must not add card text, translations, user IDs, auth tokens, or pronunciation URLs to that reporting context.

## RTL and bidirectional text

Positive findings:

- layout uses direction-neutral flex/grid utilities;
- there are no feature-level `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*`, or `pr-*` layout classes in the reviewed template;
- shared button custom classes use logical `ps-*`/`pe-*` where applicable;
- the context badge width uses a percentage rather than a physical edge.

Follow-up requirements:

- keep item flow driven by document direction;
- do not manually reverse grade order just because the locale is RTL unless product design explicitly specifies it;
- verify mixed-direction word/translation/context content with `dir="auto"` or isolation where necessary;
- keep any directional iconography semantically correct in RTL;
- do not turn the 3D `rotateY` value into a locale-dependent layout rule without a demonstrated user need.

## Internationalisation

The primary UI strings use `TranslatePipe` or `I18nService`. Preserve those keys and keep styling out of translation data.

Dynamic content includes:

- `word_token`;
- `translation`;
- optional `definition`;
- optional `original_context`;
- degraded reason text from the store;
- interval hints.

These values can contain CJK, Arabic, Cyrillic, Devanagari, emoji, combining marks, and mixed-direction content. The migration must allow content to wrap rather than rely on English word lengths.

No migration stage should truncate the learning word or translation solely to preserve the current card height.

## Theme and token audit

The template already uses many Relay semantic classes, including `primary`, `success`, `warning`, `danger`, `surface-*`, `text-*`, and `text-on-fill`.

However, feature CSS still owns significant reusable presentation:

- hard-coded `border-radius: 1rem` on card faces;
- raw `box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3)`;
- direct RGB variable composition for card surfaces/borders;
- custom grade-button radii, hover opacity, active scale, cursor, and transition rules;
- 3D flip duration/easing;
- card face padding/alignment.

#6209 should align these with the Relay radius, elevation, surface, motion, and button contracts rather than introducing a second visual system.

Do not replace semantic `danger`, `warning`, and `success` grading meaning with arbitrary hard-coded colours. If grading buttons need a reusable semantic variant, expose it as a typed Relay/Helm variant rather than a feature-specific Tailwind escape hatch.

## Motion and reduced-motion

Current non-essential motion includes:

- a 0.6 second 3D card rotation;
- progress-bar width transition;
- grading-panel fade-in;
- grade-button active scaling.

#6210 must honor `prefers-reduced-motion` for these effects while preserving state changes and content access. Reduced motion should change animation, not remove the ability to flip, grade, or understand progress.

## Responsive and high-zoom contract

Current layout is constrained to `max-w-md`, with a four-column grading grid and a minimum 14rem card height.

Verification must cover:

- 390px mobile baseline;
- tablet and desktop host widths;
- 200% zoom;
- 400% zoom/reflow;
- long translations and definitions;
- long original context;
- all three grading actions after flip;
- completion and degraded banners;
- browser text scaling without clipped card content.

The four-column grade layout may become too dense when text grows. #6209/#6210 should prefer responsive reflow over shrinking labels or hiding interval hints.

Absolute-positioned card faces plus fixed minimum height are a specific high-zoom risk: content taller than the face can overlap or clip. The migration must verify content-driven height or otherwise guarantee scroll/reflow without hiding learning content.

## Spartan / Relay ownership map

| Capability | Current implementation | Target owner | Migration guidance |
| --- | --- | --- | --- |
| Page/session composition | feature template | Feature | Keep review workflow feature-owned |
| Data loading/SRS persistence | `VocabularyStore` | Service/feature | No Relay/Spartan ownership |
| Loading state | `AppSkeletonLoaderComponent` | Relay | Preserve |
| Empty state | `AppEmptyStateComponent` | Relay | Preserve |
| Header/session cards | `AppCardComponent` | Relay | Preserve/converge styling |
| Error/retry/report | `SrsErrorBoundaryComponent` | Shared SRS + Relay/Helm | Preserve shared boundary |
| Restart | `AppButtonPrimaryComponent` | Relay over Helm | Already correct |
| Flashcard flip activation | clickable div + `appA11yClickable` | Native/Spartan interaction wrapped by feature/Relay presentation | Replace synthetic keyboard behavior; restructure to avoid nested interactive controls |
| Flashcard visual shell | bespoke 3D CSS | Feature composition + Relay tokens | Keep feature-specific flip composition, move product surface/radius/elevation to Relay tokens |
| Play Audio button | direct `hlmBtn` | Helm or Relay button | Button mechanics shared; audio lifecycle feature-owned |
| Grade buttons | direct `hlmBtn` + bespoke CSS | Helm/Relay button + feature grade semantics | Preserve native semantics; consolidate reusable button behavior/styles |
| Progressbar | native ARIA + Relay tokens | Feature state + semantic presentation | No Brain needed |
| Session stat badges | styled spans | Relay static badge/pill presentation | No Brain unless interaction is added |
| Haptic feedback | `HapticFeedbackService` | Feature/service | Keep out of primitives |
| Focus after grading | feature `effect()` | Feature orchestration using native/Spartan focus targets | Preserve deterministic focus without synthetic click directive |
| Audio playback | browser `Audio` | Feature/service | Do not move into button primitive |

## Primitive prerequisites for #6208

No dialog, menu, select, or combobox primitive is needed.

The main prerequisite decision is the flashcard flip trigger. Before implementation, choose a valid semantic structure that satisfies all of these:

1. no synthetic `role="button"`/manual Enter-Space recreation;
2. no nested interactive control;
3. the flip action remains available by keyboard and touch;
4. the back-face Play Audio control remains independently reachable;
5. focus can move predictably after grading;
6. front/back accessibility-tree exposure is explicit.

If an existing Relay card cannot express that structure, #6208 may add the smallest typed review-card composition needed. Do not create a general-purpose Brain primitive for a feature-specific 3D visual effect.

## Existing regression coverage

`flashcard-review.component.spec.ts` currently contains tests for:

- component creation;
- initial state;
- progressbar rendering;
- cards supplied through the input;
- flipping;
- session-stat updates;
- advancing to the next card;
- completion;
- absence of physical RTL utility classes.

However, the entire suite is currently wrapped in `describe.skip(...)`, so none of that coverage protects production behavior.

This is a major prerequisite for #6211 and a migration risk for #6208-#6210. The suite must be re-enabled and made deterministic rather than copied into another skipped suite.

Missing regression cases include:

- native/Spartan flashcard activation semantics after conversion;
- focus restoration after grading;
- saving-state disabling/busy semantics;
- duplicate grade suppression;
- offline/degraded behavior;
- online persistence failure behavior;
- pronunciation playback success/failure/lifecycle;
- front/back accessibility-tree behavior;
- reduced motion;
- long translated content at high zoom;
- light/dark theme presentation;
- 390px, tablet, and desktop layout;
- completion restart behavior;
- provided-card versus store-card source behavior;
- error-boundary retry integration.

## Migration risks

1. **Nested interaction regression:** converting the whole card to a native button without restructuring would nest Play Audio inside a button.
2. **Synthetic semantics retained:** keeping `appA11yClickable` would leave generic keyboard mechanics feature-owned.
3. **Persistence behavior drift:** changing optimistic grade advancement as part of UI conversion would be an unrelated SRS product change.
4. **Busy-state ambiguity:** ignored duplicate grades can look like broken input if buttons remain enabled.
5. **Accessibility duplication:** both 3D faces can remain exposed to assistive technology.
6. **Focus loss:** replacing/removing the flashcard trigger can break the existing focus-restoration effect.
7. **Motion accessibility:** 3D rotation and fade/scale effects currently lack reduced-motion handling.
8. **High-zoom clipping:** absolutely positioned faces and fixed card geometry can hide long content.
9. **Theme drift:** bespoke raw shadows/RGB styling can diverge between light and dark themes.
10. **Audio leaks/overlap:** repeated Play Audio activation creates independent `Audio` objects with no owned lifecycle.
11. **Error-state invention:** local `loadError` does not reliably represent upstream store failure today.
12. **Test false confidence:** the existing unit suite is skipped.
13. **Privacy regression:** adding raw card content to crash-report context would broaden telemetry exposure.
14. **Over-abstraction:** introducing a new Brain primitive for the 3D visual effect would couple product presentation to generic interaction infrastructure unnecessarily.

## Recommended implementation sequence

### #6208 control and interaction conversion

1. replace the synthetic flashcard activation contract with a valid native/Spartan interaction structure;
2. preserve Play Audio as an independent control;
3. wire `isSaving()` to grading control disabled/busy semantics;
4. keep Restart on `AppButtonPrimaryComponent`;
5. preserve SRS error-boundary ownership;
6. do not change SRS scoring/persistence semantics incidentally;
7. add focused tests for all changed interaction contracts.

### #6209 Relay tokens, responsive layout, and theme parity

1. replace raw card radius/elevation/surface values with Relay roles;
2. converge grade-button presentation on typed shared variants where appropriate;
3. make the grade layout responsive for narrow/high-zoom content;
4. retain first-class light/dark and dynamic primary behavior;
5. verify 390px, tablet, and desktop layouts;
6. update the mapped design preview because visual contracts will change.

### #6210 accessibility, RTL, zoom, and input methods

1. expose only the active card face appropriately to assistive technology;
2. verify deterministic focus after flip/grade/restart;
3. verify reduced-motion behavior;
4. verify 200% and 400% reflow with long multilingual content;
5. verify logical RTL layout and mixed-direction text;
6. verify touch targets and disabled/busy announcements.

### #6211 regression and design-preview completion

1. remove `describe.skip` and make the suite authoritative;
2. cover loading, empty, degraded, front, back, saving, complete, audio, and failure states;
3. add explicit light/dark and mobile/wider design-preview states;
4. verify exact `/review` route ownership is unchanged;
5. update audit/status documentation only after the runtime and preview gates pass.

## Verification commands

For implementation stages, use the repository frontend verification gate:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

While iterating, run the focused flashcard-review spec as well. The final migration must also satisfy repository design-sync, UI coverage/visual capture, and required CI checks.

For this audit-only ticket, the relevant validation is repository documentation/constitution validation plus CI triggered by the pull request. No runtime component or design-preview contract is changed by #6207 itself.

## Acceptance checklist for #6207

- [x] Every current interactive element is inventoried.
- [x] Loading, empty, degraded, front, back, saving, completion, audio, and error-boundary states are recorded.
- [x] `/review` route ownership is recorded.
- [x] SRS persistence, offline behavior, haptics, audio, focus, and error-reporting side effects are recorded.
- [x] No analytics hook was found in the target component.
- [x] Spartan/Relay/native/feature ownership is mapped for each capability.
- [x] The synthetic flashcard-button and nested-audio migration risk is identified.
- [x] Accessibility, RTL, i18n, theme, responsive, high-zoom, and reduced-motion risks are recorded.
- [x] Existing skipped tests and missing regression cases are documented.
- [x] Prerequisites and implementation sequencing for #6208-#6211 are defined.

## Rollback

This audit changes documentation only. Rollback is a normal revert of this file. There is no API, schema, route, persistence, runtime, or visual-design migration to roll back.

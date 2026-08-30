# Selected-text flashcards

Issue #1134 is implemented through the shared `TokenisedTextComponent` used by chat messages and Moment posts. The feature deliberately reuses the existing authenticated translation and flashcard APIs rather than introducing a parallel persistence path.

## User-facing behavior

- Selecting text inside a tokenised chat message or Moment post and opening the context action requests a flashcard create flow.
- Desktop keeps the browser context menu untouched when there is no eligible selection. An eligible selection is intercepted only when it belongs entirely to the rendered message/post and fits the flashcard API contract.
- Touch users can invoke the same action with a 650 ms long press after selecting text. Moving more than 12 px cancels the long-press action so scrolling remains usable.
- The selected phrase and surrounding source context are shown/preserved through the existing Spartan dialog flow.
- Saving translates the selection into the current app language, then persists the selected phrase, translation, and source context through `FlashcardService`.
- Duplicate Save actions are ignored while translation or persistence is in flight.
- Translation or persistence failure leaves the dialog open and retryable; no partial success is presented as a completed save.

## API-bound input limits

The browser mirrors the existing `CreateFlashcardDto` limits so it does not knowingly submit requests that the backend must reject:

- selected phrase / `word_token`: 200 characters maximum;
- source `original_context`: 1,000 characters maximum;
- generated `translation`: 500 characters maximum.

An oversized selected phrase does not take over the desktop context menu and does not emit the mobile create action. Oversized context is bounded before persistence. When the directive derives a bounded context from a longer source, it keeps the selected phrase inside the retained window whenever that phrase can be located.

These frontend checks are usability and bandwidth protections only. The NestJS DTO remains authoritative and continues to validate every request independently.

## Surface ownership

`FlashcardContextMenuDirective` owns selection detection and desktop/touch gesture handling. `TokenisedTextComponent` owns the accessible create dialog, translation request, duplicate-submit protection, and retry state. `FlashcardService` owns authenticated persistence.

Both current product surfaces route text through the same component:

- `ChatRoomComponent` renders text messages with `app-tokenised-text`;
- `MomentsFeedComponent` renders Moment text with `app-tokenised-text` and supplies the Moment language hint.

This keeps behavior consistent and prevents chat and Moments from developing separate selection implementations.

## Privacy and security

- Selection processing is local until the user explicitly chooses to save.
- The selected text is sent to the existing authenticated NLP translation endpoint only as part of that explicit save flow.
- The resulting flashcard is persisted through the existing authenticated flashcard endpoint and remains subject to the backend's user ownership controls.
- No access token, selected text, source context, or translated text is intentionally added to application logs by this feature.
- User content is rendered with Angular text interpolation; the selected-text flow does not introduce an HTML trust boundary.
- Browser-side length checks do not replace backend validation or authorization.

## Accessibility and failure behavior

- The create surface uses the repository's Spartan dialog primitive for focus management, Escape handling, focus return, and keyboard operation.
- Save and Cancel use native buttons through Spartan and expose pending state with `aria-busy` / disabled state.
- Error state is exposed with `role="alert"` and remains retryable.
- The selected phrase remains text-selectable; touch handling does not call `preventDefault`, preserving native text selection and scrolling.
- Movement cancels a pending touch long press to avoid accidental saves while the user is scrolling.

## Verification

Focused regression coverage lives in:

- `frontend/src/app/services/flashcard-context-menu.directive.spec.ts` for owned selection detection, native-menu preservation, touch long press, movement cancellation, maximum selection length, and bounded context preservation;
- `frontend/src/app/components/tokenised-text/tokenised-text.selection-flashcard.spec.ts` for translation/persistence flow, locale targeting, payload limits, duplicate-submit suppression, provider failure, and retry behavior.

Repository frontend unit tests, static analysis, production build, translation-safety checks, UI governance, and the normal CI pipeline remain authoritative before merge.

## Rollout and rollback

No schema migration, new endpoint, feature flag, or persisted-data transformation is required. The change is compatible with existing clients and backend versions because it only narrows invalid browser requests before they reach the unchanged API.

Rollback is a normal revert of this change. Existing flashcards require no cleanup, and reverting does not change their schema or ownership rules.

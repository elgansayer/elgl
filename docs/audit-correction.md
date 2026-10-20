# Audit Report: Community Correction Capabilities

## Summary
I have audited every place users can correct another user's language across the platform.

## Places where corrections can be made
The platform allows users to correct another user's language in the following surfaces:
1. **Chat Rooms / Direct Messaging (`frontend/src/app/pages/chat/chat-page.component.ts`)**: Users can request and send corrections on specific messages. The UI surfaces a "✏️ Correction requested" state. Users can trigger an inline correction panel to submit corrections.
2. **Moments Feed / Social Comments (`frontend/src/app/components/moments-feed/moments-feed.component.ts`)**: Users can trigger a "ghost correction" modal to submit corrections on a moment's text or its comments.
3. **Long Press Context Menu (`frontend/src/app/components/long-press-context-menu/long-press-context-menu.component.ts`)**: In various text surfaces, long-pressing brings up a menu with an option to request a correction (`doRequestCorrection`).
4. **Favourites (`frontend/src/app/components/favourites/favourites.component.html`)**: Rendered corrections that have been bookmarked are displayed using the same inline visual diff component.

## Evaluation of requirements
- **Extremely fast to create**: The platform uses `CorrectionModalComponent` (`frontend/src/app/components/correction-modal/correction-modal.component.ts`), which offers a diff preview (`moments.liveDiffPreview`) that instantly highlights changes as the tutor edits the text. It also features one-tap "Quick Tags" (exactly: `"Natural phrasing", "Grammar", "Typo", "Vocabulary"`) to append context without typing out full explanations.
- **Easy to understand**: Submitted corrections are displayed via the `VisualDiffComponent` (`frontend/src/app/components/visual-diff/visual-diff.component.ts`), which uses the `Intl.Segmenter` API (word granularity) to render structural changes inline. Removed text is shown in danger (red) with strikethrough (`text-danger line-through`), and added text is highlighted in success (green) (`text-success`).
- **Non-judgemental**: The structured diff format prevents unstructured long-form subjective criticism. The UI specifically offers neutral "Quick Tags" to categorise the reasoning objectively.
- **Translatable**: If the tutor provides an optional explanation, the `VisualDiffComponent` automatically displays a translate button (using `lucideLanguages` icon) next to it, connected via `ChatService.translateText` with integrated caching (`TranslationCacheService`).
- **Reusable as learning material (SRS/Examples)**: The `VisualDiffComponent` checks a `showActions` input flag (set to `true` across Chat, Moments, and Favourites). When enabled, it displays an add to flashcard button (`➕ {{ 'correction.createFlashcard' | t }}`). This button converts the correction directly into an SRS flashcard via `FlashcardService.createFlashcard`, capturing the corrected phrase, original text, and context automatically.

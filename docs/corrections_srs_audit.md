# Language Corrections Audit

## 1. Locations for User Corrections

- **Moments Feed**: Users can correct public posts via the `CorrectionModalComponent` triggered from `MomentsFeedComponent`.
- **Chat Rooms**: Users can correct direct messages via the inline correction form in `ChatRoomComponent`.

## 2. Assessment against criteria

- **Extremely fast to create**:
  - _Correction Modal_: Initializes with the original text automatically (`correctedText.set(this.originalText())`). The user only needs to edit the part that is wrong rather than retyping the entire sentence.
  - _Chat Room_: The inline correction form also pre-fills the original text.
- **Easy to understand**:
  - Both surfaces rely on `VisualDiffComponent` which uses `Intl.Segmenter` to render word-level diffs with distinct visual markers (green background for additions, red strikethrough for removals).
  - The live diff preview updates instantly as the user types.
- **Non-judgemental**:
  - The UI uses terms like "Ghost Original" and "Corrected Sentence". Explanations are marked as `(optional)`.
- **Translatable**:
  - All static UI strings in both surfaces use the translation pipe (`| t`) relying on `I18nService`.
  - The actual user-provided explanation text is stored as a raw string and currently lacks an explicit "Translate" button inline within the diff rendering.
- **Reusable as learning material (SRS / Examples)**:
  - The `VisualDiffComponent` includes a `showActions` flag. When enabled, it renders a "➕ Create Flashcard" button.
  - Clicking this button invokes `FlashcardService.createFlashcard()` using the corrected text as the target word, the original text as the translation, and the explanation as context.

## 3. Actionable Recommendations

- Enable the `showActions` flag for the `app-visual-diff` in the `CorrectionModalComponent` and `ChatRoomComponent` templates so that users viewing a correction can convert it into an SRS flashcard with one action.
- Ensure the `VisualDiffComponent` handles long corrections gracefully when converting to flashcards.
- Introduce an auto-translation toggle for the explanation field to make the context fully accessible to beginners.

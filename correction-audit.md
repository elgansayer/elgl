# Audit Report: Corrections

## 1. Extremely fast to create
- The `CorrectionModalComponent` offers a modal allowing for creation.
- The `VisualDiffComponent` provides a visual diff.

## 2. Easy to understand
- `VisualDiffComponent` provides a visual diff.
- Explanations are optional but supported in `VisualDiffComponent`.

## 3. Non-judgemental
- Phrasing uses `moments.correctSentenceTitle`.

## 4. Translatable
- `VisualDiffComponent` imports `TranslationCacheService` and `ChatService`.
- There is a `TranslatePipe`.

## 5. Reusable as learning material (SRS / Examples)
- `VisualDiffComponent` imports `FlashcardService`.

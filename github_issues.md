# Audit and Issues: Language Correction Enhancements

This document contains a series of GitHub issues generated from an audit of the language correction functionality across the HelloTalk-clone platform. The goal is to make corrections faster to create, easier to understand, non-judgemental, translatable, and reusable as learning material via Spaced Repetition System (SRS) integration.

---

## Issue 1: Make Corrections Non-Judgemental (Terminology Update)
**Title:** Refactor terminology from "Correction" to "Suggestion" and "Corrected" to "Improved"
**Labels:** `enhancement`, `frontend`, `ux`

**Description:**
To foster a non-judgemental and supportive learning environment, the terminology used in the correction UI should be softened. "Correction" implies the user made a strict mistake, which can be discouraging.

**Tasks:**
- In `frontend/src/assets/i18n/*.json`:
  - Rename translation keys matching "correction" (e.g., `moments.sendCorrection`, `moments.correctSentenceTitle`) to use "Suggestion" or "Improvement".
  - Rename `moments.correctedSentence` to `moments.improvedSentence`.
  - Update `visual_diff.title` from "✏️ Visual Diff" / "Correction" to "✏️ Language Suggestion".
- Update the UI text in `CorrectionModalComponent` and `VisualDiffComponent` to reflect the new terminology.

---

## Issue 2: Streamline and Accelerate Correction Creation
**Title:** Improve creation speed of Language Suggestions (Auto-focus & Quick Tags)
**Labels:** `enhancement`, `frontend`

**Description:**
Creating a correction must be extremely fast to encourage more users to participate in community feedback. Currently, the `CorrectionModalComponent` requires manual focus and typing out explanations from scratch.

**Tasks:**
- Add `cdkFocusInitial` or manually auto-focus the `HlmTextarea` in `CorrectionModalComponent` so users can start typing their improvements immediately when the modal opens.
- Add quick-select explanation tags (e.g., "Natural phrasing", "Grammar", "Typo", "Vocabulary") below the explanation input so tutors can provide context with a single tap.
- Consider pre-filling the explanation input when a quick tag is tapped.

---

## Issue 3: Make Explanations Translatable & Easy to Understand
**Title:** Add one-tap translation for tutor explanations in Visual Diff
**Labels:** `feature`, `frontend`

**Description:**
When a user receives a correction, the tutor's explanation is often written in the tutor's native language or the target language, which the learner might not fully understand.

**Tasks:**
- In `VisualDiffComponent`, add a translation button (e.g., a small globe icon) next to the explanation text.
- Connect this button to the `I18nService` / `TranslatePipe` or the NLP translation backend endpoint to instantly translate the explanation into the learner's native language.
- Ensure the translation state is togglable (show original / show translation).

---

## Issue 4: One-Click Conversion to SRS Flashcards
**Title:** Implement one-tap saving of corrections to SRS Vocabulary Store
**Labels:** `feature`, `frontend`

**Description:**
To make corrections highly reusable as learning material, learners should be able to convert a received correction (and its explanation) into an SRS flashcard or example sentence with a single action.

**Tasks:**
- In `VisualDiffComponent` (or via an event emitted to its parent, such as `ChatRoomComponent` or `MomentsFeedComponent`), add a "Save as Flashcard" button.
- Upon clicking, invoke `VocabularyStore.saveWord({ word_token: <corrected_segment>, translation: <explanation_or_original>, original_context: <full_corrected_sentence> })`.
- Since `VisualDiffComponent` receives `original`, `corrected`, and `explanation` as inputs, it has all the context needed to construct a meaningful flashcard payload.
- Show a success toast/haptic feedback when the correction is successfully added to the user's SRS review queue.

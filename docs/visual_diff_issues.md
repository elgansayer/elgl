# Visual Diff Component Audit Report

## Issue 1: Replace naive O(N) diff algorithm with Myers Diff
**Description:** The current diff implementation in `visual-diff.component.ts` uses a naive O(N) loop with a magic `slice(j, j + 5)` lookahead. This is highly unreliable for complex text differences and can lead to incorrect token mapping and visual tearing.
**Acceptance Criteria:**
* Replace the custom `while` loop diff logic with a standard algorithm (e.g., Myers diff or the `diff` package).
* Ensure adding/removing multiple words in sequence is correctly segmented.
* All existing tests in `visual-diff.component.spec.ts` must pass.
**Suggested Labels:** `bug`, `tech-debt`

## Issue 2: Optimise Intl.Segmenter instantiation
**Description:** In `visual-diff.component.ts`, `new Intl.Segmenter(...)` is instantiated inside the `computed` block `segments()`. Since `computed` functions run repeatedly when inputs change, this causes expensive, repetitive instantiation of the segmenter.
**Acceptance Criteria:**
* Move `Intl.Segmenter` instantiation outside the `computed` loop, ideally making it a static property or initializing it once.
* The component must continue to segment text correctly.
**Suggested Labels:** `enhancement`, `performance`, `good first issue`

## Issue 3: Incorrect mapping of Flashcard Translation
**Description:** In `visual-diff.component.ts`'s `createFlashcard()` method, `this.original()` is mapped to the `translation` field, which is likely semantically incorrect (usually original is the target word and translation is the user's native language).
**Acceptance Criteria:**
* Update the `translation` payload field in `createFlashcard()` to properly use the intended translated context.
* Add or update a unit test verifying the payload in `createFlashcard()`.
**Suggested Labels:** `bug`

## Issue 4: Missing focus visibility for Translate button
**Description:** The translate button in the explanation section uses `opacity-0 group-hover:opacity-100`. This means it only appears on mouse hover, rendering it invisible to keyboard-only users who tab to it.
**Acceptance Criteria:**
* Add `focus:opacity-100` (or equivalent focus-visible class) to the translate button.
* Verify the button becomes visible when focused via keyboard navigation.
**Suggested Labels:** `accessibility`, `bug`

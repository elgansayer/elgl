# Consolidated Product Backlog

Organized by complete user outcomes rather than isolated technical chores. This report consolidates every backlog item currently recorded in `github_issues.md`, `.tasks/improve-communities-ui.md`, and `docs/visual_diff_issues.md`, while deduplicating overlapping work. It does not independently assert the live GitHub issue state.

## 1. Complete the Communities navigation experience

**Outcome:** Communities and groups are easy to navigate on desktop and mobile, expose clear interaction state and unread activity, and remain understandable during loading or failure.

- Refactor `CommunitiesComponent` to a responsive three-pane desktop layout for communities, groups, and active content. (`github_issues.md` Issue 1; `.tasks/improve-communities-ui.md`)
- Add selected-community and selected-group active states plus consistent hover/micro-interaction feedback. (`github_issues.md` Issue 2; `.tasks/improve-communities-ui.md`)
- Add a mobile off-canvas/sliding-pane navigation model with an obvious way to move back up the hierarchy. (`github_issues.md` Issue 3; `.tasks/improve-communities-ui.md`)
- Add unread indicators for communities/groups and clear them when the relevant destination is viewed. (`github_issues.md` Issue 4; `.tasks/improve-communities-ui.md`)
- Add loading, fetch/create error handling, user-facing failure feedback, and duplicate-submit protection for community creation. (`github_issues.md` Issue 5)

These entries are different slices of one product outcome and should be planned as a single Communities UI epic with independently testable milestones.

## 2. Connect the language-learning loop end to end

**Outcome:** Conversation, voice practice, reading, corrections, and spaced repetition reinforce each other instead of operating as isolated features.

- Extract and suggest vocabulary from completed AI conversations and voice transcriptions for the SRS/flashcard workflow. (`github_issues.md` Architectural Enhancements)
- Connect pronunciation scoring to flashcard review so active-production voice attempts can contribute to SRS grading. (`github_issues.md` Architectural Enhancements)
- Map the learner's assessment/proficiency state to reading difficulty so the reading engine can surface appropriate i+1 content. (`github_issues.md` Architectural Enhancements)
- Queue corrected vocabulary from the Visual Diff/corrections flow into the learner's flashcard deck. (`github_issues.md` Architectural Enhancements)

This is a cross-feature learning-system epic. The Visual Diff integration overlaps with the stabilization work below and should share one canonical flashcard payload contract.

## 3. Stabilize and optimize Visual Diff corrections

**Outcome:** Native-speaker corrections are accurate, performant, accessible, and produce semantically correct flashcards.

- Replace the naive token lookahead diff with a standard algorithm such as Myers diff and retain/expand regression coverage for multi-word insertions and deletions. (`docs/visual_diff_issues.md` Issue 1)
- Avoid repeated `Intl.Segmenter` construction by reusing an appropriate segmenter instance while preserving segmentation behavior. (`docs/visual_diff_issues.md` Issue 2)
- Correct the flashcard translation mapping in `createFlashcard()` and add a unit test that locks the intended payload semantics. (`docs/visual_diff_issues.md` Issue 3)
- Make the Translate action visible when keyboard-focused, not only on pointer hover, and cover the focus-visible behavior. (`docs/visual_diff_issues.md` Issue 4)

These items form one Visual Diff stabilization epic spanning correctness, performance, SRS integration, and accessibility.

## Completed / obsolete technical chores

- The streak-reset CRON work in `backend/TODO.md` is already marked complete, including the streak service, daily cron, `last_active_at` support, interceptor, and unit coverage. It should not remain in the active backlog.

## Source coverage

- `github_issues.md`: Issues 1-5 plus the Architectural Enhancements for Language Learning Synergy entry are represented above.
- `.tasks/improve-communities-ui.md`: layout, active states, micro-interactions, unread badges, and mobile responsiveness are deduplicated into the Communities epic.
- `docs/visual_diff_issues.md`: Issues 1-4 are all represented above.

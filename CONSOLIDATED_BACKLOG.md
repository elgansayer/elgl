# Consolidated Product Backlog

## Overview
This document consolidates all outstanding issues against the current source tree, organized around complete user outcomes rather than individual technical chores.

## 1. Communities V2: Multi-Pane Layout & Stability

The Communities UI requires a structural redesign to support a modern multi-pane layout (similar to Discord/X), while paying down technical debt and fixing usability bugs.

**Consolidated Chores & Issues:**

- Extract sub-components (list item, creation form) from `communities.component.ts` (replaces Issue 4).

- Migrate direct Spartan Helm imports (`HlmInput`, `HlmButton`) to Relay primitives (`AppInputComponent`, `AppButtonPrimaryComponent`) (replaces Audit Issue 1).

- Implement CSS Grid/Flexbox three-pane layout for desktop and sliding drawer for mobile (replaces Issue 1).

- Add active state styling (`selectedCommunityId`) (replaces Issue 2).

- Implement hover effects and unread notification badges (replaces Issue 3).

- Fix Flash of Empty State (FOES) during data loading (replaces Audit Issue 2).

- Add client-side validation to disable the submit button for empty community names (replaces Audit Issue 3).

- Wrap `CommunitiesService` calls in `try...catch` for robust error handling (replaces Issue 5).


## 2. Performance: Large Data View Optimization

Implement virtual scrolling to prevent DOM bloat, increased memory usage, and UI lag when rendering large datasets.

**Consolidated Chores & Issues:**

- Import and integrate `ScrollingModule` (`@angular/cdk/scrolling`) in `chat-page.component.ts` and `reading-engine.component.ts`.

- Replace standard rendering loops with `<cdk-virtual-scroll-viewport>`.

- Ensure dynamic height recalculation works for varying content lengths.

- Verify reverse scrolling (pagination) in chat functions correctly.


## Obsolete / Superseded Issues

- `github-issues-report.md`: All Communities UI issues (Issues 1-5) are superseded by **Communities V2**.

- `docs/communities_audit_report.md`: All audit issues (Issues 1-3) are superseded by **Communities V2**.

- `github-issue-communities.md`: Duplicate of the Virtual Scrolling issue from the main report. Marked as Duplicate.

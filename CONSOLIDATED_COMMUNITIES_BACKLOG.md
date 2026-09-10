# Consolidated Communities Issues Backlog

## Overview
This document consolidates all outstanding issues and technical chores related to the Communities feature into a unified, outcome-oriented backlog.

## Core Objective: Communities V2 (Denser Multi-Pane Layout & Stability)

The Communities UI requires a structural redesign to support a modern multi-pane layout (similar to Discord/X), while simultaneously paying down technical debt (Spartan primitive migration, sub-component extraction) and fixing usability bugs (Flash of Empty State, missing error handling).

### Phase 1: Structural Refactoring & Tech Debt

- **Extract Sub-components**: Break `communities.component.ts` into smaller, maintainable pieces: a list item component, a creation form component, and the main container. (Consolidates Issue 4)

- **Migrate to Relay Primitives**: Replace direct Spartan Helm imports (`HlmInput`, `HlmButton`) with approved Relay primitives (`AppInputComponent`, `AppButtonPrimaryComponent`). (Consolidates Audit Issue 1)


### Phase 2: Denser Multi-Pane Layout & Active States

- **Desktop Multi-Pane Grid**: Refactor the page using CSS Grid/Flexbox into a responsive three-pane layout (Communities sidebar, Groups sidebar, Main content area). (Consolidates Issue 1)

- **Mobile Drawer View**: Implement an off-canvas drawer or sliding pane view for smaller screens to manage navigation density. (Consolidates Issue 1)

- **Active State Visualization**: Use Angular signals (`selectedCommunityId`) and Tailwind (e.g., `bg-surface-300`, `border-l-4 border-indigo-500`) to highlight the currently active community/group. (Consolidates Issue 2)


### Phase 3: Micro-Interactions, Feedback, & Bug Fixes

- **Hover Effects & Unread Badges**: Add `hover:bg-surface-200` to list items and integrate unread notification badges (e.g., pill-shaped red divs). (Consolidates Issue 3)

- **Fix Flash of Empty State (FOES)**: Update the computed `communities` signal and `@empty` block to respect `communitiesResource.isLoading()`, displaying a skeleton/spinner instead of 'Empty' while loading. (Consolidates Audit Issue 2)

- **Client-Side Form Validation**: Dynamically disable the 'Create' submit button if the required `newName` field is empty/whitespace. (Consolidates Audit Issue 3)

- **Robust Error Handling**: Wrap `CommunitiesService` calls (`create`, `remove`) in `try...catch` blocks and integrate toast notifications/error UI to handle API failures gracefully. (Consolidates Issue 5)


## Resolved / Obsolete Issues

- The previous individual issues (Issue 1-5 from `github-issues-report.md` and Audit Issues 1-3 from `docs/communities_audit_report.md`) are now closed and superseded by this unified Communities V2 objective. These were overly granular and parts of the same larger architectural rewrite.

# Consolidated Product Backlog

This backlog consolidates open issues into complete user outcomes, resolving duplications, overly granular tasks, and legacy technical chores into cohesive objectives.

## Objective 1: Deliver a Modern, Robust Communities Navigation Experience

**User Outcome:** Users can intuitively navigate between communities and specific groups using a dense, responsive layout (similar to modern chat apps) with clear visual feedback, interactive states, and reliable error handling.

**Consolidated Issues:**
- Issue 1: Implement Denser Multi-Pane Layout for Communities
- Issue 2: Enhance Active State Visualization in Communities UI
- Issue 3: Add Micro-interactions and Notifications to Communities List
- Issue 4: Technical Debt: Extracted Sub-components for Scalability
- Issue 5: Missing Error Handling in Community Creation/Deletion
*(Also covers duplicates found in `github-issue-communities.md` and `github-issues-report.md`)*

**Status Analysis:** These issues are unstarted. The current `communities.component.ts` uses a basic single-column list flow and lacks these features, including error handling.

**Acceptance Criteria:**
- Refactor `communities.component.html` using Tailwind CSS Grid or Flexbox to create a responsive three-pane layout on desktop (Communities sidebar, Groups sidebar, Main chat/content).
- Implement an off-canvas drawer or a sliding pane view for mobile screens.
- Utilise Angular signals to apply distinct active styles (e.g., `bg-surface-300`, `border-l-4 border-indigo-500`) to the currently viewed community or group.
- Introduce hover effects on list items (e.g., `hover:bg-surface-200`) and add unread notification badges.
- Extract the community creation form and community list items into separate, reusable components.
- Wrap asynchronous calls (`create()` and `delete()`) in `try...catch` blocks and display appropriate error notifications.

**Suggested Labels:** enhancement, ui, responsive, tech-debt

---

## Objective 2: Optimize Rendering Performance for Data-Heavy Views

**User Outcome:** Users experience smooth, lag-free scrolling when navigating extensive chat histories or reading long texts on any device, eliminating DOM bloat and high memory usage.

**Consolidated Issues:**
- Implement Angular CDK Virtual Scrolling for Chat and Reading Views *(Duplicate across `github-issues-report.md` and `github-issue-communities.md`)*

**Status Analysis:** Unstarted. `chat-page.component.ts` and `reading-engine.component.ts` currently use standard `@for` loops.

**Acceptance Criteria:**
- Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into standalone components like `chat-page.component.ts` and `reading-engine.component.ts`.
- Replace standard `@for` loops rendering chat messages and reading articles with `<cdk-virtual-scroll-viewport>`.
- Ensure dynamic height recalculation works correctly for chat messages with varying content lengths.
- Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
- Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.

**Suggested Labels:** performance, ui, tech-debt

---

## Objective 3: Stabilize Real-Time Chat Operations

**User Outcome:** Users experience reliable real-time messaging without performance degradation from N+1 API calls, race conditions during navigation, or inconsistent message deletion handling.

**Consolidated Issues:**
- Issue 1: N+1 API Request Explosion on Message Status Updates (`chat-page-issues.md`)
- Issue 2: Redundant Message Deletion Logic in Centrifugo Event Handler (`chat-page-issues.md`)
- Issue 3: Race Condition in Room Selection (Message Overwrite) (`chat-page-issues.md`)

**Status Analysis:** Unstarted. The `chat-page.component.ts` file exhibits these exact issues in its current state.

**Acceptance Criteria:**
- Replace the two unawaited `markMessageStatus` API calls per unread message with a single batched/bulk update request.
- Add a guard condition to verify `this.selectedRoom()?.id === room.id` after fetching messages in `selectRoom()` to prevent race condition overwrites.
- Remove redundant branches in the `message_deleted` event handler within `handleCentrifugoEvent()`.

**Suggested Labels:** bug, performance, tech-debt

---

## Objective 4: Integrate Architectural Enhancements for Language Learning Synergy

**User Outcome:** Users benefit from a cohesive language acquisition engine where AI conversations, pronunciation scoring, and reading difficulty automatically feed into and adapt with their Spaced Repetition System (SRS) vocabulary.

**Consolidated Issues:**
- Issue: Architectural Enhancements for Language Learning Synergy (`github_issues.md`)

**Status Analysis:** Unstarted. The core NLP and Reading Engine services are functional but operate in isolation.

**Acceptance Criteria:**
- Build a background worker in `nlp.service.ts` that automatically extracts and suggests new vocabulary (flashcards) from completed AI Conversations and Voice Transcriptions.
- Integrate the Pronunciation Scoring service with the SRS engine so that reviewing a flashcard can include an active-production voice test.
- Map the user's dynamic Assessment proficiency score to the LingQ Reading Engine to highlight i+1 (Comprehensible Input) texts and appropriately scale tokenized difficulty.
- Modify the Visual Diff tool in Corrections to automatically queue corrected words into the user's flashcard deck for spaced repetition.

**Suggested Labels:** enhancement, architecture, learning-engine

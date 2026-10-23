# Consolidated Product Backlog

This backlog consolidates open issues into complete user outcomes rather than individual technical chores.

## Objective 1: Modernize Communities Navigation and Layout

**Status**: To Do
**Consolidated Issues**:
- Issue 1: Implement Denser Multi-Pane Layout for Communities
- Issue 2: Enhance Active State Visualization in Communities UI
- Issue 3: Add Micro-interactions and Notifications to Communities List
- Issue 4: Technical Debt: Extracted Sub-components for Scalability

**Description**:
The current Communities UI (`communities.component.ts`) lacks clear spatial navigation and feels basic. This objective focuses on transitioning the UI to a modern, responsive multi-pane layout (similar to Discord or X) with a primary sidebar for broad communities and a secondary sidebar for specific groups. To maintain scalability, the monolithic component will be refactored into smaller, dedicated sub-components (like community creation form and list items). Additionally, the UI will be enhanced with distinct active state visualizations, hover effects, and unread notification badges to improve user engagement and awareness.

**Acceptance Criteria**:
- Refactor the page using CSS Grid or Flexbox to create a responsive three-pane layout on desktop: a narrow left sidebar for Communities, a secondary sidebar for Groups within the selected community, and a main central area for the active chat/content.
- Implement an off-canvas drawer or a sliding pane view for mobile screens to ensure the complex navigation doesn't overwhelm smaller devices, possibly leveraging Angular animations for smooth pane transitions.
- Utilise Angular signals (e.g., `selectedCommunityId`) to track and apply distinct active styles.
- Apply Tailwind classes like `bg-surface-300` and `border-l-4 border-indigo-500` to indicate the currently viewed community or group.
- Introduce subtle hover effects (e.g., `hover:bg-surface-200`, `transition-colors duration-150`) on community list items.
- Include unread notification badges for communities/groups with new activity, using a small, pill-shaped red div (`bg-red-500 text-white rounded-full px-1.5 text-[10px]`).
- Create a separate component for the community creation form.
- Create a separate component for rendering the community list item.
- Refactor `communities.component.ts` to use these new components, passing data via `input.required<T>()` or `input<T>()` and handling events via `output<T>()`.

## Objective 2: Ensure Robustness in Community Operations

**Status**: To Do
**Consolidated Issues**:
- Issue 5: Missing Error Handling in Community Creation/Deletion

**Description**:
The `create()` and `delete()` methods in `communities.component.ts` lack error handling. If an API request fails, the application fails silently or enters a broken state without providing user feedback. This objective focuses on wrapping these operations in `try...catch` blocks and displaying appropriate toast notifications or inline error messages.

**Acceptance Criteria**:
- Wrap asynchronous calls (`await this.communitiesService.create(...)` and `await this.communitiesService.remove(...)`) in `create()` and `delete()` with `try...catch` blocks.
- Integrate a notification service or error display mechanism to inform the user if creating or deleting a community fails.
- Ensure the UI remains responsive and doesn't get stuck in a loading state upon error.

## Objective 3: Optimize Rendering Performance for Data-Heavy Views

**Status**: To Do
**Consolidated Issues**:
- Implement Angular CDK Virtual Scrolling for Chat and Reading Views

**Description**:
Data-heavy components like `chat-page.component.ts` and `reading-engine.component.ts` currently lack virtual scrolling. Rendering large chat histories or extensive reading texts causes severe DOM bloat, increased memory usage, and UI lag, degrading performance on browsers. This objective integrates `@angular/cdk/scrolling` to replace standard rendering loops with `<cdk-virtual-scroll-viewport>`, implementing virtualized rendering/windowing. **Important note**: As per review, we should profile first and if justified, preserve dynamic item heights, pagination, scroll position when prepending messages, keyboard navigation, search, selection and screen-reader access.

**Acceptance Criteria**:
- Profile representative article and chat histories before deciding. If virtualization is justified:
- Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
- Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
- Implement virtualised rendering or windowing in the reading components for extensive texts.
- Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
- Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
- Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.

## Objective 4: Optimize API performance for Chat

**Status**: To Do
**Consolidated Issues**:
- N+1 API Request Explosion on Message Status Updates

**Description**:
In `chat-page.component.ts`, when a user selects a room, the component auto-marks unread messages from others as 'delivered' and then 'read' in a loop, firing two unawaited API calls per message (`this.chatService.markMessageStatus(msg.id, 'delivered')` and `this.chatService.markMessageStatus(msg.id, 'read')`). This causes an N+1 explosion of HTTP requests.

**Acceptance Criteria**:
- The two separate API calls per message are replaced with a single bulk update endpoint, or the backend logic is updated such that marking a message as 'read' automatically implies 'delivered'.
- The component only sends a single batched request for all unread message IDs.
- No race conditions or rate-limiting issues occur when loading a room with hundreds of unread messages.

## Objective 5: Fix Chat Bugs and Tech Debt

**Status**: To Do
**Consolidated Issues**:
- Redundant Message Deletion Logic in Centrifugo Event Handler
- Race Condition in Room Selection (Message Overwrite)

**Description**:
Fix two specific bugs in `chat-page.component.ts`: a redundant logic check in `message_deleted` handling and a race condition when switching rooms quickly.

**Acceptance Criteria**:
- In `message_deleted` handler, the redundant `if` statement for 'deleted for me' vs 'everyone' is corrected or unified if behavior is identical.
- A guard condition is added after `await this.chatService.getMessages(room.id)` to verify that `this.selectedRoom()?.id === room.id` before calling `this.messages.set(messages)` in `selectRoom`.

## Objective 6: Architectural Enhancements for Language Learning Synergy

**Status**: To Do
**Consolidated Issues**:
- Architectural Enhancements for Language Learning Synergy

**Description**:
Core language learning principles are siloed. AI conversations don't feed the Spaced Repetition System (SRS).

**Acceptance Criteria**:
- Build a background worker in `nlp.service.ts` that automatically extracts and suggests new vocabulary (flashcards) from completed AI Conversations and Voice Transcriptions.
- Integrate the Pronunciation Scoring service with the SRS engine.
- Map the user's dynamic Assessment proficiency score to the LingQ Reading Engine.
- Modify the Visual Diff tool in Corrections to automatically queue corrected words into the user's flashcard deck for spaced repetition.

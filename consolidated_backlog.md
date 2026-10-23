# Consolidated Product Backlog

This backlog consolidates open issues into complete user outcomes rather than individual technical chores.

## Objective 1: Modernise Communities Navigation and Layout

**Status**: To Do
**Consolidated Issues**:

- Issue 1: Implement Denser Multi-Pane Layout for Communities
- Issue 2: Enhance Active State Visualisation in Communities UI
- Issue 3: Add Micro-interactions and Notifications to Communities List
- Issue 4: Technical Debt: Extracted Sub-components for Scalability

**Description**:
The current Communities UI (`communities.component.ts`) lacks clear spatial navigation and feels basic. This objective focuses on transitioning the UI to a modern, responsive multi-pane layout (similar to Discord or X) with a primary sidebar for broad communities and a secondary sidebar for specific groups. To maintain scalability, the monolithic component will be refactored into smaller, dedicated sub-components (like community creation form and list items). Additionally, the UI will be enhanced with distinct active state visualisations, hover effects, and unread notification badges to improve user engagement and awareness.

**Acceptance Criteria**:

- Refactor the page using CSS Grid or Flexbox to create a responsive three-pane layout on desktop: a narrow left sidebar for Communities, a secondary sidebar for Groups within the selected community, and a main central area for the active chat/content.
- Implement an off-canvas drawer or a sliding pane view for mobile screens to ensure the complex navigation doesn't overwhelm smaller devices, possibly leveraging Angular animations for smooth pane transitions.
- On mobile, display one pane at a time and provide an accessible way to navigate back through the community, group, and content hierarchy.
- Utilise Angular signals (e.g., `selectedCommunityId`) to track and apply distinct active styles.
- Apply Relay semantic classes such as `bg-surface-300` and `border-s-4 border-primary` to indicate the currently viewed community or group while preserving RTL layout.
- Introduce subtle hover effects (e.g., `hover:bg-surface-200`, `transition-colors duration-150`) on community list items.
- Include compact unread notification badges for communities and groups with new activity, using Relay semantic colour roles.
- Extend the community and group API models with unread state, display badges conditionally, and clear or decrement the state when the user enters the relevant community or group.
- Create a separate component for the community creation form.
- Create a separate component for rendering the community list item.
- Refactor `communities.component.ts` to use these new components, passing data via `input.required<T>()` or `input<T>()` and handling events via `output<T>()`.
- Preserve existing community and group fetching and navigation behaviour throughout the layout refactor.

## Objective 2: Ensure Robustness in Community Operations

**Status**: To Do
**Consolidated Issues**:

- Issue 5: Missing Error Handling in Community Creation/Deletion

**Description**:
The Communities page lacks complete loading and error handling. If an API request fails, the application fails silently or enters a broken state without providing user feedback. This objective covers list loading, fetch failures, and safe create/delete operations.

**Acceptance Criteria**:

- Wrap asynchronous calls (`await this.communitiesService.create(...)` and `await this.communitiesService.remove(...)`) in `create()` and `delete()` with `try...catch` blocks.
- Integrate a notification service or error display mechanism to inform the user if creating or deleting a community fails.
- Ensure the UI remains responsive and doesn't get stuck in a loading state upon error.
- Show loading feedback while communities and groups are being fetched.
- Show user-friendly error feedback when fetching communities or groups fails.
- Disable the create action while its request is in flight to prevent duplicate submissions.

## Objective 3: Optimise Rendering Performance for Data-Heavy Views

**Status**: To Do
**Consolidated Issues**:

- Implement Angular CDK Virtual Scrolling for Chat and Reading Views

**Description**:
Data-heavy components like `chat-page.component.ts` and `reading-engine.component.ts` currently lack virtual scrolling. Rendering large chat histories or extensive reading texts may cause DOM bloat, increased memory usage, and UI lag. Profile representative workloads first. If virtualisation is justified, integrate `@angular/cdk/scrolling` while preserving dynamic item heights, pagination, scroll position when prepending messages, keyboard navigation, search, selection and screen-reader access.

**Acceptance Criteria**:

- Record DOM-node count, frame time, and memory for representative article and chat histories before deciding whether virtualisation is justified, then compare the same workload after the change.
- Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
- Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
- Implement virtualised rendering or windowing in the reading components for extensive texts.
- Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
- Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
- Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.

## Objective 4: Optimise API Performance for Chat

**Status**: To Do
**Consolidated Issues**:

- N+1 API Request Explosion on Message Status Updates

**Description**:
In `chat-page.component.ts`, when a user selects a room, the component auto-marks unread messages from others as 'delivered' and then 'read' in a loop, firing two unawaited API calls per message (`this.chatService.markMessageStatus(msg.id, 'delivered')` and `this.chatService.markMessageStatus(msg.id, 'read')`). This causes an N+1 explosion of HTTP requests.

**Acceptance Criteria**:

- The two separate API calls per message are replaced with a single bulk update endpoint, or the backend logic is updated such that marking a message as 'read' automatically implies 'delivered'.
- The component only sends a single batched request for all unread message IDs.
- No race conditions or rate-limiting issues occur when loading a room with hundreds of unread messages.

## Objective 5: Improve Chat Correctness and Reliability

**Status**: To Do
**Consolidated Issues**:

- Redundant Message Deletion Logic in Centrifugo Event Handler
- Race Condition in Room Selection (Message Overwrite)
- Race Condition Permitting Duplicate Message Submissions

**Description**:
Fix three specific defects in `chat-page.component.ts`: redundant deletion handling, stale message responses when switching rooms quickly, and concurrent sends caused by repeated submission while a request is pending.

**Acceptance Criteria**:

- In `message_deleted` handler, the redundant `if` statement for 'deleted for me' vs 'everyone' is corrected or unified if behaviour is identical.
- A guard condition is added after `await this.chatService.getMessages(room.id)` to verify that `this.selectedRoom()?.id === room.id` before calling `this.messages.set(messages)` in `selectRoom`.
- Add an `isSending` signal and ignore additional `sendMessage()` calls while a send is in flight.
- Disable the message input and send button while `isSending()` is true, and reset the signal in a `finally` block.

## Objective 6: Architectural Enhancements for Language Learning Synergy

**Status**: To Do
**Consolidated Issues**:

- Architectural Enhancements for Language Learning Synergy

**Description**:
Core language learning principles are siloed. AI conversations don't feed the Spaced Repetition System (SRS).

**Acceptance Criteria**:

- Build a background worker in `nlp.service.ts` that automatically extracts and suggests new vocabulary (flashcards) from completed AI Conversations and Voice Transcriptions.
- Integrate the Pronunciation Scoring service with the SRS engine so a flashcard review can include an active-production voice test that grades spoken retrieval.
- Map the user's dynamic Assessment proficiency score to the LingQ Reading Engine so it highlights i+1 texts and scales tokenised difficulty appropriately.
- Modify the Visual Diff tool in Corrections to automatically queue corrected words into the user's flashcard deck for spaced repetition.

## Objective 7: Verify Conversation Analysis Request Resilience

**Status**: To Do
**Consolidated Issues**:

- Conversation analysis request lifecycle follow-up

**Description**:
The reported close-while-pending race is not reachable because the result close control appears only after a result exists. The remaining objective is to verify reachable lifecycle cases without weakening the paid operation's existing single-flight and idempotency protections.

**Acceptance Criteria**:

- Add focused coverage for route teardown, request failure, retry, and repeated activation while an analysis request is pending.
- Document the reachable sequence and expected behaviour before changing cancellation or route-transition semantics.
- Preserve payment idempotency and the existing single-flight guard in every tested path.

## Consolidation Notes

- The former primitive-tracking task is not carried forward because `chat-page.component.ts` already tracks messages with `track msg.id`.
- Duplicate virtual-scrolling and Communities reports have been merged into the objectives above.

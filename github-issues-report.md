# 📋 Consolidated Product Backlog

## Analysis of Open Issues
- **Completed:** None of the issues are completed yet in the current source tree.
- **Duplicates:** The CDK Virtual Scrolling issue in `github-issue-communities.md` is a duplicate of the one in `github-issues-report.md`.
- **Overly granular / Parts of the same larger objective:** Issues 1 through 5 (Multi-Pane Layout, Active State Visualization, Micro-interactions, Sub-components Refactoring, Error Handling) are overly granular and form part of the same complete user outcome: a "Complete Responsive Communities Experience".

## 👥 Communities & Groups
- **Complete Responsive Communities Experience**
  - Implement responsive three-pane layout (Communities sidebar, Groups sidebar, main chat area) and mobile drawer view.
  - Implement active state styling using Angular signals and Tailwind.
  - Add micro-interactions (hover effects) and unread notification badges.
  - Extract Communities list and creation form into dedicated sub-components.
  - Implement `try...catch` error handling and user feedback for community operations.

Suggested Labels: bug, performance, tech-debt, ui

# Issue 1: Revamp Communities UI and Navigation

## Title
feat(ui): implement comprehensive multi-pane layout and interactions for Communities

## Description
The current Communities UI lacks the structural complexity and interactive feedback required for a modern messaging application. To improve usability and scalability, the interface needs a comprehensive overhaul. This involves transitioning from a basic grid to a denser multi-pane layout (separating communities, groups, and content), adding distinct active states for navigation, introducing micro-interactions (hover effects, unread badges), and implementing robust error handling for user actions. To support these UI changes maintainably, the underlying component structure must also be refactored to extract forms and lists into dedicated sub-components.

## Acceptance Criteria
*   **Layout:** Refactor to a responsive three-pane layout on desktop (Communities sidebar, Groups sidebar, Main content) and a drawer/sliding pane on mobile.
*   **Refactoring:** Extract the community creation form and community list items into separate, reusable Angular components.
*   **Visual Feedback:** Implement distinct active states using Angular signals and Tailwind (e.g., `bg-surface-300`, left border) for selected items.
*   **Micro-interactions:** Add hover effects and unread notification badges to community list items.
*   **Error Handling:** Implement `try...catch` blocks for asynchronous operations (create/delete) with appropriate user-facing notifications.

## Suggested Labels
enhancement, ui/ux, refactoring

enhancement, ui/ux, medium-priority


# Issue 2: Enhance Active State Visualization in Communities UI

## Title
feat(ui): improve active state styling for selected communities/groups

## Description
Currently, there's no visual indication in the `communities.component.ts` inline template for the selected or active community. To improve the user experience and provide clear feedback on where they are within the navigation hierarchy, distinct active states need to be implemented using Angular signals and Tailwind CSS classes.

## Acceptance Criteria
*   Utilise Angular signals (e.g., `selectedCommunityId`) to track and apply distinct active styles.
*   Apply Tailwind classes like `bg-surface-300` and `border-l-4 border-indigo-500` to indicate the currently viewed community or group.

## Suggested Labels
enhancement, ui/ux, good-first-issue


# Issue 3: Add Micro-interactions and Notifications to Communities List

## Title
feat(ui): add hover effects and unread notification badges to communities list

## Description
The list items in the Communities view lack interactive feedback (hover effects) and indications of new activity (unread badges), which are standard in modern messaging applications. Adding these micro-interactions will significantly improve user engagement and awareness of updates.

## Acceptance Criteria
*   Introduce subtle hover effects (e.g., `hover:bg-surface-200`, `transition-colors duration-150`) on community list items.
*   Include unread notification badges for communities/groups with new activity, using a small, pill-shaped red div (`bg-red-500 text-white rounded-full px-1.5 text-[10px]`).

## Suggested Labels
enhancement, ui/ux, good-first-issue


# Issue 4: Technical Debt: Extracted Sub-components for Scalability

## Title
refactor(ui): extract Communities list and creation form into separate components

## Description
As the Communities UI transitions to a complex multi-pane layout, the `communities.component.ts` file will become overly large and difficult to maintain if all logic and templates are kept within a single component. Extracting parts of the UI, such as the community creation form and the community list itself, into dedicated, smaller components will improve readability, testability, and adherence to the Single Responsibility Principle.

## Acceptance Criteria
*   Create a separate component for the community creation form.
*   Create a separate component for rendering the community list item.
*   Refactor `communities.component.ts` to use these new components, passing data via `@Input` and handling events via `@Output`.

## Suggested Labels
tech-debt, refactoring, medium-priority


# Issue 5: Missing Error Handling in Community Creation/Deletion

## Title
bug(ui): implement error handling and user feedback for community operations

## Description
The `create()` and `delete()` methods in `communities.component.ts` are asynchronous but currently lack error handling (`try...catch` blocks). If an API request fails, the application might swallow the error or enter a broken state without providing any feedback to the user. Appropriate toast notifications or inline error messages should be displayed upon failure.

## Acceptance Criteria
*   Wrap asynchronous calls (`await this.communitiesService.create(...)` and `await this.communitiesService.remove(...)`) in `create()` and `delete()` with `try...catch` blocks.
*   Integrate a notification service or error display mechanism to inform the user if creating or deleting a community fails.
*   Ensure the UI remains responsive and doesn't get stuck in a loading state upon error.

## Suggested Labels
bug, error-handling, high-priority
# Issue 6: Performance Bug: Inefficient For-Loop Tracking in Chat Page

## Title
perf(chat): improve message rendering by tracking primitive IDs in chat loop

## Description
In `frontend/src/app/pages/chat/chat-page.component.ts`, the message loop uses `@for (msg of messages(); track msg)`. Tracking by the full object reference instead of a primitive unique ID means Angular cannot efficiently reuse DOM nodes when the `messages()` signal updates (e.g., when a new message arrives or status changes). This causes unnecessary DOM thrashing and performance degradation, especially in long chat histories.

## Acceptance Criteria
*   Update the `@for` loop in `chat-page.component.ts` to use `track msg.id` instead of `track msg`.
*   Ensure that new incoming messages do not cause the entire message list to re-render.

## Suggested Labels
bug, performance, ui


# Issue 7: Bug: Race Condition Permitting Duplicate Message Submissions

## Title
bug(chat): disable send button while message is sending to prevent duplicates

## Description
The `sendMessage()` method in `chat-page.component.ts` does not disable the submit button or input field while the asynchronous `this.chatService.sendMessage(...)` request is pending. If a user clicks the send button multiple times rapidly, it can trigger multiple concurrent network requests, resulting in duplicate messages being sent to the chat room.

## Acceptance Criteria
*   Introduce an `isSending` signal (boolean) in `ChatPageComponent`.
*   Set `isSending` to `true` at the start of `sendMessage()` and reset it to `false` in a `finally` block.
*   Disable the Send button and input field in the template when `isSending()` is true.

## Suggested Labels
bug, ui/ux


# Issue 8: Performance/Tech-Debt: N+1 Network Requests for Marking Messages Read

## Title
perf(chat): bulk update read receipts instead of N+1 individual requests

## Description
When a user selects a room in `chat-page.component.ts`, the component loops through all unread messages from others and makes two separate asynchronous network requests (`markMessageStatus`) for *every single message* (one for 'delivered', one for 'read'). In a room with many unread messages, this causes a severe N+1 request storm, heavily impacting network performance and potentially rate-limiting the client or overloading the backend.

## Acceptance Criteria
*   Refactor the `chat.service.ts` to support bulk status updates (e.g., `markMessagesStatus(messageIds: string[], status: string)`).
*   Update `selectRoom()` in `chat-page.component.ts` to gather all unread message IDs and send a single bulk request for 'delivered' and a single bulk request for 'read', or a combined bulk operation.
*   Ensure the local state is optimistically updated or updated once after the bulk request succeeds.

## Suggested Labels
bug, performance, tech-debt

## ⚙️ Platform & UI Architecture
- **Optimize Data-Heavy Views**
  - Implement virtual scrolling (`cdk-virtual-scroll-viewport`) for data-heavy chat and reading views to prevent DOM bloat and UI lag.



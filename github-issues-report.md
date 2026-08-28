# Issue 1: Implement Angular CDK Virtual Scrolling for High-Volume Data Views

## Title
feat(ui, performance): implement Angular CDK Virtual Scrolling for Chat and Reading Views

## Description
Data-heavy components such as `chat-page.component.ts` and `reading-engine.component.ts` currently render standard loops for large lists of messages or text nodes. This causes severe DOM bloat, increased memory usage, and UI lag, degrading performance on both mobile and desktop. Implementing `@angular/cdk/scrolling` will render only the visible viewport slice, fixing this architectural bottleneck.

## Acceptance Criteria
*   Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into `chat-page.component.ts` and `reading-engine.component.ts`.
*   Replace standard DOM loops with `<cdk-virtual-scroll-viewport>`.
*   Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
*   Verify scrolling backwards in chat accurately triggers pagination/loading without breaking viewport position.
*   Implement virtualised rendering or windowing in the reading components for extensive texts.
*   Write or update unit tests to verify that the virtual scroller correctly limits rendered DOM nodes.

## Suggested Labels
bug, performance, tech-debt, ui

# Issue 2: Comprehensive Multi-Pane Community Navigation Redesign

## Title
feat(ui, ux): comprehensive redesign of Communities UI to a modern multi-pane layout with robust interactions and error handling

## Description
The current Communities UI (`communities.component.ts`) lacks the spatial separation, visual cues, and structural scalability needed for modern real-time social applications. It currently uses a basic list, lacks active state indicators, has missing micro-interactions (like hover effects and unread badges), fails to handle API errors for CRUD operations, and suffers from tightly coupled logic within a single file. This objective encapsulates a full refactoring of the Communities page to solve all these issues simultaneously, creating an outcome where users experience a fast, intuitive, reliable, and scalable interface.

## Acceptance Criteria
*   **Layout Redesign:** Refactor the page using CSS Grid/Flexbox to create a responsive three-pane layout on desktop (Communities Sidebar, Groups Sidebar, Main Chat Content) and an off-canvas drawer/sliding pane for mobile.
*   **Active States:** Utilise Angular signals to apply distinct visual active states (e.g., `bg-surface-300`, `border-l-4 border-indigo-500`) to selected communities and groups.
*   **Micro-interactions:** Add hover states (e.g., `hover:bg-surface-200`) and unread notification badges (`bg-red-500 rounded-full`) to community list items.
*   **Component Extraction:** Extract the community creation form and the community list items into dedicated standalone components to improve maintainability and follow the Single Responsibility Principle.
*   **Error Handling:** Wrap all asynchronous calls (like creating or deleting a community) in `try...catch` blocks and display appropriate error notifications or toasts to the user.

## Suggested Labels
enhancement, ui/ux, tech-debt, error-handling

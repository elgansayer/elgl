Title: Implement Angular CDK Virtual Scrolling for Chat and Reading Views

Description:
A review of the frontend codebase shows that `@angular/cdk` is present in `package.json` (`^22.1.3`), but `cdk-virtual-scroll-viewport` is not implemented in data-heavy components such as `chat-page.component.ts` and `reading-engine.component.ts`. Without virtual scrolling, rendering large chat histories or extensive reading texts will cause severe DOM bloat, increased memory usage, and UI lag, ultimately degrading performance on mobile and desktop browsers.

Acceptance Criteria:
- [ ] Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
- [ ] Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
- [ ] Implement virtualised rendering or windowing in the reading components for extensive texts.
- [ ] Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
- [ ] Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
- [ ] Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.

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

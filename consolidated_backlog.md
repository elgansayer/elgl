# Consolidated Backlog

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
- Refactor `communities.component.ts` to use these new components, passing data via `@Input` and handling events via `@Output`.

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
Data-heavy components like `chat-page.component.ts` and `reading-engine.component.ts` currently lack virtual scrolling. Rendering large chat histories or extensive reading texts causes severe DOM bloat, increased memory usage, and UI lag, degrading performance on browsers. This objective integrates `@angular/cdk/scrolling` to replace standard rendering loops with `<cdk-virtual-scroll-viewport>`, implementing virtualized rendering/windowing.

**Acceptance Criteria**:
- Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
- Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
- Implement virtualised rendering or windowing in the reading components for extensive texts.
- Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
- Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
- Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.

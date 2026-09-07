# Consolidated Backlog

## Epic 1: High-Performance Data Rendering for Extensive Content
**Objective**: Ensure the application remains responsive and memory-efficient when displaying large datasets, specifically chat histories and extensive reading materials. This epic supersedes individual technical tasks related to virtual scrolling.

*   **Story 1.1**: Virtualized Chat History View
    *   **Description**: As a user with extensive conversation history, I need my chat interface to load quickly and scroll smoothly without lagging, so that I can easily navigate past messages.
    *   **Acceptance Criteria**:
        *   Integrate `ScrollingModule` from `@angular/cdk/scrolling` into `chat-page.component.ts`.
        *   Replace standard DOM loops with `<cdk-virtual-scroll-viewport>`.
        *   Ensure dynamic height recalculation supports text, media, and audio messages.
        *   Verify reverse pagination maintains viewport position.
        *   Add unit tests confirming DOM nodes are limited to the visible slice.

*   **Story 1.2**: Virtualized Reading Engine for Extensive Texts
    *   **Description**: As a user reading long articles or books, I want the reading interface to remain responsive and not consume excessive memory, regardless of the document's length.
    *   **Acceptance Criteria**:
        *   Integrate `ScrollingModule` from `@angular/cdk/scrolling` into `reading-engine.component.ts`.
        *   Implement virtualized rendering or windowing for the article list and reading view.
        *   Add unit tests confirming DOM nodes are limited to the visible slice.

## Epic 2: Redesign and Enhance Communities Navigation
**Objective**: Overhaul the Communities UI to align with modern social paradigms (like Discord/X), improving navigation, visual feedback, and code maintainability. This consolidates Issues 1, 2, 3, 4, and 5 into a cohesive product outcome.

*   **Story 2.1**: Multi-Pane Layout and Navigation Architecture
    *   **Description**: As a user managing multiple communities and groups, I need a dense, structured multi-pane layout to easily navigate between high-level communities and specific conversation channels.
    *   **Acceptance Criteria**:
        *   Refactor `communities.component.ts` using CSS Grid/Flexbox into a three-pane desktop layout (Communities sidebar, Groups sidebar, Main content area).
        *   Implement an off-canvas drawer or sliding pane view for mobile screens with smooth transitions.

*   **Story 2.2**: Enhanced Interactive Feedback and Active States
    *   **Description**: As a user navigating communities, I need clear visual indicators of where I am (active states), where I can click (hover effects), and where new activity has occurred (unread badges).
    *   **Acceptance Criteria**:
        *   Use Angular signals to track and apply distinct active styles (e.g., `bg-surface-300`, `border-l-4 border-indigo-500`) to the selected community/group.
        *   Add hover effects (e.g., `hover:bg-surface-200`) to list items.
        *   Implement unread notification badges (e.g., small red pills) for items with new activity.

*   **Story 2.3**: Robust Community Management Operations
    *   **Description**: As a user creating or deleting communities, I need reliable operations with clear feedback if an action fails, ensuring I am never left in a broken or confusing state.
    *   **Acceptance Criteria**:
        *   Extract the community creation form and list items into dedicated sub-components.
        *   Implement `try...catch` blocks in asynchronous operations (create, delete).
        *   Display appropriate toast notifications or inline error messages upon failure.
        *   Ensure the UI recovers gracefully from errors without getting stuck in loading states.

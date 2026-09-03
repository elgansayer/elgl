# Consolidated User Outcomes Backlog

## 1. Smooth Reading and Chat Experience
*As a user, I want the chat history and reading texts to scroll smoothly without lagging or freezing my device.*
- **Context:** The current implementations of the chat page and reading engine suffer from DOM bloat on long lists.
- **Technical Tasks:** Implement `@angular/cdk/scrolling` (`<cdk-virtual-scroll-viewport>`) in `chat-page.component.ts` and `reading-engine.component.ts`. Ensure dynamic height recalculation and reverse scrolling work accurately.

## 2. Intuitive and Interactive Communities Navigation
*As a user, I want to easily navigate between communities and groups, with clear visual indicators of my current location and new activity.*
- **Context:** The Communities UI needs an overhaul to resemble modern multi-pane messaging apps (like Discord) with better visual cues.
- **Technical Tasks:**
    - Implement a responsive multi-pane layout (left sidebar, secondary sidebar, main area) for `communities.component.ts`.
    - Apply active state styling (e.g., using `bg-surface-300`, `border-l-4`) and hover effects.
    - Add unread notification badges.
    - Extract sub-components (community list, creation form) for maintainability.
    - Add error handling (toast/inline messages) to community creation and deletion actions.

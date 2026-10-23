# Issue Backlog: Consolidated User Outcomes

## 1. Outcome: Optimize Large Data Rendering (Performance & UI)
**Objective**: Ensure the application remains responsive and memory-efficient when displaying extensive content histories on both mobile and desktop.

**Component Tasks**:
- Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into standalone components.
- Implement `<cdk-virtual-scroll-viewport>` in `chat-page.component.ts` to replace standard message loops.
- Implement virtualised rendering or windowing in `reading-engine.component.ts` for extensive texts.
- Ensure dynamic height recalculation handles varying content lengths (text, media, audio) accurately.
- Verify backward scrolling in chat triggers pagination/loading without losing viewport position.
- Write/update unit tests to verify the scroller limits rendered DOM nodes to the visible slice.

**Rationale**: Groups the technical chore of implementing Angular CDK virtual scrolling under the broader outcome of large data optimization, directly addressing performance lag and DOM bloat.

## 2. Outcome: Modernize Communities Navigation and Layout (UX/UI)
**Objective**: Transform the Communities UI into a denser, multi-pane layout to provide clear, persistent navigation between broad communities and specific groups, aligning with modern social paradigms (e.g., Discord).

**Component Tasks**:
- **Refactoring for Scalability**: Extract the community creation form and the community list item into dedicated components to simplify `communities.component.ts` and improve maintainability.
- **Layout Restructuring**: Implement a responsive CSS Grid/Flexbox three-pane layout (Communities sidebar, Groups sidebar, Chat/Content main area) on desktop.
- **Mobile Responsiveness**: Implement an off-canvas drawer or sliding pane view with Angular animations for mobile screens.
- **Visual Hierarchy & State**: Utilize Angular signals (e.g., `selectedCommunityId`) and Tailwind classes (e.g., `bg-surface-300`, `border-l-4 border-indigo-500`) to visually indicate the active community/group.
- **Micro-interactions & Notifications**: Add hover effects (`hover:bg-surface-200`) and unread notification badges (`bg-red-500`) to community list items to improve engagement.
- **Error Handling**: Wrap asynchronous `create()` and `delete()` operations in `try...catch` blocks and integrate appropriate toast notifications/error displays to prevent silent failures.

**Rationale**: Consolidates Issues 1 through 5. Instead of individual chores for layout, styling, component extraction, and error handling, these are now part of a single, coherent objective to completely overhaul the Communities user experience.

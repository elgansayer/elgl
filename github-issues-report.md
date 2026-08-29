# Consolidated Backlog: Core User Outcomes

## Outcome 1: Fluid Content Consumption (Chat & Reading)
**Title:** feat(performance): implement virtual scrolling for infinite content views
**Description:**
Rendering extensive DOM nodes in `chat-page.component.ts` and `reading-engine.component.ts` degrades performance on low-end devices. We must implement Angular CDK Virtual Scrolling to maintain a strict performance budget, avoiding severe memory bloat and UI lag.
**Acceptance Criteria:**
- Integrate `@angular/cdk/scrolling` (`cdk-virtual-scroll-viewport`) into `chat-page.component.ts` and `reading-engine.component.ts`.
- Ensure dynamic height recalculation supports variable content (text, audio, media).
- Verify reverse pagination in chat retains viewport stability without layout shift.
- Unit tests verify DOM nodes are constrained to the visible slice.
**Suggested Labels:** performance, ui, high-priority

## Outcome 2: Modern Real-time Social Navigation (Communities)
**Title:** feat(ui): implement multi-pane communities layout & engagement markers
**Description:**
The Communities UI (`communities.component.ts`) lacks modern spatial navigation and engagement feedback. This holistic update transforms the grid into a dense multi-pane layout (similar to Discord/X) while introducing essential active state markers, hover micro-interactions, unread badges, and missing error handling for network operations.
**Acceptance Criteria:**
- **Layout:** Refactor to a 3-pane responsive layout (left sidebar: Communities, middle: Groups, main: Chat). Implement an off-canvas drawer for mobile.
- **State & Feedback:** Apply Angular signals for active selection styling (`bg-surface-300`, `border-indigo-500`) and add unread notification badges (`bg-red-500`). Add hover transitions.
- **Error Handling:** Wrap `create()` and `delete()` async calls in `try...catch` blocks with appropriate UI toast/error notifications to prevent hanging states.
- **Architecture:** Extract the creation form and list items into dedicated sub-components to prevent `communities.component.ts` from becoming a monolithic anti-pattern.
**Suggested Labels:** enhancement, ui/ux, tech-debt, high-priority

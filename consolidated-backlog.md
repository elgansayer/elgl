# Consolidated Backlog

## Objective 1: Optimise Performance for Data-Heavy Views
**Supersedes/Consolidates:** "Implement Angular CDK Virtual Scrolling for Chat and Reading Views" (Duplicates found in `github-issues-report.md` and `github-issue-communities.md`)

### Description
Data-heavy components (like chat histories and reading texts) currently lack virtual scrolling, leading to DOM bloat and UI lag.

### Acceptance Criteria
- [ ] Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into standalone components like `chat-page.component.ts` and `reading-engine.component.ts`.
- [ ] Replace standard loops with `<cdk-virtual-scroll-viewport>`.
- [ ] Implement virtualised rendering or windowing for reading components.
- [ ] Support dynamic height recalculation for chat messages.
- [ ] Ensure backwards scrolling triggers pagination without losing viewport position.
- [ ] Update unit tests.

---

## Objective 2: Modernise Communities Navigation UI
**Supersedes/Consolidates:** Issues 1-5 from `github-issues-report.md` (Multi-pane layout, Active state visualization, Micro-interactions, Component extraction, and Error handling).

### Description
The Communities interface needs a comprehensive overhaul to align with modern social paradigms. This involves adopting a multi-pane layout, improving user feedback, and addressing technical debt.

### Acceptance Criteria
- [ ] Refactor `communities.component.ts` to a responsive three-pane layout (desktop) and off-canvas/sliding pane (mobile).
- [ ] Extract the community creation form and list items into dedicated, smaller components for better scalability.
- [ ] Implement distinct active state styling using Angular signals (e.g., `selectedCommunityId`) and Tailwind CSS (`bg-surface-300`, `border-l-4`, `border-indigo-500`).
- [ ] Add micro-interactions (e.g., `hover:bg-surface-200`) and unread notification badges.
- [ ] Implement robust error handling (`try...catch`) and user feedback (e.g., toast notifications) for asynchronous creation/deletion operations (`create()` and `delete()`).

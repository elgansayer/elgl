# 📋 Consolidated Product Backlog

_Organised by complete user outcomes rather than individual technical chores._

## 👥 Communities & Groups

- Complete Responsive Communities Experience (incorporates Three-Pane Layout, Active States, Mobile Drawer, Unread Badges, and Error Handling):
  - Refactor to responsive three-pane layout (Communities sidebar, Groups sidebar, main chat area) and mobile drawer view.
  - Implement active state styling (Angular signals, Tailwind classes) for selected communities/groups.
  - Add micro-interactions (hover effects) and unread notification badges.
  - Extract Communities list and creation form into separate components for scalability.
  - Implement error handling (`try...catch`) and user feedback for community creation and deletion.

## ⚙️ Platform, UI Architecture & Automation

- Implement virtual scrolling (cdk-virtual-scroll-viewport) for data-heavy chat and reading views to prevent DOM bloat and UI lag:
  - Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
  - Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
  - Implement virtualised rendering or windowing in the reading components for extensive texts.
  - Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
  - Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
  - Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.

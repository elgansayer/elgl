# Consolidated Backlog

## 1. Implement Angular CDK Virtual Scrolling for Chat and Reading Views
**User Outcome:** Users can scroll smoothly through extensive chat histories and long articles on any device without encountering UI lag, browser memory bloat, or page crashes.

**Included Technical Chores (Consolidated from open issues):**
- Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
- Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
- Implement virtualised rendering or windowing in the reading components for extensive texts.
- Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
- Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
- Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.

**Status Analysis:**
- Currently unstarted. Review of `chat-page.component.ts` and `reading-engine.component.ts` shows standard `@for` loops are being used to render data arrays. The `package.json` contains `@angular/cdk`, so the library is available for implementation.

## 2. Revamp Communities Experience: Multi-Pane Navigation and Enhanced UX
**User Outcome:** Users can intuitively navigate complex community structures through a dense, modern multi-pane interface featuring clear active states, interactive feedback, and robust error handling.

**Included Technical Chores (Consolidated from granular issues 1-5):**
- **UI/UX Re-architecture (Supersedes Issues 1, 2, 3):** Refactor the page using CSS Grid or Flexbox to create a responsive three-pane layout on desktop: a narrow left sidebar for Communities, a secondary sidebar for Groups within the selected community, and a main central area for the active chat/content. Implement an off-canvas drawer or a sliding pane view for mobile screens to ensure the complex navigation doesn't overwhelm smaller devices, possibly leveraging Angular animations for smooth pane transitions. Utilise Angular signals (e.g., `selectedCommunityId`) to track and apply distinct active styles. Apply Tailwind classes like `bg-surface-300` and `border-l-4 border-indigo-500` to indicate the currently viewed community or group. Introduce subtle hover effects (e.g., `hover:bg-surface-200`, `transition-colors duration-150`) on community list items. Include unread notification badges for communities/groups with new activity, using a small, pill-shaped red div (`bg-red-500 text-white rounded-full px-1.5 text-[10px]`).
- **Error Handling (Supersedes Issue 5):** Wrap asynchronous calls (`await this.communitiesService.create(...)` and `await this.communitiesService.remove(...)`) in `create()` and `delete()` with `try...catch` blocks. Integrate a notification service or error display mechanism to inform the user if creating or deleting a community fails. Ensure the UI remains responsive and doesn't get stuck in a loading state upon error.
- **Refactoring for Scalability (Supersedes Issue 4):** Create a separate component for the community creation form. Create a separate component for rendering the community list item. Refactor `communities.component.ts` to use these new components, passing data via `@Input` and handling events via `@Output`.

**Status Analysis:**
- These issues are currently unstarted but overly granular and represent pieces of the same larger UI revamp for the Communities feature. The current `communities.component.ts` lacks the multi-pane layout, error handling `try...catch` blocks on API calls, extracted components, and detailed active/hover states.
- The duplicate issue file `github-issue-communities.md` can be removed or archived, as all information is captured in this consolidated objective and the main report.

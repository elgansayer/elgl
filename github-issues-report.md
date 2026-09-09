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
# Issue 1: Implement Denser Multi-Pane Layout for Communities

## Title
feat(ui): implement multi-pane layout for Communities navigation

## Description
The current Communities UI in `communities.component.ts` employs basic grid layouts and standard lists, lacking clear spatial navigation between broad communities and their specific groups/channels. To align with modern real-time social paradigms like Discord and X, the interface should adopt a denser but highly readable multi-pane layout. This approach separates top-level communities from specific conversational groups, providing clear, persistent navigation and unmistakable active states.

## Acceptance Criteria
*   Refactor the page using CSS Grid or Flexbox to create a responsive three-pane layout on desktop: a narrow left sidebar for Communities, a secondary sidebar for Groups within the selected community, and a main central area for the active chat/content.
*   Implement an off-canvas drawer or a sliding pane view for mobile screens to ensure the complex navigation doesn't overwhelm smaller devices, possibly leveraging Angular animations for smooth pane transitions.

## Suggested Labels
enhancement, ui/ux, medium-priority


# Issue 2: Enhance Active State Visualization in Communities UI

## Title
feat(ui): improve active state styling for selected communities/groups

## Description
Currently, there's no visual indication in the `communities.component.ts` inline template for the selected or active community. To improve the user experience and provide clear feedback on where they are within the navigation hierarchy, distinct active states need to be implemented using Angular signals and Tailwind CSS classes.

## Acceptance Criteria
*   Utilise Angular signals (e.g., `selectedCommunityId`) to track and apply distinct active styles.
*   Apply Tailwind classes like `bg-surface-300` and `border-l-4 border-indigo-500` to indicate the currently viewed community or group.

## Suggested Labels
enhancement, ui/ux, good-first-issue


# Issue 3: Add Micro-interactions and Notifications to Communities List

## Title
feat(ui): add hover effects and unread notification badges to communities list

## Description
The list items in the Communities view lack interactive feedback (hover effects) and indications of new activity (unread badges), which are standard in modern messaging applications. Adding these micro-interactions will significantly improve user engagement and awareness of updates.

## Acceptance Criteria
*   Introduce subtle hover effects (e.g., `hover:bg-surface-200`, `transition-colors duration-150`) on community list items.
*   Include unread notification badges for communities/groups with new activity, using a small, pill-shaped red div (`bg-red-500 text-white rounded-full px-1.5 text-[10px]`).

## Suggested Labels
enhancement, ui/ux, good-first-issue


# Issue 4: Technical Debt: Extracted Sub-components for Scalability

## Title
refactor(ui): extract Communities list and creation form into separate components

## Description
As the Communities UI transitions to a complex multi-pane layout, the `communities.component.ts` file will become overly large and difficult to maintain if all logic and templates are kept within a single component. Extracting parts of the UI, such as the community creation form and the community list itself, into dedicated, smaller components will improve readability, testability, and adherence to the Single Responsibility Principle.

## Acceptance Criteria
*   Create a separate component for the community creation form.
*   Create a separate component for rendering the community list item.
*   Refactor `communities.component.ts` to use these new components, passing data via `@Input` and handling events via `@Output`.

## Suggested Labels
tech-debt, refactoring, medium-priority


# Issue 5: Missing Error Handling in Community Creation/Deletion

## Title
bug(ui): implement error handling and user feedback for community operations

## Description
The `create()` and `delete()` methods in `communities.component.ts` are asynchronous but currently lack error handling (`try...catch` blocks). If an API request fails, the application might swallow the error or enter a broken state without providing any feedback to the user. Appropriate toast notifications or inline error messages should be displayed upon failure.

## Acceptance Criteria
*   Wrap asynchronous calls (`await this.communitiesService.create(...)` and `await this.communitiesService.remove(...)`) in `create()` and `delete()` with `try...catch` blocks.
*   Integrate a notification service or error display mechanism to inform the user if creating or deleting a community fails.
*   Ensure the UI remains responsive and doesn't get stuck in a loading state upon error.

## Suggested Labels
bug, error-handling, high-priority

# Issue 6: N+1 API request burst on application startup for chat unread counts

## Title
bug(performance): resolve N+1 API request burst when calculating initial chat unread counts

## Description
In `frontend/src/app/app.component.ts`, the `loadInitialUnreadCounts()` method determines the total unread chat messages for the current user by fetching all chat rooms, and then iterating over each room to fetch all its messages (in batches of 6). It calculates the unread count on the client side by filtering the messages.

This causes a severe N+1 query problem on the frontend. A user with 100 chat rooms will trigger 1 request to `/rooms` followed by 100 requests to `/messages/:roomId` immediately upon application load. This degrades startup performance, increases memory footprint, needlessly burdens the backend, and is not scalable as the user's room history grows.

## Acceptance Criteria
* Add a new endpoint to the backend (e.g., `GET /chat/unread-count`) that executes a single optimised database query to calculate the total unread chat messages for the current user.
* Alternatively, include the unread count per room in the response payload of the existing `GET /chat/rooms` endpoint.
* Update `loadInitialUnreadCounts()` in `app.component.ts` to use the new optimised API endpoint instead of fetching and looping through all messages for every room.
* Remove the batched `getMessages` client-side API requests from the startup sequence in `app.component.ts`.
* Ensure unit tests for `app.component.ts` and the updated backend service verify the new unread count fetching logic.

## Suggested Labels
bug, performance, tech-debt

# Issue 1: bug(ui): Implement Error Handling for Community Operations

## Title
bug(ui): Implement Error Handling for Community Operations

## Description
The `create()` and `delete()` methods in `communities.component.ts` are asynchronous but currently lack error handling (`try...catch` blocks). If an API request fails, the application might swallow the error or enter a broken state without providing any feedback to the user. Appropriate toast notifications or inline error messages should be displayed upon failure.

## Acceptance Criteria
* Wrap asynchronous calls (`await this.communitiesService.create(...)` and `await this.communitiesService.remove(...)`) in `create()` and `delete()` with `try...catch` blocks.
* Integrate a notification service or error display mechanism to inform the user if creating or deleting a community fails.
* Ensure the UI remains responsive and doesn't get stuck in a loading state upon error.

## Suggested Labels
bug, error-handling, high-priority


# Issue 2: tech-debt(ui): Extract Communities List and Creation Form into Separate Components

## Title
tech-debt(ui): Extract Communities List and Creation Form into Separate Components

## Description
The `communities.component.ts` file will become overly large and difficult to maintain if all logic and templates are kept within a single component. Extracting parts of the UI, such as the community creation form and the community list itself, into dedicated, smaller components will improve readability, testability, and adherence to the Single Responsibility Principle.

## Acceptance Criteria
* Create a separate component for the community creation form.
* Create a separate component for rendering the community list item.
* Refactor `communities.component.ts` to use these new components, passing data via `@Input` and handling events via `@Output`.

## Suggested Labels
tech-debt, refactoring, medium-priority


# Issue 3: feat(ui): Improve Active State Styling for Selected Communities/Groups

## Title
feat(ui): Improve Active State Styling for Selected Communities/Groups

## Description
Currently, there's no visual indication in the `communities.component.ts` inline template for the selected or active community. To improve the user experience and provide clear feedback on where they are within the navigation hierarchy, distinct active states need to be implemented using Angular signals and Tailwind CSS classes.

## Acceptance Criteria
* Utilise Angular signals (e.g., `selectedCommunityId`) to track and apply distinct active styles.
* Apply Tailwind classes like `bg-surface-300` and `border-l-4 border-indigo-500` to indicate the currently viewed community or group.

## Suggested Labels
enhancement, ui/ux, good-first-issue


# Issue 4: feat(ui): Add Hover Effects and Unread Notification Badges to Communities List

## Title
feat(ui): Add Hover Effects and Unread Notification Badges to Communities List

## Description
The list items in the Communities view lack interactive feedback (hover effects) and indications of new activity (unread badges), which are standard in modern messaging applications. Adding these micro-interactions will significantly improve user engagement and awareness of updates.

## Acceptance Criteria
* Introduce subtle hover effects (e.g., `hover:bg-surface-200`, `transition-colors duration-150`) on community list items.
* Include unread notification badges for communities/groups with new activity, using a small, pill-shaped red div (`bg-red-500 text-white rounded-full px-1.5 text-[10px]`).

## Suggested Labels
enhancement, ui/ux, good-first-issue


# Issue 5: bug(ui/perf): Implement Angular CDK Virtual Scrolling for Chat and Reading Views

## Title
bug(ui/perf): Implement Angular CDK Virtual Scrolling for Chat and Reading Views

## Description
A review of the frontend codebase shows that `@angular/cdk` is present in `package.json`, but `cdk-virtual-scroll-viewport` is not implemented in data-heavy components such as `chat-page.component.ts` and `reading-engine.component.ts` which use standard `@for` loops to render messages and articles. Without virtual scrolling, rendering large chat histories or extensive reading texts will cause severe DOM bloat, increased memory usage, and UI lag, ultimately degrading performance on mobile and desktop browsers.

## Acceptance Criteria
* Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
* Replace standard `@for` loops rendering chat messages and reading articles with `<cdk-virtual-scroll-viewport>`.
* Ensure dynamic height recalculation works correctly for chat messages with varying content lengths.
* Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.

## Suggested Labels
bug, performance, tech-debt, ui

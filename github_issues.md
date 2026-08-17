# GitHub Issues for Communities UI Improvements

## Issue 1: Fix Angular 19 `resource` untracked context bug in `groupsResource`

**Description**
In `CommunitiesComponent` (`frontend/src/app/pages/communities/communities.component.ts`), the `groupsResource` relies on reading the `selectedCommunityId()` signal directly inside its `loader` function. In Angular v19, the `loader` of the `resource` API executes in an untracked context. This means the resource will not automatically re-evaluate and fetch new groups when the selected community changes.

**Acceptance Criteria**
- Refactor `groupsResource` to pass the `selectedCommunityId` signal to the `request` property of the resource options.
- Update the `loader` function to accept the request value and use it to fetch groups.
- Ensure that selecting a new community correctly triggers a new network request to load its respective groups.

**Suggested Labels**
- bug
- angular
- state-management

---

## Issue 2: Resolve accessibility interaction debt on community list items

**Description**
The current `CommunitiesComponent` template (`frontend/src/app/pages/communities/communities.component.html`) uses a non-interactive `<div>` element with a `(click)` event handler to allow users to select a community. This is inaccessible to keyboard and screen-reader users, violating our accessibility guidelines and technical standards.

**Acceptance Criteria**
- Replace the `<div>` used for community items with a native `<button>` element, OR apply the `appA11yClickable` directive from `A11yClickableDirective`.
- Ensure the interactive element receives visible focus when navigating via keyboard.
- Ensure the element can be activated using both the Space and Enter keys.
- Add an appropriate `aria-label` or ensure the text content clearly describes the action.

**Suggested Labels**
- tech-debt
- accessibility
- a11y
- ui

---

## Issue 3: Add error handling and loading states to Communities UI

**Description**
The current `CommunitiesComponent` handles data fetching via Angular signals/resources but lacks explicit user feedback for loading states and error conditions. For example, there is no indication when communities or groups are being fetched, and network failures during community creation are not handled or displayed to the user.

**Acceptance Criteria**
- Add loading indicators (e.g., spinners or skeleton loaders) to the UI to indicate when `communitiesResource` and `groupsResource` are loading (using `communitiesResource.isLoading()` and `groupsResource.isLoading()`).
- Implement a `try/catch` block around the `communitiesService.create()` call in `createCommunity()`.
- Display user-friendly error messages (e.g., via a toast service) if fetching communities/groups fails or if community creation fails.
- Disable the "Create" button and show a loading state while the creation request is in flight to prevent duplicate submissions.

**Suggested Labels**
- enhancement
- ux
- error-handling

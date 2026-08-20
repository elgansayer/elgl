# Communities UI Component Audit Report

## Issue 1: Prevent Empty State Flash During Initial Data Load

**Description**
The `CommunitiesComponent` binds the list of communities to `communitiesResource.value() ?? []`. When the component first loads and the `resource` is in a pending state, the value is undefined, causing it to fall back to an empty array. This triggers the `@empty` block in the template (`<li class="col-span-full ...">{{ 'communities.empty' | t }}</li>`), briefly showing the "no communities" message to the user before the actual data arrives.

**Acceptance Criteria**
- Display a loading skeleton or spinner while `communitiesResource.isLoading()` is true.
- Only show the empty state message when the resource has finished loading and the resulting array is actually empty.

**Suggested Labels**
- bug
- ui
- ux

## Issue 2: Add Confirmation Dialog for Community Deletion

**Description**
Currently, clicking the "Delete" button on a community card triggers the `delete()` method and instantly calls the backend (`await this.communitiesService.remove(id)`). This poses a significant risk of accidental data loss as there is no confirmation step. We need to implement a confirmation dialog to verify the user's intent before proceeding with the deletion.

**Acceptance Criteria**
- Integrate a Spartan Helm dialog primitive (`HlmDialog` or similar) to prompt the user for confirmation when they click "Delete".
- The dialog should clearly state the name of the community being deleted and warn that the action is irreversible.
- Proceed with the deletion only if the user confirms; otherwise, dismiss the dialog without taking action.

**Suggested Labels**
- enhancement
- ux

## Issue 3: Prevent Double Submissions and Add Loading State to Create Community Form

**Description**
The community creation form lacks visual feedback during the submission process. When `create()` is called, the "Create" button remains enabled while the asynchronous backend request is in flight. This can lead to users clicking the button multiple times, resulting in duplicate communities and unnecessary API calls.

**Acceptance Criteria**
- Add an `isCreating` signal to track the form submission state.
- Disable the "Create" button and the form inputs while a creation request is in progress.
- Optionally, change the button text or display a small spinner inside the button to indicate the loading state.

**Suggested Labels**
- bug
- ui

## Issue 4: Implement Error Handling and User Feedback (Toasts) for Community Actions

**Description**
The `create()` and `delete()` methods in `CommunitiesComponent` perform asynchronous network requests without `try/catch` blocks. If the backend fails (e.g., network error, server error), the promise rejection is unhandled, and the user is left unaware of the failure. Additionally, successful actions lack positive reinforcement.

**Acceptance Criteria**
- Wrap the async calls in `create()` and `delete()` with `try/catch` blocks.
- Import the standalone `showToast` function from `src/app/services/toast.service.ts` and use it to display an error message if an action fails.
- Display a success toast when a community is successfully created or deleted.
- Ensure the form inputs are not cleared if the creation request fails.

**Suggested Labels**
- bug
- tech-debt

## Issue 5: Integrate AbortSignal for Communities Resource Loader

**Description**
The `communitiesResource` uses a loader function to fetch the user's communities: `loader: () => this.communitiesService.listMine()`. However, it does not utilize the `AbortSignal` provided by the Angular `resource` API. If the resource is reloaded multiple times in quick succession, previous in-flight requests are not cancelled, leading to potential race conditions and wasted bandwidth.

**Acceptance Criteria**
- Update the `loader` function in `communitiesResource` to accept the `{ abortSignal }` parameter.
- Pass the `abortSignal` to the `CommunitiesService.listMine(abortSignal)` method.
- Update `CommunitiesService` (if necessary) to forward the `AbortSignal` to the underlying HTTP client.

**Suggested Labels**
- tech-debt
- optimisation

## Issue 6: Add Error State Handling for Communities Resource

**Description**
The component handles the loaded state and implicitly the empty state via `?? []`, but it completely ignores the error state of the `communitiesResource`. If `communitiesService.listMine()` fails, the UI will just display an empty list or be stuck loading without any indication that something went wrong.

**Acceptance Criteria**
- Check `communitiesResource.error()` or `communitiesResource.status()`.
- Display a user-friendly error message within the `<section>` if the resource fails to load.
- Provide a "Retry" button that calls `communitiesResource.reload()`.

**Suggested Labels**
- bug
- ui

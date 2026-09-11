Title: bug(ui): missing error handling and user feedback in Community operations

Description:
A review of `communities.component.ts` reveals that the `create()` and `delete()` methods lack proper error handling when making asynchronous calls to `communitiesService.create(...)` and `communitiesService.remove(...)`. Currently, if these API requests fail (e.g., due to a network issue, server error, or validation failure), the errors are unhandled, no feedback is provided to the user, and the UI may enter an inconsistent state without reloading the communities resource.

Acceptance Criteria:
- [ ] Wrap the `await this.communitiesService.create(...)` call inside `create()` in a `try...catch` block.
- [ ] Wrap the `await this.communitiesService.remove(...)` call inside `delete()` in a `try...catch` block.
- [ ] Provide appropriate user feedback upon failure (e.g., logging an error, displaying an error message via a toast notification service).
- [ ] Ensure that failures in these operations do not break the component's state or prevent future attempts.

Suggested Labels: bug, error-handling, ui, high-priority

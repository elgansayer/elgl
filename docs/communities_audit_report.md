# Communities Component UI & UX Audit Report

This report consolidates the two concurrent communities UI audit variants that diverged while this pull request was open. Duplicate findings are merged so the audit preserves all unique recommendations without reintroducing stale generated build artefacts.

## Issue 1: Replace direct Spartan Helm imports with Relay primitives

**Description**
The `CommunitiesComponent` currently imports and uses `HlmInput` and `HlmButton` directly. According to `docs/spartan-relay-architecture.md`, feature surfaces should use Relay presentation primitives rather than importing Spartan Brain/Helm directly.

**Acceptance Criteria**
- Remove direct imports for `HlmInput` and `HlmButton`.
- Import and use `AppInputComponent` instead of `hlmInput` for the form inputs.
- Import and use `AppButtonPrimaryComponent` instead of `hlmBtn` for buttons.
- Ensure styling boundaries are respected through Relay configuration rather than feature-owned Helm styling.

**Suggested Labels**
- tech-debt
- ui
- architectural-compliance

## Issue 2: Prevent the empty-state flash during initial loading

**Description**
The communities list defaults to an empty array while `communitiesResource` is still pending. The template can therefore render the `@empty` state before the request completes, briefly telling the user that there are no communities even though data is still loading.

**Acceptance Criteria**
- Display a loading skeleton or spinner while `communitiesResource.isLoading()` is true.
- Render the empty state only after loading has completed successfully and the returned list is actually empty.

**Suggested Labels**
- bug
- ui
- ux

## Issue 3: Add client-side validation for an empty create form

**Description**
The create form leaves the submit action enabled even when the required community name is empty. Although `create()` currently returns early for an empty name, the UI gives no immediate indication that the form cannot be submitted.

**Acceptance Criteria**
- Disable the create action when `newName` is empty or whitespace-only.
- Provide an immediate visual cue that the form is not submittable until the required field is valid.

**Suggested Labels**
- enhancement
- ux
- good-first-issue

## Issue 4: Add a confirmation dialog for community deletion

**Description**
Clicking Delete currently invokes the backend removal immediately. This creates unnecessary accidental-data-loss risk.

**Acceptance Criteria**
- Prompt for confirmation before deleting a community using the repository-owned Relay/Spartan dialog boundary.
- Clearly identify the community and explain that deletion is irreversible.
- Call the deletion API only after explicit confirmation; cancellation must make no mutation.

**Suggested Labels**
- enhancement
- ux

## Issue 5: Prevent duplicate community creation and expose pending state

**Description**
The create form remains interactive while its asynchronous request is in flight. Rapid repeated activation can therefore produce duplicate requests and potentially duplicate communities.

**Acceptance Criteria**
- Track creation state explicitly, for example with an `isCreating` signal.
- Disable the create action while a request is pending.
- Prevent duplicate submission deterministically.
- Keep the pending state accessible and visible without relying on animation alone.

**Suggested Labels**
- bug
- ui

## Issue 6: Add explicit success and failure feedback for community mutations

**Description**
The create and delete paths do not provide robust user-facing failure handling, and failed creation must not destroy the user's draft input.

**Acceptance Criteria**
- Handle rejected create and delete requests explicitly.
- Show a user-safe error notification when a mutation fails.
- Show success feedback after a committed create or delete.
- Preserve create-form input when creation fails.
- Avoid exposing backend/provider details in user-facing errors.

**Suggested Labels**
- bug
- tech-debt

## Issue 7: Propagate AbortSignal through the communities resource loader

**Description**
The communities resource loader does not currently propagate the `AbortSignal` supplied by Angular's resource API. Superseded reloads may therefore continue unnecessarily and can race with newer requests.

**Acceptance Criteria**
- Accept the resource loader's `abortSignal`.
- Pass it through `CommunitiesService.listMine(...)`.
- Forward cancellation through the underlying HTTP boundary where supported.
- Ensure cancellation is not surfaced as a normal user-visible load failure.

**Suggested Labels**
- tech-debt
- optimisation

## Issue 8: Add an explicit communities load-error state with retry

**Description**
The component handles loaded and empty data but does not provide a dedicated UI when `communitiesResource` fails. A failed request can therefore appear indistinguishable from an empty result.

**Acceptance Criteria**
- Read `communitiesResource.error()` or the resource status explicitly.
- Render a user-friendly error state when loading fails.
- Provide an accessible Retry action that invokes `communitiesResource.reload()`.
- Keep the error state distinct from the genuine empty state.

**Suggested Labels**
- bug
- ui

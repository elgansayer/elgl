# Communities Component UI & UX Audit Report

## Issue 1: Replace direct Spartan Helm imports with Relay primitives
**Description:**
The `CommunitiesComponent` currently imports and uses `HlmInput` and `HlmButton` directly. According to the `docs/spartan-relay-architecture.md` guidelines, feature surfaces should use Relay presentation primitives rather than importing Spartan Brain/Helm directly.

**Acceptance Criteria:**
* Remove direct imports for `HlmInput` and `HlmButton`.
* Import and use `AppInputComponent` instead of `hlmInput` for the form inputs.
* Import and use `AppButtonPrimaryComponent` instead of `hlmBtn` for buttons.
* Ensure styling boundaries are respected via Relay configurations instead of direct class manipulations meant for Helm components.

**Suggested Labels:**
* tech-debt
* ui
* architectural-compliance

---

## Issue 2: Fix Flash of Empty State (FOES) while data is loading
**Description:**
The `communities` property is a computed signal (`computed(() => this.communitiesResource.value() ?? [])`) that defaults to an empty array when the data is not yet loaded. In the template, `@if (communities(); as list)` with `@empty` treats this initial empty array as a true empty state. This causes a confusing Flash of Empty State (FOES) displaying "communities.empty" while `communitiesResource` is still loading the data.

**Acceptance Criteria:**
* Update the loading logic so the `@empty` block is only rendered if the `communitiesResource` has successfully completed loading and returned zero items.
* Implement a loading skeleton or spinner while `communitiesResource.isLoading()` is true.

**Suggested Labels:**
* bug
* ui
* ux

---

## Issue 3: Add client-side validation for empty submission form
**Description:**
The create form allows users to click the "Create" submit button even when the required "Name" field is completely empty. Although the `create()` method in the component checks if `name` is empty and early-returns, the submit button itself is never disabled. This provides a poor user experience as there's no visual feedback indicating the form is incomplete before clicking.

**Acceptance Criteria:**
* Disable the form submit button dynamically when the `newName` signal contains an empty string or whitespace only.
* Provide an immediate visual cue that the form is not submittable until the required field is filled.

**Suggested Labels:**
* enhancement
* ux
* good-first-issue
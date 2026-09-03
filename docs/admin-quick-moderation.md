# Admin quick moderation

Issue: #1412

## Scope

The quick moderation surface exposes the existing capability-protected Ban and Warn mutations directly beside each listed user. The actions remain intentionally one-click operations: the browser does not invent local moderation state and a success is shown only after the authenticated backend confirms the mutation.

The server remains authoritative. Both endpoints are protected by Supabase authentication, `AdminGuard`, and the `moderation.cases.manage` capability before `AdminService` performs the mutation. The frontend does not treat a rejected, unavailable, or unauthorized request as success.

## Interaction contract

- Ban and Warn are native Spartan buttons with an explicit target-specific accessible name.
- A mutation locks both moderation controls for that user until the request settles. Rapid clicks and competing Ban/Warn clicks therefore cannot create duplicate or conflicting in-flight requests.
- After a successful action, that same action remains disabled for the current view so an accidental second click cannot repeat it. Reloading the authoritative user list resets this ephemeral UI state.
- A failed request becomes retryable immediately.
- Existing localized success and failure strings are announced through an in-row live region as well as the application toast. Provider/database error text is never reflected into the page.
- User display names are rendered through Angular text interpolation, not an HTML sanitizer or HTML sink. `dir="auto"` preserves mixed-direction names.
- Both action controls retain a minimum 44 px interaction target for touch and high-zoom operation.

## Security and privacy

The frontend is convenience UI only. It cannot grant moderation capability and must not be used as an authorization boundary. The backend capability checks and admin audit pipeline remain authoritative.

No user content, access token, provider response, or raw moderation error is added to diagnostics by this change. Only existing localized outcome text is displayed. Mutation state is held in memory and is not written to local storage.

## Failure handling

A failed Ban or Warn operation clears the in-flight lock, announces the localized failure, and leaves the action available for an explicit retry. A successful operation is never inferred from optimistic state. Independent users can still be moderated concurrently while actions for a single user are serialized.

## Verification

Focused Angular regression coverage verifies duplicate-click suppression, same-user Ban/Warning serialization, successful completion state, retry behavior after failures, sanitized failure feedback, and rejection of empty identifiers. Repository CI remains the clean-environment authority for the full frontend and backend contract suites.

## Rollout and rollback

No schema, API, configuration, or persisted-data migration is required. Deploy as a normal frontend release after the existing moderation endpoints are available.

Rollback by reverting the component and its focused test/documentation changes. Backend Ban/Warn endpoints and audit records are unaffected, and no client-side migration or cleanup is necessary.

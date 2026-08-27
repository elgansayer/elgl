# External profile actions

Issue #1238 is implemented by the existing `UserDetailComponent` external-profile action surface and the canonical relationship/direct-conversation services.

## Behaviour

- External profiles expose **Follow/Following** and **Send Message** actions. The current user's own profile exposes neither action.
- Follow/unfollow uses `ProfileRelationshipService`. The UI prevents duplicate mutations, optimistically reflects the requested state, and restores the previous state with a retryable generic error if persistence fails.
- Send Message uses `DirectConversationService.openOrCreate()` and navigates only to the server-authoritative room returned by `POST /chat/direct-conversations`.
- Repeated Send Message activation is suppressed while a conversation request is in flight. Provider or navigation failures leave the profile visible and expose a retryable status instead of navigating to an invented room.

## Security and privacy

The backend remains authoritative for relationship and room authorization. The direct-conversation client now fails closed before network access when the target identifier is malformed or there is no authenticated access token. Returned room identifiers are treated as untrusted and must be UUID v4 values before they are used for navigation.

No message text, profile content, access token, target identifier, or provider error is added to application logs by these actions. The action state is presentation state only; relationship and room membership remain server-owned.

## Accessibility and failure handling

Follow and Send Message are native button interactions through the Spartan button directive. Pending actions are disabled and expose `aria-busy`; failures are associated with polite status regions. The external-profile page remains usable when either mutation fails.

## Verification

Focused regression coverage lives in:

- `frontend/src/app/components/user-detail/user-detail.actions.spec.ts`
- `frontend/src/app/services/direct-conversation.service.spec.ts`

The tests lock external-versus-own-profile visibility, follow/unfollow success and rollback, canonical direct-room navigation, retryable chat failure, authenticated request headers, malformed target rejection, and malformed room-response rejection. Repository CI remains authoritative for the full Angular build, lint, unit, accessibility/design governance, and E2E suites.

## Rollout and rollback

This is a frontend contract hardening only. It requires no migration, feature flag, or coordinated backend deployment because the authenticated direct-conversation and relationship endpoints already exist.

Rollback is a normal code revert. Do not restore the previous empty-Bearer behavior or navigate using unvalidated room identifiers; those weaken the existing authenticated action boundary.

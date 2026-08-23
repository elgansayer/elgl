# External profile message and follow actions

Issue #1238 makes the primary actions on another learner's profile authoritative instead of treating a user id as a chat room id.

## User flow

The external profile keeps **Follow / Following** and **Message** as direct actions. Follow changes are server-first: the label changes only after the existing follow API confirms the mutation. While a follow request is pending, duplicate follow/message actions are disabled. A failed mutation preserves the previous state and exposes a retryable error without printing provider details.

Message calls `POST /chat/direct-rooms` with the selected profile id. The backend returns the existing two-member room or atomically creates one, after which Angular navigates to `/chat/:roomId`. The UI never constructs a chat route from a user id.

## Authorization, privacy, and abuse resistance

- `SupabaseAuthGuard` protects direct-room creation and the endpoint is throttled to 20 requests per minute.
- The DTO accepts only UUID partner ids; self-chat attempts are rejected.
- The backend verifies that the partner exists and fails closed if the safety/block relationship cannot be checked.
- A learner cannot open a direct room with a user they have blocked or who has blocked them.
- Creating a room does not bypass initial-message privacy filters. The existing `ChatService.sendMessage` path remains authoritative when content is actually sent.
- Logs contain only stable operation names and provider error codes. User ids, tokens, profile text, and message content are not logged by this flow.

## Concurrency and persistence

`get_or_create_direct_chat` runs as a service-role-only PostgreSQL function. It takes a transaction-scoped advisory lock on the sorted pair of user ids, rechecks for an existing room with exactly two members, and creates the room plus both memberships in the same transaction only when necessary. Concurrent API instances therefore converge on one room. The API service also deduplicates identical in-flight requests within a single process.

The function returns room ids as text because the repository has historical deployments with both TEXT and UUID room identifiers. The insert path detects the deployed `chat_rooms.id` type and membership insertion selects the id back from `chat_rooms`, avoiding a destructive schema conversion in this feature.

The function is revoked from `anon` and `authenticated`; browsers must use the guarded API. No new user-content table or retention category is introduced. Direct rooms and messages keep the repository's existing deletion/retention behavior.

## Failure behavior

- missing target: `404` and no room is created;
- self target: `400` and no persistence occurs;
- blocked relationship: `403` and no room is created;
- safety/datastore/RPC failure: stable `503`, no guessed room id and no client navigation;
- malformed RPC result: stable `503`;
- follow failure: current follow state is retained and the action can be retried;
- route navigation failure: the profile stays open and exposes retry feedback.

Because room creation and membership writes share one PostgreSQL transaction, a failure cannot leave an orphaned half-created direct room.

## Accessibility

Both profile actions are native buttons using the existing Spartan directive. Pending operations expose `aria-busy`, disable duplicate activation, and retain visible text labels. Action failures use an assertive live region. Controls wrap on narrow/high-zoom layouts and use at least 44px minimum height for primary touch actions.

## Verification

Automated coverage includes:

- authenticated API-client request/response validation;
- self, missing-user, blocked, provider-failure, malformed-response, and concurrent-open backend cases;
- database serialization, two-member reuse, atomic membership creation, service-role-only execution, replay safety, and historical room-id compatibility;
- profile navigation only after authoritative room creation, duplicate-click suppression, server-confirmed follow state, and retryable failures.

Repository CI remains authoritative for clean Supabase replay, backend/frontend unit tests, builds, static analysis, E2E contracts, dependency review, translation-safety, and UI governance.

## Rollout and rollback

1. Apply `20260823133000_direct_chat_opening.sql`.
2. Deploy the backend endpoint.
3. Deploy the Angular profile action client/UI.
4. Smoke-test two accounts: open the same profile simultaneously, confirm both land in the same room, then verify Follow/Unfollow and a first-message privacy rejection.

For rollback, remove the Angular action integration first and then the API controller/service. Leave the PostgreSQL function in place during a normal rollback; it stores no independent user data and is harmless to older clients. If it must be removed later, use a new forward migration after no deployed backend references it.

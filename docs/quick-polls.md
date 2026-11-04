# Quick Polls

Quick Polls let the host of an active audio room ask the audience a multiple-choice question and display aggregate results.

## Product contract

- Only the authenticated `audio_rooms.host_id` may create a poll for that room.
- A question is 1-300 characters after trimming.
- A poll has 2-6 non-empty, case-insensitively unique options.
- Each option is at most 100 characters after trimming.
- An authenticated user may cast at most one vote per poll. The existing `(poll_id, user_id)` unique constraint is authoritative for concurrent submissions. Retrying the same option succeeds idempotently, while trying to change an existing vote returns a conflict.
- Poll results contain only aggregate option counts. The UI does not expose voter identities.
- Inactive polls and polls belonging to ended audio rooms reject new votes.
- Private-room polls are available only to the host and invited users, matching the existing room-join boundary.

The Angular audio-room surface shows the create action only to the current room host and disables repeated submission while creation is in flight. The NestJS service verifies that the caller is the host and that the room is active before inserting. Poll reads and votes enforce private-room invitations on the server. The NestJS API remains authenticated by `SupabaseAuthGuard`. Because the backend uses the Supabase service role and therefore bypasses RLS, `20260822180000_quick_poll_integrity.sql` also enforces the host/room relationship in a PostgreSQL trigger. RLS remains defence in depth for direct authenticated database access.

## API

- `POST /api/audio-rooms/:roomId/polls` creates a poll.
- `POST /api/audio-rooms/polls/vote` records one vote.
- `GET /api/audio-rooms/:roomId/polls/active` returns the newest active poll, aggregate results and the caller's existing vote, or `null` when no poll is active.
- `GET /api/audio-rooms/:roomId/polls/:pollId` returns aggregate results and the caller's existing vote.

The frontend `QuickPollService` refuses requests without an authenticated access token, validates obvious malformed inputs and responses, URL-encodes identifiers, accepts the backend's empty successful vote response, and exposes only a small allowlist of actionable server error messages. Arbitrary upstream or database response bodies are not shown to users.

## Realtime and recovery

Poll state uses the existing `room_{audio_room_id}` Centrifugo channel:

- `poll_opened` contains the poll id, question and options after persistence succeeds.
- `poll_updated` contains the poll id and aggregate counts after a vote is committed. It never contains a voter identity.

The audio-room store owns these events alongside the existing stage events. A client that joins late, reconnects, or misses a best-effort publication recovers through the active-poll endpoint. Realtime publication and persistence failures are logged as structured events with room or poll identifiers, while a persisted mutation remains successful and recoverable if realtime delivery fails.

## Persistence and deletion

`quick_polls.room_id` cascades on audio-room deletion. `poll_votes.poll_id` cascades on poll deletion and `poll_votes.user_id` cascades on user deletion. No additional retention job is required for this change.

## Verification

Relevant automated coverage includes:

- `backend/src/audio-rooms/dto/create-poll.dto.spec.ts` for API validation bounds and duplicate options.
- `backend/src/audio-rooms/audio-rooms.polls.service.spec.ts` for host permissions, private-room invitations, active-room checks, room-bound results, recovery and duplicate-vote handling.
- `backend/src/audio-rooms/audio-rooms.polls.controller.spec.ts` for authenticated route delegation.
- `backend/test/audio-rooms-polls.e2e-spec.ts` for HTTP routing and validation.
- `frontend/src/app/services/quick-poll.service.spec.ts` for authenticated requests, normalisation, empty vote responses, client validation, and safe failure messages.
- `audio-rooms.store.polls.spec.ts` for active-poll recovery, realtime aggregates and room-leave cleanup.
- `quick-poll-form.component.spec.ts`, `quick-poll-display.component.spec.ts`, and `audio-room.api-url.spec.ts` for accessible dialog composition, form limits, duplicate-create guards, aggregate result cues, voting and room integration.
- Supabase clean-reset and migration replay for the database trigger, constraints, and RLS policy replacement.

## Rollout and rollback

The active-poll endpoint and additive response fields are backward-compatible with older clients. Deploy the backend before or with the frontend so recovery is available when the new client starts requesting it. The existing database migration remains compatible with older application instances because valid host-created polls already satisfy its trigger and constraints.

Rollback the application normally if required. Older clients ignore the new realtime payload fields and continue using the existing create, vote and results endpoints. Do not remove the host-integrity trigger as a routine rollback: it closes a service-role authorisation gap. If the product later permits co-host-created polls, change the product/API authorisation rule and database trigger together in a forward migration rather than weakening only one layer.

# Quick Polls

Quick Polls let the host of an active audio room ask the audience a multiple-choice question and display aggregate results.

## Product contract

- Only the authenticated `audio_rooms.host_id` may create a poll for that room.
- A question is 1-300 characters after trimming.
- A poll has 2-6 non-empty, case-insensitively unique options.
- Each option is at most 100 characters after trimming.
- An authenticated user may cast at most one vote per poll. The existing `(poll_id, user_id)` unique constraint is authoritative for retries/concurrent duplicate submissions.
- Poll results contain only aggregate option counts. The UI does not expose voter identities.
- Inactive polls reject new votes.

The Angular audio-room surface shows the create action only to the current room host. The NestJS API remains authenticated by `SupabaseAuthGuard`. Because the backend uses the Supabase service role and therefore bypasses RLS, `20260822180000_quick_poll_integrity.sql` also enforces the host/room relationship in a PostgreSQL trigger. RLS remains defence in depth for direct authenticated database access.

## API

- `POST /api/audio-rooms/:roomId/polls` creates a poll.
- `POST /api/audio-rooms/polls/vote` records one vote.
- `GET /api/audio-rooms/:roomId/polls/:pollId` returns aggregate results.

The frontend `QuickPollService` refuses requests without an authenticated access token, validates obvious malformed inputs before network I/O, URL-encodes identifiers, accepts the backend's empty successful vote response, and exposes only a small allowlist of actionable server error messages. Arbitrary upstream/database response bodies are not shown to users.

## Persistence and deletion

`quick_polls.room_id` cascades on audio-room deletion. `poll_votes.poll_id` cascades on poll deletion and `poll_votes.user_id` cascades on user deletion. No additional retention job is required for this change.

## Verification

Relevant automated coverage includes:

- `backend/src/audio-rooms/dto/create-poll.dto.spec.ts` for API validation bounds and duplicate options.
- `frontend/src/app/services/quick-poll.service.spec.ts` for authenticated requests, normalisation, empty vote responses, client validation, and safe failure messages.
- Supabase clean-reset/migration replay for the database trigger, constraints, and RLS policy replacement.
- Existing audio-room controller/service tests for create, vote, and results routing.

## Rollout and rollback

Deploy the database migration before or with the application update. It is compatible with older application instances because valid host-created polls already satisfy the new trigger and constraints.

Rollback the application normally if required. Do not remove the host-integrity trigger as a routine rollback: it closes a service-role authorization gap. If the product later permits co-host-created polls, change the product/API authorization rule and database trigger together in a forward migration rather than weakening only one layer.

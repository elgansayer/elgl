# Scheduled Event Language Parties

Issue #1331 connects scheduled Events to the existing Language Parties and LiveKit audio-room stack.

## Product contract

Only Events with `category = audio_room`, a language pair, and `is_cancelled = false` are eligible. At or shortly after `date_time`, the backend creates a normal Language Party using the existing `AudioRoomsService.createLanguageParty()` path. The room name is deterministic:

`language_party-<event UUID>`

The resulting `audio_rooms` row keeps `party_type = language_party` and `event_id = <event UUID>`, so it appears through the existing Language Parties discovery API and uses the same LiveKit, recording, moderation, speaker, caption, and archive behavior as a manually created Language Party.

Other event categories never create rooms.

## Scheduling and retries

The Events service checks immediately at backend startup and then every 10 seconds. Each tick reads at most 50 due events from a 30-minute catch-up window and creates rooms with at most 10 concurrent operations.

The catch-up window means a deployment or short Supabase/LiveKit outage does not permanently miss an event simply because its exact start second passed. It is intentionally bounded so an old event cannot unexpectedly open a room hours or days later.

The room name and `audio_rooms.event_id` are both unique. If two backend replicas race, only one durable room can win. A losing worker re-reads the deterministic room and reconciles the `event_id`/`party_type` metadata rather than creating another room. A partial historical room whose initial metadata update failed is repaired in the same way.

A deterministic room already linked to a different event is treated as corrupted state and is never reassigned automatically.

## Failure behavior

Supabase scan or room-list failures fail the current tick closed. Individual room failures are isolated with `Promise.allSettled`; other due events continue. A failed room remains eligible until it falls outside the catch-up window, so transient failures retry naturally.

`AudioRoomsService.createLanguageParty()` retains the existing LiveKit behavior: a LiveKit create warning does not prevent the database room from being created, and the deterministic next retry can reconcile the durable row.

No event title, user id, event id, room id, message content, token, or provider credential is written to scheduler logs. Operational logs contain only created/recovered/failed counts and total tick duration.

## Data and retention

`audio_rooms.event_id` is a nullable foreign key to `events.id` with `ON DELETE SET NULL`. Deleting an event therefore does not delete a room, recording, transcript, or other audio-room data; those continue under the existing audio-room retention lifecycle.

The migration converges any historical duplicate event links without deleting rooms. It keeps the deterministic room when present, otherwise the oldest room, and clears only duplicate `event_id` metadata.

A partial index on due audio-room Events keeps the scheduler query bounded as event history grows.

## Security and privacy

There is no new public endpoint or client-supplied room-creation path. Event scheduling is performed by the backend service using the same trusted Supabase and LiveKit integrations as existing Language Parties.

Existing room authorization, private-room rules, moderation, speaker permissions, token generation, recording, and caption controls remain authoritative.

## Verification

Focused tests cover:

- due audio Events creating deterministic Language Parties;
- category/cancellation/catch-up query constraints and batch limits;
- recovery of a partially linked room;
- recovery after a concurrent deterministic room-name race;
- refusal to transfer a room already linked to another Event;
- datastore scan failures remaining isolated;
- migration uniqueness, foreign-key, convergence, and due-query index contracts.

Repository CI remains authoritative for clean Supabase replay, backend unit/build/lint, and broader integration checks.

## Rollout

1. Apply `20260824032500_harden_scheduled_event_language_parties.sql`.
2. Deploy the backend.
3. Create a future `audio_room` Event with a language pair and verify that one Language Party appears within one scheduler interval after its start.
4. Repeat with two backend replicas and verify that only one `audio_rooms` row is linked to the Event.
5. Verify cancelled and non-audio Events do not create rooms.

The migration is mixed-version compatible with the previous worker: it only adds a foreign key, uniqueness guarantee, and query index over already-existing columns.

## Rollback

Revert the backend worker first. The additive foreign key and indexes may remain safely in place and continue protecting data integrity.

If the database changes must also be rolled back, drop `events_due_audio_room_idx`, `audio_rooms_event_id_unique`, and `audio_rooms_event_id_fkey` in a new forward migration. Do not rewrite or delete existing audio-room rows during rollback.

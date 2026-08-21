# Event RSVP contract

Issue: #855

## User-visible behavior

Event cards expose two mutually exclusive RSVP states: **Attending** and **Interested**. Selecting either state updates the card immediately, persists the new state, and then reconciles aggregate counts from the server. Selecting the active state again is a no-op. A user with an RSVP can clear it with the cancel action.

RSVP controls are disabled while a mutation is pending, which prevents duplicate rapid submissions. If persistence fails, the client restores the previous state and count values. A capacity conflict restores the previous state and reports the event's participant limit when it is known. Summary-load failures remain retryable and do not prevent the rest of the Events feed from rendering.

The shared `EventRsvpStore` is application-scoped so multiple event surfaces use one canonical in-memory RSVP state. The reusable `EventRsvpControlsComponent` is used by the feed and can be reused by the event-detail surface without duplicating mutation logic.

## Capacity and state rules

`max_participants` applies only to `attending` RSVPs. `interested` does not reserve a place. Hosts are not counted automatically; a host consumes a place only if the host explicitly RSVPs as attending.

Switching from `attending` to `interested` releases the attending place when the database transaction commits. Switching from `interested` to `attending` must acquire a place. The database trigger locks the parent event row before evaluating an attending transition, so two concurrent requests for the final place cannot both commit.

RSVP insert, status change, and removal are rejected after the event starts or after it is cancelled. The database remains the source of truth even if a stale client still renders an enabled control.

## API

Existing authenticated endpoints remain backward compatible:

- `GET /events/:id/rsvp` returns the current user's RSVP or `null`.
- `POST /events/:id/rsvp` accepts `{ "status": "attending" | "interested" }`. The write is an upsert on `(event_id, user_id)`, so retries and status switches are idempotent and atomic from the API caller's perspective.
- `DELETE /events/:id/rsvp` clears the current user's RSVP.

A bounded aggregate endpoint supports event lists without exposing attendee identities or creating one request per card:

- `GET /events/rsvp-summaries?event_ids=<uuid>,<uuid>` accepts 1 to 50 UUIDs.
- Each response row contains `event_id`, `attending_count`, `interested_count`, and the authenticated viewer's `viewer_status`.

The summary RPC is executable only by the Supabase service role. Clients consume it through the authenticated NestJS endpoint.

## Database enforcement

Migration `20260821080500_harden_event_rsvps.sql` installs `enforce_event_rsvp_mutation()` as a `BEFORE INSERT OR UPDATE OF status OR DELETE` trigger on `event_rsvps`.

For every mutation the trigger locks the referenced `events` row with `FOR UPDATE`. This serializes capacity decisions per event while allowing unrelated events to proceed concurrently. When a transition begins consuming capacity, it counts committed `attending` rows while holding that lock and raises `event_full` if the limit is already reached.

Stable database failures are mapped at the API boundary:

- `event_full` -> HTTP 409 Conflict
- `event_cancelled` -> HTTP 400 Bad Request
- `event_started` -> HTTP 400 Bad Request
- `event_not_found` -> HTTP 404 Not Found

Unexpected database errors are logged with a sanitized error code and returned as a generic server failure; database details are not sent to clients.

## Privacy and abuse resistance

The public RSVP UI uses aggregate counts only. The summary API never returns attendee user IDs, names, profile data, or other membership details. Existing row-level security continues to restrict direct RSVP row mutations to the authenticated user's own row.

Mutations are constrained by DTO validation, the `(event_id, user_id)` uniqueness constraint, and database-level event-state/capacity checks. This means stale clients, retries, and direct API calls cannot bypass the attendance limit.

Event reminders continue to target only committed `attending` rows and use the existing notification service and reminder-deduplication table. This change does not introduce a new notification channel or preference bypass.

## Verification

Focused automated coverage should include:

- atomic upsert semantics and stable API error mapping in `events.service.spec.ts`;
- aggregate summary normalization and identity minimization;
- client batching of same-turn summary loads;
- optimistic status changes, duplicate-click suppression, canonical reconciliation, capacity rollback, clear/remove, and retryable load failure in `event-rsvp.store.spec.ts`;
- existing Events feed tests to protect pagination/filter behavior while the reusable RSVP component is mounted.

For a database integration environment, additionally verify two concurrent `attending` writes against an event with one remaining place: exactly one must commit and the other must receive `event_full`. Verify that changing the winner to `interested` permits a subsequent attending write.

## Rollout

1. Apply the Supabase migration before deploying the application code. The trigger is compatible with existing RSVP rows and immediately closes the concurrent-capacity gap.
2. Deploy the backend so RSVP writes use atomic upsert and the bounded summary endpoint is available.
3. Deploy the frontend. Cards batch-load aggregate RSVP state and use optimistic updates with server reconciliation.
4. Monitor API 409/400 rates and sanitized RSVP failure logs. A rise in 409 responses can indicate events routinely reaching capacity rather than database failure.

## Rollback

The frontend can be rolled back independently; the backend and database enforcement remain compatible with older clients. The backend can also be rolled back while leaving the trigger in place, although the legacy delete-then-insert implementation has weaker retry semantics for status switches.

Only remove the database trigger/function after all application versions that rely on database capacity enforcement are gone. Dropping `event_rsvps_enforce_mutation`, `enforce_event_rsvp_mutation()`, and `get_event_rsvp_summaries(UUID, UUID[])` restores the previous schema behavior but also reopens the race that allowed over-capacity attendance, so that rollback should be used only to recover from a migration-specific production fault.

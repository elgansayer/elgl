# Event push reminder delivery

Issues #1329 and #1513 are implemented by the existing Events and Notifications modules. The reminder worker runs inside `EventsService`; Firebase delivery remains owned by `NotificationsService` so event reminders use the same push tokens and notification preferences as the rest of the product.

## Product behavior

Users with an `attending` RSVP are eligible for one push reminder for a non-cancelled event when its start time is within the next 15 minutes. The worker scans immediately when the Events module starts and every 60 seconds afterwards. A catch-up window is intentional: if an API process restarts or a scheduler tick is delayed, an event that is now fewer than 15 minutes away is still eligible rather than being permanently missed.

The notification includes a bounded event title, an accurate whole-minute countdown, and `eventId`, `startsAt`, and `/events/:id` route data so clients can deep-link to the event. Only `attending` RSVPs are included. `interested`, removed, cancelled, already-started, and already-completed reminder records are excluded by the database claim function.

## Delivery state and concurrency

`event_reminders_sent` remains the durable one-row-per-event/user deduplication table. Migration `20260823104500_harden_event_reminder_delivery.sql` adds these delivery fields:

- `status`: `pending` or `sent`;
- `claimed_at`: worker lease timestamp;
- `next_attempt_at`: retry eligibility;
- `attempt_count`: bounded operational attempt count;
- `updated_at`: last delivery-state mutation.

Existing rows and old application versions remain compatible. Existing rows default to `sent`, and legacy inserts that only specify `event_id` and `user_id` continue to work.

New workers call the service-role-only `claim_due_event_reminders` RPC. The function creates pending rows with `ON CONFLICT DO NOTHING`, then leases work using `FOR UPDATE ... SKIP LOCKED`. This removes the previous select-then-send race between multiple NestJS replicas. Claims are bounded to 500 rows by the database and the application requests 200 at a time, at most five batches per scheduler tick. Push dispatch is further limited to 25 concurrent users.

A successful dispatch attempt marks the reminder `sent`. A rejected dispatch is released with a one-minute retry delay. If a worker dies while holding a claim, the two-minute lease expires and a later worker can retry it. Delivery state is retained for the lifetime of the event and is removed automatically by the existing `ON DELETE CASCADE` relationship.

Firebase/APNs delivery is inherently asynchronous. `sent` therefore means the shared push service accepted/completed its dispatch attempt, not that a device displayed the notification.

## Security and privacy

Reminder delivery metadata is backend-internal. The original broad RLS policy is removed and table access is revoked from `anon` and `authenticated`; service-role workers continue to bypass RLS. The claim RPC is explicitly revoked from public/authenticated roles and granted only to `service_role`.

The scheduler does not log user IDs, event IDs, titles, push tokens, or provider payloads on failure. Operational logs contain only bounded aggregate counts and duration. Event titles are whitespace-normalized and capped at 80 characters before being copied into a push payload.

No new user-facing permission is introduced. The existing `groups` push preference is honored by `NotificationsService`, and users without usable push delivery continue to follow the shared notification-service behavior.

## Failure and recovery behavior

- Database/RPC failure: the tick fails closed, logs a sanitized error, and the next scheduled tick retries.
- One push failure: other claimed reminders continue via `Promise.allSettled`; the failed claim is released for retry.
- Worker crash: stale claims become eligible after the lease expires.
- Database finalization failure after dispatch: the lease eventually expires and the reminder may be retried. This favors avoiding missed reminders over impossible exactly-once guarantees across an external push provider.
- Cancelled event or changed RSVP: the claim RPC re-checks current event and RSVP state before leasing work.
- Scheduler delay/restart: the rolling 0-15 minute due window provides catch-up until the event starts.

## Verification

Run the backend Events unit suite and the normal repository verification pipeline. `backend/src/events/event-reminder-delivery.contract.spec.ts` locks the 15-minute eligibility window, one-minute scheduler cadence, replica-safe leasing, service-role-only claim boundary, deep-link push payload, and retry/finalization behavior. Existing focused tests cover atomic claim invocation, event deep-link payloads, countdown text, failure retry release, malformed claim rejection, sanitized/bounded titles, and database-unavailable behavior. CI database reset/replay validates the migration and function syntax.

Useful production signals are the existing NestJS logs:

- `Event reminder dispatch completed count=<n> duration_ms=<n>` for non-empty successful ticks;
- `Could not claim due event reminders` for claim failures;
- `Could not finalize event reminder deliveries` or `Could not release failed event reminders for retry` for state-write failures.

These messages deliberately omit per-user and per-event identifiers.

## Rollout and rollback

Deploy the migration before or with the application. It is mixed-version safe: older workers can continue inserting legacy `sent` rows while newer workers use leased claims.

For application rollback, redeploy the previous backend version. The additive columns and RPC can remain in place; legacy inserts still work. Do not restore the broad authenticated RLS policy.

For a later schema cleanup, first ensure no deployed worker uses `claim_due_event_reminders`, then drop the RPC/additive delivery columns in a new forward migration. Deployed migrations must not be edited in place.

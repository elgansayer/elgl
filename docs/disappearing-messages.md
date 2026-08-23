# Disappearing messages

Issue: #1196

## Product contract

Chat Settings exposes a sender-level default retention policy for newly sent messages:

- `off`: normal chat retention (default and legacy behaviour)
- `24h`: expire 24 hours after the message is created
- `7d`: expire 7 days after creation
- `90d`: expire 90 days after creation

The setting applies only to messages sent after the preference is saved. An existing message keeps the `expires_at` value assigned when it was created, so changing the preference cannot retroactively shorten or extend existing content.

The sender owns the default because #1196 does not define a shared room policy or approval workflow. This avoids allowing one member to silently rewrite another member's historical retention. A future per-room mode should be implemented as a separate, explicit participant-consent contract rather than changing this rule implicitly.

## Data flow

`users.chat_preferences.disappearingMessagesTtl` stores the selected default. The application never trusts a browser-supplied expiry timestamp.

Migration `20260823050000_disappearing_messages.sql` adds nullable `chat_messages.expires_at` and a partial expiry index. A `BEFORE INSERT` trigger reads the authenticated sender's persisted preference and assigns the absolute expiry. Unknown, missing and `off` values produce `NULL`, preserving ordinary retention.

The trigger deliberately overwrites any caller-provided `expires_at`. Supported clients therefore cannot extend, shorten or forge a message expiry independently of the saved preference.

## Expiry and deletion

The product-visible lifetime and physical cleanup are separate safeguards:

1. Chat HTTP responses are passed through `DisappearingMessagesInterceptor`. Message-shaped records whose `expires_at` is in the past are removed before delivery, so a delayed maintenance job does not make expired content visible through the supported Chat API.
2. `DisappearingMessagesCleanupService` runs once per minute and invokes the service-role-only `purge_expired_chat_messages` PostgreSQL function.
3. The function deletes at most 500 expired messages per invocation, ordered by expiry, using `FOR UPDATE SKIP LOCKED`. This bounds lock duration and permits safe concurrent/retried workers.
4. Matching saved-message snapshots in `favourites` are deleted in the same database statement before the canonical message row is removed.

The cleanup RPC clamps every requested batch to 1-1000 rows and is not executable by `anon` or `authenticated` database roles.

## Failure behaviour

- Settings GET failure: the Angular client fails closed to `off`; it never invents a destructive retention value.
- Settings PUT failure: the optimistic selection is rolled back, an accessible error is shown, and the previous server value remains authoritative.
- Duplicate setting changes while a save is pending: ignored until the current save settles.
- Unknown persisted setting: normalized to `off` by both backend and frontend compatibility paths.
- Cleanup database outage: the scheduled job records only a sanitized provider error code and retries on the next schedule. Expired messages remain suppressed by the Chat API response boundary meanwhile.
- Cleanup crash/concurrency: the database row lock and bounded idempotent deletion make retry safe.

## Privacy and security

Disappearing messages reduce retention; they are not a guarantee that a recipient cannot copy content before expiry. Product copy must not describe this as screenshot prevention, encryption or guaranteed erasure from user-controlled devices.

No message body, sender identifier, room identifier, media URL or preference value is added to cleanup logs. Successful cleanup logs only the number of removed rows. Provider failures log a sanitized error code.

The existing chat authentication, room membership, block and first-contact rules remain unchanged. The migration does not grant new direct table permissions. Retention helper functions are backend/service-role only.

Account deletion and existing message cascade behaviour continue to apply independently of `expires_at`.

## Accessibility and UX

The Chat Settings control is a native select, so it supports keyboard interaction, platform screen readers and touch input without a custom interaction model. It has a visible label, explanatory consequence text, a minimum touch height, a disabled saving state and an `aria-live` status/error region. The finite-retention copy explicitly says that new messages are permanently removed after the chosen lifetime.

## Verification

Automated coverage includes:

- backend preference defaults, valid values, corrupt-value fallback, partial updates and persistence failures;
- frontend load/normalization, successful retention saves, rollback on failure and duplicate-submit suppression;
- response suppression for expired messages and protection against changing unrelated response objects;
- scheduled cleanup success, empty batches and provider failures;
- migration checks for supported durations, sender-owned trigger assignment, bounded `SKIP LOCKED` cleanup, favourite cleanup and service-role-only execution.

Production smoke test after deployment:

1. Save `24h` for a test learner and send a message.
2. Confirm its `expires_at` is approximately creation time + 24 hours and cannot be chosen by the request payload.
3. Set the preference to `off`; confirm the first row retains its expiry and the next message receives `expires_at = NULL`.
4. In staging, move the first row's expiry into the past and confirm the Chat API no longer returns it before running cleanup.
5. Invoke the cleanup RPC as service role and confirm the message plus any corresponding favourite snapshot are deleted.
6. Confirm `authenticated` cannot execute the cleanup RPC directly.

## Rollout

1. Apply `20260823050000_disappearing_messages.sql`.
2. Deploy backend code with the expiry response boundary and cleanup worker.
3. Deploy the Angular settings client.
4. Monitor `disappearing_message_cleanup_failed` and cleanup counts for unusual volume.

The migration is additive and mixed-version safe. Older clients ignore `expires_at`; the database remains authoritative for newly inserted messages once a user has selected a finite retention policy.

## Rollback

Roll back the frontend first to remove new preference changes, then the backend if necessary. The nullable column and index are safe to leave in place.

A code-only rollback does **not** disable already-selected retention because the database trigger remains authoritative. If the feature must be fully disabled, use a reviewed forward migration to remove `chat_messages_apply_expiry` and clear `disappearingMessagesTtl` from user preferences. Decide explicitly whether already-assigned future `expires_at` values should continue to honour the user's original deletion choice or be cleared; do not silently extend retention during an emergency rollback.

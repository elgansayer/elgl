# Offline chat queue

ELGL queues chat messages locally when the browser is offline so a temporary network outage does not force the learner to retype a message. `OfflineQueueService` owns this IndexedDB boundary and `ChatService` flushes queued messages when connectivity returns.

## Storage and account isolation

The queue uses IndexedDB database `chat_offline_db`, schema version 2, with a `messages` object store keyed by the client-generated message ID. Every stored record includes the authenticated `owner_id` and is indexed by that value. Reads, deletes, counts, retention cleanup, and clear operations are scoped to the current authenticated account.

Version 1 queue records did not identify their owning account. During the version 2 upgrade those legacy records are discarded rather than guessed or exposed after an account switch. This is an intentional fail-closed privacy migration.

The queue is bounded to 200 pending messages per account and records expire after seven days. Successfully synchronized messages are removed immediately. Signing out hides the queue and resets the visible queued count, while still allowing a later sign-in to the same account to recover non-expired messages.

## Failure behaviour

Offline enqueueing is only reported as successful after IndexedDB commits the record. Missing authentication, unavailable/blocked IndexedDB, invalid identifiers, invalid timestamps, ownership mismatches, database errors, and capacity exhaustion reject the enqueue operation. Callers therefore retain the composer draft instead of showing a false successful send.

Queue reads return no content when there is no authenticated account. Stored records whose owner/sender no longer matches the active account are never returned for synchronization. Database/provider failures use fixed diagnostic errors and do not include message text, tokens, room content, or other private payloads.

## Synchronization

`ChatService` already listens for the browser `online` event and invokes `syncOfflineMessages()`. The service reads only the current account queue, submits messages through the normal authenticated `/chat/messages` API, removes each item only after a successful response, and leaves failed items queued for retry. Individual failures do not prevent later entries from being attempted.

The IndexedDB queue is a delivery buffer, not a source of authorization. The backend still performs the normal room-membership, block, validation, and abuse checks when the message is replayed.

## Verification

Focused frontend coverage lives in `frontend/src/app/services/offline-queue.service.spec.ts`. It covers unauthenticated access, unavailable browser storage, ownership validation, malformed records, and the valid queue boundary. Repository CI remains authoritative for TypeScript compilation, formatting, the frontend unit suite, and broader chat contracts.

## Rollout and rollback

No server API or database migration is required. Deploying the frontend upgrades the browser IndexedDB schema from version 1 to version 2 on first access. The only destructive migration is deletion of unattributable version 1 pending messages, which prevents cross-account disclosure.

Rollback is a normal frontend revert, but a client that has already opened schema version 2 should not be expected to downgrade its IndexedDB schema automatically. If rollback is required, the previous client will simply be unable to open the newer database until the application cache/site data is cleared or a forward-compatible rollback is shipped. For that reason, prefer fixing forward rather than deploying an older queue implementation after version 2 reaches users.

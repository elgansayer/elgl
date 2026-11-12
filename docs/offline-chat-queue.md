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

`ChatService` replays the queue whenever a signed-in account has connectivity: at start-up, after signing in, and when the browser reconnects. A reactive effect watches both the authenticated user and `NetworkStatusService.isOnline()`, so offline reads and flushes never run for anonymous visitors. Overlapping triggers share one in-flight replay, so a message is never submitted twice concurrently.

Queued messages are sent oldest first, one request at a time, through the normal authenticated `/chat/messages` API. Each request carries the queue record's client-generated version 4 UUID as `client_message_id`. The backend stores it as the message primary key: if a response is lost after a successful insert, the retry returns the original row instead of creating a duplicate. A matching id owned by another sender or room is rejected with `409 Conflict` without revealing the stored message, and a lost insert race (`23505`) resolves to the winning row.

A message is removed from the queue only after the API accepts it or the server permanently refuses it. Transient failures (network status `0`, `401`, `408`, `425`, `429`, and `5xx`) leave the message queued for the next trigger. A permanent client refusal (any other `4xx`, such as validation or a block) discards the message and shows a translated warning. After a transient failure, later messages of the same room are held back so they cannot overtake it, while other rooms continue. Diagnostics are fixed codes (`chat.offline_queue_unreadable`, `chat.offline_sync_incomplete`, `chat.replay_lookup_failed`) and never include message text or identifiers.

The chat room shows a translated, `role="status"` banner while offline and while messages remain queued, including after reconnecting until the queue drains. The state is carried by text, not colour alone, and the icons are decorative.

The IndexedDB queue is a delivery buffer, not a source of authorization. The backend still performs the normal room-membership, block, validation, and abuse checks when the message is replayed.

## Verification

Focused frontend coverage lives in `frontend/src/app/services/offline-queue.service.spec.ts`, `frontend/src/app/services/chat.service.spec.ts`, and `frontend/src/app/components/chat-room/chat-room.component.spec.ts`. They cover unauthenticated access, unavailable browser storage, ownership validation, malformed records, the valid queue boundary, idempotency-key transport, shared replays, ordering, retry versus permanent refusal, and the offline banner. Backend coverage in `backend/src/chat/chat-message-idempotency.behaviour.spec.ts` and `send-message.dto.spec.ts` proves replay lookup, conflict handling, race resolution, 403 block refusals, and UUID validation. Repository CI remains authoritative for TypeScript compilation, formatting, the frontend unit suite, and broader chat contracts.

## Rollout and rollback

No server API or database migration is required: `client_message_id` reuses the existing `chat_messages.id` primary key, and the field is optional so online sends keep their existing contract. Deploying the frontend upgrades the browser IndexedDB schema from version 1 to version 2 on first access. The only destructive migration is deletion of unattributable version 1 pending messages, which prevents cross-account disclosure.

Rollback is a normal frontend revert, but a client that has already opened schema version 2 should not be expected to downgrade its IndexedDB schema automatically. If rollback is required, the previous client will simply be unable to open the newer database until the application cache/site data is cleared or a forward-compatible rollback is shipped. For that reason, prefer fixing forward rather than deploying an older queue implementation after version 2 reaches users.

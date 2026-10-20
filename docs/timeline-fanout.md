# Moments timeline fan-out

## Purpose

`TimelineWorker` maintains the Redis cache used by the Moments `Following` feed. Supabase remains the source of truth for Moments and follows. Redis only stores a bounded list of Moment IDs per recipient.

## Publish flow

After `MomentsService.createMoment()` persists a Moment, it invokes `TimelineWorker.fanOutMoment()` asynchronously.

The worker:

1. Reads followers from `user_follows` in deterministic batches of 500, ordered by `follower_id`.
2. Advances between batches with a `follower_id > previous_cursor` keyset query rather than a mutable row offset.
3. Adds the author to the recipient set for the first batch so the author's Following feed can include their own Moment.
4. Writes the Moment ID to `timeline_queue:{recipient_id}` in one Redis transaction per follower batch.
5. Keeps at most 500 Moment IDs in each Redis list.

Keyset pagination prevents a concurrent follow/unfollow before the current position from shifting later rows and causing an existing follower to be skipped. A follower created after the cursor has passed their identifier is intentionally not guaranteed to receive the historical Moment; Supabase remains authoritative and later posts will use the new relationship. If a provider ever returns a full page whose cursor does not advance, the worker stops and records a sanitized pagination failure rather than looping indefinitely.

Follower pagination prevents the worker from depending on one unbounded Supabase response. If a later page fails, the already completed pages are safe to process again on retry.

## Redis queue contract

Each recipient update uses these commands inside `MULTI`/`EXEC`:

```text
LREM timeline_queue:{recipient_id} 0 {moment_id}
RPUSH timeline_queue:{recipient_id} {moment_id}
LMOVE timeline_queue:{recipient_id} timeline_queue:{recipient_id} RIGHT LEFT
LTRIM timeline_queue:{recipient_id} 0 499
```

`RPUSH` is the canonical fan-out write required by the feed architecture. `LMOVE RIGHT LEFT` immediately rotates the appended ID to the head so this change remains compatible with the existing `LRANGE 0 49` Following-feed consumer and with Redis lists populated by the previous `LPUSH` implementation.

`LREM` before `RPUSH` makes a retried batch idempotent. The Redis transaction makes concurrent retries for the same Moment execute as complete units rather than interleaving individual queue commands.

## Failure handling and observability

Follower lookups and Redis transactions receive one bounded retry. A successful follower lookup with no rows still writes the author's queue. Provider failures are logged using only a stable failure classification:

- `TimelineFollowerLookupError` for exhausted Supabase follower reads;
- `TimelineQueueWriteError` for exhausted Redis transactions;
- `TimelinePaginationError` when a full follower page cannot advance the keyset cursor.

Moment IDs, user IDs, Redis keys, credentials, connection strings, and raw provider errors are not written to the log. The success log contains only the aggregate recipient count.

`fanOutMoment()` remains best effort because Moment persistence is authoritative. A fan-out failure must not roll back an already-created Moment. When a Following queue is empty, the existing feed path falls back to the relational `user_follows` query.

## Scope

This worker owns the `Following` cache. The `Classmates` feed continues to use its existing target-language database query, so this change does not duplicate classmates into Following queues or alter product filtering semantics.

No database schema, API response, authentication, or retention policy changes are required. Redis timeline entries are derived cache data and continue to be bounded to 500 Moment IDs per user.

## Verification

Relevant automated coverage is in:

```text
backend/src/moments/timeline.worker.spec.ts
backend/src/moments/moments.service.spec.ts
```

The worker tests cover keyset follower pagination, non-advancing cursor protection, author-only fan-out, null successful results, RPUSH usage, bounded queue retention, retry-safe writes, transient lookup retry, transaction retry, and sanitized failure classification.

Recommended focused verification:

```bash
cd backend
npm test -- src/moments/timeline.worker.spec.ts
npm run build
```

Repository CI remains authoritative for the full backend lint/unit/build and integration gates.

## Rollout and rollback

The queue key, list bounds, newest-first read contract, API surface, and database schema are unchanged, so no Redis flush or data migration is required. Existing queue entries remain readable during a mixed-version rollout. The only behavioural change is how follower pages advance during fan-out, making concurrent relationship changes safer.

Rollback is a normal application revert. Supabase Moment and follow data are unaffected because Redis timeline lists are only a derived cache.

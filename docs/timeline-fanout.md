# Moments timeline fan-out

## Purpose

`TimelineWorker` maintains the Redis cache used by the Moments `Following` feed. Supabase remains the source of truth for Moments and follows. Redis only stores a bounded list of Moment IDs per recipient.

## Publish flow

After `MomentsService.createMoment()` persists a Moment, it invokes `TimelineWorker.fanOutMoment()` asynchronously.

The worker:

1. Reads followers from `user_follows` in deterministic batches of 500.
2. Adds the author to the recipient set for the first batch so the author's Following feed can include their own Moment.
3. Writes the Moment ID to `timeline_queue:{recipient_id}` in one Redis transaction per follower batch.
4. Keeps at most 500 Moment IDs in each Redis list.

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

## Failure handling

Follower lookups and Redis transactions receive one bounded retry. A successful follower lookup with no rows still writes the author's queue. Provider failures are logged using only a failure classification; Moment IDs, user IDs, Redis keys, credentials, connection strings, and raw provider errors are not written to the log.

`fanOutMoment()` remains best effort because Moment persistence is authoritative. A fan-out failure must not roll back an already-created Moment. When a Following queue is empty, the existing feed path falls back to the relational `user_follows` query.

## Scope

This worker owns the `Following` cache. The `Classmates` feed continues to use its existing target-language database query, so this change does not duplicate classmates into Following queues or alter product filtering semantics.

No database schema, API response, authentication, or retention policy changes are required.

## Verification

Relevant automated coverage is in:

```text
backend/src/moments/timeline.worker.spec.ts
backend/src/moments/moments.service.spec.ts
```

The worker tests cover follower pagination, author-only fan-out, null successful results, RPUSH usage, bounded queue retention, retry-safe writes, transient lookup retry, transaction retry, and sanitized failure logging.

## Rollout and rollback

The queue key and newest-first read contract are unchanged, so no Redis flush or data migration is required. Existing queue entries remain readable during a mixed-version rollout.

Rollback is a normal application revert. Supabase Moment and follow data are unaffected because Redis timeline lists are only a derived cache.

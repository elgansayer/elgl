# Moments Redis cache invalidation

## Scope

The current Moments backend stores Moment payloads in Supabase. Redis is used as a per-user following timeline index with keys in the form `timeline_queue:{userId}`. This change deliberately invalidates that existing read model instead of introducing a second Redis payload cache.

`MomentsCacheInvalidationService` is registered and exported by `MomentsModule` so event listeners and dependent backend features share one invalidation contract.

## Rules

| Trigger | Action | Reason |
| --- | --- | --- |
| `user.followed` | Delete `timeline_queue:{followerId}` | The cached following membership may no longer represent the current follow graph. |
| `user.unfollowed` | Delete `timeline_queue:{followerId}` | Prevent Moments from an unfollowed account remaining in the cached following timeline. |
| `moments.moment_removed` | `LREM` the Moment ID from every `timeline_queue:*` key | A withdrawn or deleted Moment must not remain addressable through cached timeline IDs. |
| `moments.timeline_reset` | Delete every `timeline_queue:*` key | Explicit recovery and administrative reset path. |

Deleting a user timeline is safe because `MomentsService.getFeed()` already falls back to the authoritative `user_follows` and `moments` tables when the Redis timeline is empty.

## Production safety

Pattern operations use Redis `SCAN` with bounded batches of 100 keys. The implementation never uses `KEYS`, so invalidation does not block Redis while walking a large keyspace. Moment removal uses pipelined `LREM` calls and all operations are idempotent, which makes event retries safe.

Redis failures are contained so cache maintenance cannot turn a successful source-of-truth mutation into an API failure. Logs contain only the operation and error class, not user IDs, Moment IDs, Redis hosts, credentials or provider error text.

## Rollout and rollback

No schema, API or client contract changes are required. Deploy the service with the backend. Existing timeline keys remain valid until one of the documented triggers occurs.

Rollback is a code-only revert. Removing this service does not require data repair because Redis timelines are derived state and Supabase remains authoritative.

## Verification

Run the focused backend unit suite for `moments-cache-invalidation.service.spec.ts`, then the standard backend lint, unit, build and E2E validation. Repository CI remains the clean-environment gate before merge.

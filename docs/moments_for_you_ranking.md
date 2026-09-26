# Moments For You ranking

## Purpose

The `For You` Moments filter uses a bounded, personalised ranking pipeline inspired by the public architecture of `xai-org/x-algorithm`. The implementation intentionally adapts the architecture rather than vendoring X's Grok/Phoenix serving stack: ELGL does not have the model training, impression history, embeddings, or predicted-action probabilities required to run that system faithfully.

The public X design separates candidate sourcing and visibility filtering from ranking, mixes in-network and out-of-network candidates, uses viewer engagement history, and applies author-diversity adjustments after scoring. ELGL follows those same boundaries using product signals that are already available in the repository.

Reference: <https://github.com/xai-org/x-algorithm> (Apache-2.0).

## Request path

`GET /api/moments/feed?filter=For%20You` remains authenticated by `SupabaseAuthGuard`, is covered by the global throttler, and keeps the existing response shape.

1. **Candidate sources** (`MomentsService.getForYouCandidates`). Two bounded sources run concurrently and degrade independently:
   - Out-of-network: the newest 100 Moments network-wide (`ORDER BY created_at DESC LIMIT 100`).
   - In-network: the newest 40 Moments from followed authors, read from the Redis `timeline_queue:{viewerId}` list (the same read model the `Following` filter uses). When that timeline is cold, the source resolves at most 100 followed authors from `user_follows` and reads their newest 40 Moments instead.
2. **Merge.** In-network Moments come first so that capping the pool can never evict a followed author's Moment in favour of an older out-of-network one. Candidates are de-duplicated by ID and the viewer's own Moments are dropped.
3. **Visibility filters** (unchanged, shared by every filter except `Classmates` where noted): ephemeral stories and non-`moment` post types are removed, targeted-language routing keeps Moments whose `target_language` matches the viewer's native language, and bidirectionally blocked authors are removed.
4. **Pool cap.** Only after every visibility rule has run is the pool capped at 100 candidates. Filtered rows therefore never shrink the pool, and the author and like hydration that follows is bounded to 100 IDs.
5. An exhausted candidate pool returns `[]` directly and never enters the legacy development-data fallback used by other feed filters.
6. `MomentsController` sends only the `For You` filter to `MomentsRankingService`, which removes duplicates and the viewer's own Moments, derives normalised hashtags, loads bounded viewer context, scores the whole pool, and returns the best 50.
7. Ranking scores and private viewer context are never returned to the browser.

The legacy pre-sort (`likes * 2 + comments * 3`, then truncate to 50) and the pinned-first retrieval order were removed from the `For You` path. They decided which Moments the ranker was allowed to see, so the ranker only re-ordered an engagement-selected subset and followed authors' fresh Moments could be dropped before scoring. Ordering is now decided only by the ranker. `All`, `Classmates` and `Following` are unchanged.

All bounds live in `backend/src/moments/moments-for-you.constants.ts`.

## Hashtags and tagging

Hashtags are derived deterministically from `text_content` instead of introducing a second persisted source of truth. Extraction:

- applies Unicode NFKC normalisation;
- starts a tag at a letter, number or underscore, so tags such as `#日本語` work;
- continues through letters, combining marks (`\p{M}`), numbers, underscores and the zero-width non-joiner (U+200C);
- drops a trailing zero-width non-joiner and lower-cases tags for matching;
- de-duplicates tags;
- limits tags to 50 characters and 10 tags per Moment.

Combining marks are part of the tag because scripts such as Devanagari, Tamil, Bengali, Arabic (with harakat) and Hebrew (with niqqud) use them inside ordinary words. Without them `#हिन्दी` was truncated to its first letter, so unrelated Hindi tags collided and hashtag affinity was wrong for learners of those languages. The zero-width non-joiner is kept because Persian tags use it inside words.

For `For You` responses the normalised tags are exposed as the additive optional `hashtags` field. Existing clients can ignore the field, and the frontend `MomentRecord` type now models it. No migration or backfill is required, and edits automatically produce current tags on the next ranking request.

## Ranking signals

The ranker deliberately does **not** copy X's published action weights onto raw ELGL like/comment counts. X's weights apply to model-predicted probabilities; treating them as raw-count weights would be a different algorithm.

ELGL uses these bounded signals:

- 45% recency with a 48-hour half-life;
- 20% log-scaled likes/comments;
- 20% in-network boost for followed authors;
- 13% affinity to hashtags found in the viewer's recent liked Moments;
- 2% existing pinned state.

Selection is greedy: each step picks the candidate with the highest score after a multiplicative author-diversity decay (0.55 per prior pick from the same author, floored at 0.35), breaking ties by newest then by ID, until 50 Moments are chosen. The result is deterministic for identical inputs regardless of candidate order.

## Privacy and security

- The feed endpoint remains authenticated and continues to use the existing block/visibility boundary before ranking. Candidate sources are merged before those filters run, so neither source can bypass them.
- Viewer IDs, followed-author IDs, liked Moment IDs, Moment text, provider errors, and computed ranking scores are not logged.
- Log lines are fixed event keys and metric labels are fixed enumerations. Neither carries user, Moment or content identifiers.
- Personalisation reads do not persist new data and do not introduce additional retention obligations.
- Hashtag extraction operates only on Moment text already authorised for the feed candidate set or on the viewer's own recent liked-history lookup.
- The service returns an honest empty result when no eligible database-backed candidate remains. The ranker also rejects self Moments, duplicate candidate IDs and candidates beyond the 100-candidate pool.
- Abuse resistance: the route is throttled by the global `ThrottlerGuard`, and per-request cost is fixed by the bounds listed under Performance.

## Failure behaviour

Personalisation and each candidate source are ordering or coverage enhancements, not availability dependencies. None of these failures returns a 5xx or falls back to synthetic users or Moments.

| Failure | Log event (warn) | Metric | Result |
| --- | --- | --- | --- |
| Follow, like or liked-history read fails | `moments_for_you_context_unavailable` | `degraded_total{reason="viewer_context_unavailable"}`, ranking outcome `degraded` | Ranked with recency, public engagement and diversity only |
| Redis timeline, follow graph or in-network Moments read fails | `moments_for_you_in_network_source_unavailable` | `degraded_total{reason="in_network_source_unavailable"}` | Served from the out-of-network source |
| Newest-Moments read fails | `moments_for_you_recent_source_unavailable` | `degraded_total{reason="recent_source_unavailable"}` | Served from the in-network source |
| Both sources fail or nothing is eligible | both events above when applicable | ranking outcome `empty` | `[]`, which the client renders as its empty state |

Block, profile and visibility lookups keep their existing behaviour. This change does not broaden a feed when visibility checks fail.

## Observability

Metrics are exposed through the existing Prometheus registry (`MetricsService`). Labels are fixed enumerations, so cardinality is constant.

| Metric | Type | Labels | Purpose |
| --- | --- | --- | --- |
| `hellotalk_moments_for_you_ranking_duration_seconds` | histogram | `outcome`: `ranked`, `degraded`, `empty` | Ranking latency including viewer context loading |
| `hellotalk_moments_for_you_candidates` | histogram | `stage`: `recent_source`, `in_network_source`, `pool`, `served` | Volume at each pipeline stage, for spotting unusually thin or full pools |
| `hellotalk_moments_for_you_degraded_total` | counter | `reason`: `viewer_context_unavailable`, `in_network_source_unavailable`, `recent_source_unavailable` | Requests served without an optional source or context |

End-to-end request latency and status remain available per route from `hellotalk_http_request_duration_seconds`.

Suggested queries:

```promql
# Sustained degradation, by cause
sum by (reason) (rate(hellotalk_moments_for_you_degraded_total[5m])) > 0

# p95 ranking latency
histogram_quantile(0.95, sum by (le) (rate(hellotalk_moments_for_you_ranking_duration_seconds_bucket[5m])))

# Share of requests with nothing to rank
sum(rate(hellotalk_moments_for_you_ranking_duration_seconds_count{outcome="empty"}[15m]))
  / sum(rate(hellotalk_moments_for_you_ranking_duration_seconds_count[15m]))

# Median pool size
histogram_quantile(0.5, sum by (le) (rate(hellotalk_moments_for_you_candidates_bucket{stage="pool"}[15m])))
```

A degraded request can be correlated without database access: the warn event names the failing stage, the matching `degraded_total` reason increments once per occurrence, and the HTTP request log line carries the route and response time.

## Data and migration

No new tables, columns or persisted data are introduced, so there is no new retention or deletion obligation.

Query patterns per request and their supporting indexes:

| Query | Index |
| --- | --- |
| `moments ORDER BY created_at DESC LIMIT 100` | `moments_created_at_idx (created_at DESC)` (new) |
| `moment_likes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100` | `moment_likes_user_created_idx (user_id, created_at DESC)` (new) |
| `user_follows WHERE follower_id = $1 LIMIT 500` (and `LIMIT 100` on a cold timeline) | primary key `(follower_id, following_id)` |
| `moments WHERE user_id IN (up to 100 authors) ORDER BY created_at DESC LIMIT 40` (cold timeline only) | `moments_user_created_idx (user_id, created_at DESC)` |
| `moments WHERE id IN (up to 40 IDs)` and `WHERE id IN (up to 100 IDs)` | primary key |

Before this change neither the newest-Moments read nor the recent-likes read had a matching index, so each request scanned and sorted the whole table. `SPEC.md` already documented `moments.created_at` as indexed.

Migration: `supabase/migrations/20260925090000_moments_for_you_indexes.sql` creates the two new indexes with `IF NOT EXISTS`, so it is additive and safe to retry. `CREATE INDEX` briefly blocks writes to the table. On a large production table, create the indexes first with `CREATE INDEX CONCURRENTLY` outside a transaction using the same names, and the migration then becomes a no-op.

## Performance

Per request the `For You` path adds at most:

- one Redis `LRANGE` (40 IDs) and one Moments-by-ID query (40 IDs), or on a cold timeline one follow query (100 rows) and one newest-40 query;
- one newest-Moments query (100 rows);
- author and like hydration over at most 100 IDs (two queries, unchanged in shape);
- the ranker's one follow query (500 rows), one recent-like query (100 rows) and one liked-Moment text query (100 IDs) when recent likes exist;
- an in-memory pass over at most 100 candidates. Selection is O(pool x 50), so at most about 5,000 comparisons.

There are no unbounded scans, N+1 fetches or background jobs.

## Verification

Focused backend checks:

```bash
cd backend
npx vitest run src/moments src/metrics/metrics.service.spec.ts \
  src/database/migrations/20260925090000_moments_for_you_indexes.spec.ts
npx vitest run --config vitest.e2e.config.mts test/app.e2e-spec.ts
```

Frontend checks:

```bash
cd frontend
npx ng test --no-watch --include src/app/services/moments.store.spec.ts
npm run e2e   # includes the For You flow in cypress/e2e/moments-flow.cy.ts
```

Regression coverage includes:

- source merge, in-network-first ordering, de-duplication, self exclusion and the 100-candidate pool cap;
- visibility filters running before the cap so filtered rows cannot crowd out eligible ones;
- the cold-timeline fallback and its 100-author and 40-Moment bounds;
- independent degradation of each source and of viewer context, including sanitised logs and metric reasons;
- whole-pool scoring: a strong candidate late in retrieval order still wins, and only 50 are returned;
- hashtag extraction across scripts that use combining marks, plus the zero-width non-joiner rules;
- the full HTTP path (`GET /moments/feed?filter=For%20You`): ranked order, safety filtering, no leaked scores or private context, degraded personalisation, empty state and 400 on unsupported filters;
- the client request contract for the `For You` filter in the Moments store.

The runtime `MomentsFeedComponent` unit suite is skipped upstream (`describe.skip`), so client coverage for this filter is the store spec and the Cypress flow.

## Rollout and rollback

Rollout order: apply the migration first, then deploy the backend. The indexes are additive, older application versions ignore them, and the new code also works without them (only more slowly). No frontend version is required: mixed-version clients remain compatible because `hashtags` is optional.

Rollback is code-only: revert the retrieval and ranking changes to restore the previous behaviour. The indexes can stay in place, since they are harmless and also serve other reads, or be removed with `DROP INDEX IF EXISTS public.moments_created_at_idx;` and `DROP INDEX IF EXISTS public.moment_likes_user_created_idx;`. No data cleanup or backfill is required because the feature persists no new state.

## Known limitations

- Targeted-language routing still runs after retrieval, as it does for `All` and `Following`. Viewers whose native language is rare in the network can see a smaller pool. Pushing that predicate into SQL, with a `(target_language, created_at)` index, is a follow-up because the current comparison is case-insensitive in application code.
- The Redis timeline can be sparse after a follow-graph change (existing `Following` behaviour). `For You` uses the follow-graph fallback only when the timeline is empty, and the out-of-network source still applies the in-network boost to followed authors' Moments.
- There is no impression history, so previously seen Moments are not down-ranked.
- Muted words are still applied client-side after the response.

# Moments For You ranking

## Purpose

The `For You` Moments filter uses a bounded, personalized ranking stage inspired by the public architecture of `xai-org/x-algorithm`. The implementation intentionally adapts the architecture rather than vendoring X's Grok/Phoenix serving stack: ELGL does not have the model training, impression history, embeddings, or predicted-action probabilities required to run that system faithfully.

The public X design separates candidate retrieval and visibility filtering from ranking, mixes in-network and out-of-network candidates, uses viewer engagement history, and applies author-diversity adjustments after scoring. ELGL now follows those same boundaries using product signals that are already available in the repository.

Reference: <https://github.com/xai-org/x-algorithm> (Apache-2.0).

## Request path

`GET /api/moments/feed?filter=For%20You` remains authenticated by `SupabaseAuthGuard` and keeps the existing response shape.

1. `MomentsService` retrieves candidates and applies existing Moments visibility rules, language routing, ephemeral/post-type filtering, and bidirectional block filtering.
2. `MomentsController` removes synthetic `mock-moment-*` rows before production output.
3. `MomentsRankingService` bounds the candidate set to 50, removes duplicates and the viewer's own Moments, and derives normalized hashtags from Moment text.
4. The ranker loads at most 500 followed authors and 100 recent likes. Liked Moment text is used only to derive hashtag interests.
5. Candidates receive bounded scores from recency, log-scaled public engagement, followed-author membership, hashtag affinity, and the existing pinned flag.
6. A post-scoring author-diversity pass reduces repeated consecutive exposure from the same author.
7. Ranking scores and private viewer context are never returned to the browser.

## Hashtags and tagging

Hashtags are derived deterministically from `text_content` instead of introducing a second persisted source of truth. Extraction:

- applies Unicode NFKC normalization;
- supports Unicode letters and numbers, so tags such as `#日本語` work;
- lower-cases tags for matching;
- de-duplicates tags;
- limits tags to 50 characters and 10 tags per Moment.

For `For You` responses the normalized tags are exposed as the additive optional `hashtags` field. Existing clients can ignore the field. No migration or backfill is required, and edits automatically produce current tags on the next ranking request.

## Ranking signals

The ranker deliberately does **not** copy X's published action weights onto raw ELGL like/comment counts. X's weights apply to model-predicted probabilities; treating them as raw-count weights would be a different algorithm.

ELGL uses these bounded signals:

- 45% recency with a 48-hour half-life;
- 20% log-scaled likes/comments;
- 20% in-network boost for followed authors;
- 13% affinity to hashtags found in the viewer's recent liked Moments;
- 2% existing pinned state.

After scoring, repeated posts from one author receive a multiplicative diversity decay with a floor. Candidate scores remain independent of private content from other candidates; the diversity adjustment is a post-scoring selector concern.

## Privacy and security

- The feed endpoint remains authenticated and continues to use the existing block/visibility boundary before ranking.
- Viewer IDs, followed-author IDs, liked Moment IDs, Moment text, provider errors, and computed ranking scores are not logged.
- Recent likes are read in one bounded query and their Moment text in one bounded batch query. There is no N+1 fetch.
- Personalization reads do not persist new data and do not introduce additional retention obligations.
- Hashtag extraction operates only on Moment text already authorized for the feed candidate set or on the viewer's own recent liked-history lookup.
- The ranker rejects self Moments, duplicate candidates, synthetic mock IDs, and candidates beyond the 50-item ranking bound.

## Failure behavior and observability

Ranking context is an ordering enhancement, not an availability dependency. If follow or recent-like context cannot be loaded, the service emits only the sanitized warning `moments_for_you_context_unavailable` and continues with deterministic recency/public-engagement/diversity ranking. It never falls back to synthetic users or synthetic Moments.

Existing candidate retrieval and safety failures retain their existing fail behavior. This change does not broaden a feed when visibility checks fail.

## Performance

Per request, personalized ranking adds at most:

- one bounded follow query (500 rows);
- one bounded recent-like query (100 rows);
- one batched liked-Moment text query (100 IDs) when recent likes exist;
- an in-memory ranking pass over at most 50 candidates.

The diversity selector is O(n²), but `n <= 50`, making the upper bound fixed and small. No unbounded scans, background jobs, or schema indexes are introduced.

## Verification

Focused tests:

```bash
cd backend
npm test -- src/moments/moments-ranking.service.spec.ts src/moments/moments.feed-filters.spec.ts
```

Also run the standard repository backend build/lint and GitHub Actions checks.

Regression coverage includes Unicode hashtag normalization, in-network and hashtag-affinity ranking, recency, author diversity, private-context degradation, self/mock/duplicate removal, the 50-candidate bound, and controller routing of only the `For You` filter through the ranker.

## Rollout and rollback

This is an additive backend rollout with no database migration and no required frontend version. Mixed-version clients remain compatible because `hashtags` is optional.

Rollback is code-only: remove the ranking service/controller hook and optional response field. No data cleanup or backfill is required because the feature persists no new state.

# Moments feed filters

The authenticated `GET /moments/feed` route exposes the existing Moments feed through four stable filter values. The product filters covered by issue #1348 are `All`, `Classmates`, and `Following`; `For You` remains supported for backward compatibility.

## Filter contract

| Filter | Behavior |
| --- | --- |
| `All` | Returns the normal authenticated Moments feed after common safety and row-shape checks. |
| `Classmates` | Returns only regular Moments whose `target_language` matches the requested language, or the signed-in learner's primary target language when `lang` is omitted. If the learner has no target language, the result is an honest empty list. |
| `Following` | Returns only regular Moments authored by users the learner currently follows. The current follow graph is re-read before responding so stale Redis timeline entries from users who were later unfollowed cannot leak into the feed. The learner's own Moments are excluded. |
| `For You` | Preserves the existing recommendation-oriented feed behavior and passes through the same common safety boundary. |

Language values are trimmed and normalized to lowercase. Unsupported filter values return `400 Bad Request` rather than silently broadening to `All`.

## Common response boundary

Responses are bounded to 50 unique Moments. The final policy layer removes:

- legacy synthetic `mock-moment-*` rows;
- ephemeral Story rows;
- question/language-question rows;
- duplicate Moment IDs.

The existing `MomentsService` remains responsible for datastore retrieval, bidirectional block filtering, author hydration, likes, and timeline-cache use. `MomentsFeedService` is the final policy boundary before the controller returns a feed.

## Security and privacy

All feed requests remain protected by `SupabaseAuthGuard`. `Following` membership is verified server-side against `user_follows`; browser input cannot supply an arbitrary author allow-list. If that authoritative membership lookup fails, the backend returns a stable `503` instead of guessing that stale timeline rows are still allowed.

Diagnostics intentionally avoid user IDs, Moment IDs, profile text, tokens, and raw provider/database errors. No new personal data is stored and no schema migration is required.

## Failure behavior

- Missing authentication is handled by the existing authentication guard.
- Invalid filters return `400`.
- A Classmates request without any resolvable target language returns `[]`.
- Following membership-store failure returns `503` with a generic message.
- Empty feeds return `[]`; the API never exposes legacy generated mock Moments to hide an empty result.

## Verification

Focused backend coverage:

```bash
cd backend
npm test -- src/moments/moments.feed-filters.spec.ts src/moments/moments-feed.service.spec.ts
```

The normal repository CI remains the merge gate for formatting, linting, build, backend unit/E2E tests, database checks, and dependency review.

## Rollout and rollback

This is an additive backend policy layer with no schema or response-shape migration. Deploy the backend normally. Mixed frontend versions remain compatible because the route, query parameters, and array response are unchanged.

Rollback is code-only: revert the controller/service/module changes. No database cleanup is necessary. If rollback is required, do not reintroduce fail-open Following behavior for unverifiable memberships; prefer returning an unavailable response until the authoritative follow graph can be read.

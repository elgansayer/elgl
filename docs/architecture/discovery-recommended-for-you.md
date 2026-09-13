# Discovery Recommended for You

Issue #835 adds a bounded `Recommended for You` carousel to Discovery without creating a second background recommender.

## Data flow

`GET /recommendations/discovery` is authenticated by the existing Supabase auth guard and returns at most 10 profile-card records. `DiscoveryRecommendationsService` uses the existing daily recommendation service/cache as its first candidate seed, supplements a cold or sparse cache with bounded shared-interest and reciprocal-language queries, and then re-hydrates every candidate from the current `users` row before returning it.

The cache is therefore only an ID seed. Cached display names, avatars, activity, privacy state, and eligibility are never trusted by this endpoint. A user who hides their profile, starts deletion, is deleted, blocks the requesting user, or is blocked by the requesting user is removed on the next request even when their ID remains in the 24-hour daily cache.

## Ranking contract

Ranking is deterministic and intentionally simple enough to audit:

| Signal | Internal weight | Client-visible reason |
| --- | ---: | --- |
| Reciprocal native/target language compatibility | 50 | `language_exchange` |
| Shared interests | 15 each, capped at 3 | `shared_interests` |
| Activity in the last 24 hours | 20 | `active_recently` |
| Activity in the last 7 days | 10 | `active_recently` |
| 7+ day study streak or serious-learner marker | 10 | `study_streak` |

Ties are resolved by shared-interest count, activity bucket, then user ID. The numeric score is server-internal and is not returned to clients. Raw `last_active_at` values are also never returned by this API.

If a user has `privacy_hide_online_status` enabled, their `last_active_at` value is not used as a recommendation signal. The service still allows other non-private signals such as reciprocal language compatibility or shared interests to qualify the profile.

## Eligibility and bounds

The endpoint enforces the same core discoverability boundary used by Discovery and adds cache revalidation:

- excludes the requesting user;
- excludes both blocked and blocker IDs through `SafetyService`;
- excludes `privacy_hide_from_search` profiles;
- excludes deletion-pending and deleted profiles;
- requires a non-empty display name plus native and target languages;
- considers at most 80 candidate IDs, at most 400 shared-interest rows, and returns at most 10 results.

The feature does not introduce a schema migration, new user-visible private fields, or mock-data fallback. Provider failures in optional seed sources degrade to the remaining sources. A failure to load the requesting profile or to perform the final privacy revalidation fails the endpoint rather than serving stale data.

## Frontend behavior

The carousel is composed into the Discovery global-search area and loads once when the component is created. It deliberately does not auto-refresh or reorder while the user is interacting. The UI provides:

- loading skeletons;
- empty and retryable error states;
- native horizontal touch scrolling with scroll snapping;
- previous/next controls and Left/Right keyboard navigation;
- visible focus treatment and minimum touch targets;
- reduced-motion handling;
- profile links and a `See all partners` fallback to the ordinary Discovery results;
- short, explainable recommendation reasons rather than ranking internals.

## Verification

Focused backend tests cover ranking order, privacy-hidden activity, discoverability exclusions, stable ties, result bounds, and sparse profiles. Controller coverage verifies authenticated user scoping. Frontend tests cover render order, reasons, canonical profile navigation, keyboard navigation, empty state, and retryable failure state. Existing Global Search tests provide a mocked recommendation dependency so the new composition remains isolated.

The repository CI remains authoritative for full backend/frontend test, lint, type-check, design and translation-safe API verification.

## Rollout and rollback

No database migration or backfill is required. Deploy backend and frontend together so the carousel does not request an endpoint missing from an older backend. During staged rollout, an endpoint failure is contained to the carousel error state and does not prevent ordinary Discovery search.

Rollback is a normal application revert: remove the carousel composition/client and the discovery recommendation service/controller route. The existing nightly recommendation cache remains compatible and does not need to be cleared because this feature only reads it as a seed.

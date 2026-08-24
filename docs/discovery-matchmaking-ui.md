# Matchmaking and Discovery UI

Issue #959 is implemented by the existing Angular `DiscoveryComponent` and its shared filter primitives rather than by a second discovery surface.

## Product contract

`/discovery` owns partner matchmaking. The screen exposes the repository's canonical discovery filters and sends them through `DiscoveryService.findPartners()`:

- distance is expressed in kilometres in the UI and converted to `radius_metres` at the API boundary;
- native language, target language, proficiency and audio-intro filters are collected by the shared global-search control;
- the user's target languages are also available as fast target-language pills;
- the Serious Learner filter maps to `serious_learner_only` while the separately persisted Serious Learner mode remains owned by the account/discovery preference flow;
- age, VIP-gated gender, interests, availability, voice-room activity and sort options continue to compose with the same request rather than starting parallel searches.

Changing an age or distance slider uses the existing 300 ms debounce. A new search aborts the previous request, and only the active request may clear the loading state or replace results. Reset restores the default 50 km radius, 18-100 age range, best-match sort and clears optional filters before issuing one new search.

## State and failure behaviour

The component has explicit loading, result, empty and retryable error states. Search errors do not mutate the selected filters, so Retry repeats the user's current criteria. Superseded requests are ignored after cancellation so a slow response cannot overwrite newer results.

Blocked users are removed before partner cards are exposed even when a lower layer returns a stale cached result. Server-side discovery eligibility and privacy checks remain authoritative; the client-side block pass is defence in depth, not a replacement for backend authorization.

Offline discovery remains owned by `OfflineDiscoveryCacheService` and `DiscoveryService`. The UI indicates when it is offline and when cached data is being used. This issue does not add another cache or another persistence model.

## Accessibility and responsive behaviour

The screen uses the existing Spartan controls and shared slider/language-picker primitives. Filters have programmatic labels, the result region exposes loading/error semantics, and controls remain keyboard operable. Filter rows wrap or horizontally scroll on narrow screens rather than requiring a desktop viewport. Important state is expressed in text/ARIA state rather than colour alone.

## Verification

`frontend/src/app/components/discovery/discovery-filter-contract.spec.ts` is the active Vitest contract suite for #959. It verifies that distance, native/target language and Serious Learner criteria reach the canonical search request, that VIP-only gender filtering is not sent for free users, that blocked users are removed, failures expose the retryable error state, reset restores defaults, and superseded requests cannot replace newer results.

`frontend/src/app/components/discovery/discovery-search-race.spec.ts` separately locks loading-state ownership during overlapping searches. The older broad discovery component suite remains untouched for historical coverage while the focused #959 contract is executable in normal CI. Shared primitives retain their own component-level coverage.

## Rollout and rollback

There is no database migration, new endpoint or persisted-data change for #959. Deploy using the normal frontend release pipeline. Rollback is a normal revert of the issue-completion PR; the existing production discovery route and API contract are unchanged.

Nearby geolocation, persisted Serious Learner mode semantics and recommendation-carousel work are intentionally left to their dedicated issues/PRs so this completion change does not duplicate or conflict with those implementations.

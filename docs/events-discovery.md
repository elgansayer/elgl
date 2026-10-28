# Events discovery

Issue: #852

## Product boundary

`/events` is the centralized authenticated discovery feed for scheduled activities. It reuses the existing NestJS Events module and does not introduce a second event store, recommender, RSVP implementation, or creation API.

The feed defaults to upcoming events, chronological ordering, page 1 and a 20-item page size. Users can switch between upcoming and past events, filter by language pair, and filter by the backend-owned event category catalogue. Filter changes reset pagination and the newest request wins if responses arrive out of order.

Upcoming discovery intentionally suppresses events already marked `is_cancelled`. Past history remains visible so previously attended or referenced events are not silently lost.

## API contract

The Angular `EventsService` is the typed boundary for:

- `GET /events` for bounded discovery;
- `GET /events/categories` for the canonical category catalogue;
- `GET /events/:id` for event details;
- the existing create, RSVP and user-event endpoints used by adjacent features.

Category query values are the server values `audio_room`, `learning_seminar`, `in_person_meetup`, and `cultural_exchange`; translated display labels are presentation only.

The backend `EventsQueryDto` now caps `limit` at 100. The product feed continues to request 20 rows. This prevents callers from turning the collection endpoint into an unbounded scan while remaining backward compatible with existing clients using normal page sizes.

## Event details and routing

A dedicated `/events/:id` route loads the canonical detail endpoint and renders event content using Angular text interpolation, not HTML injection. Host navigation uses the existing `/profile/:userId` route. Attending and interested counts are rendered only when the backend returns them; attendee identity lists are not exposed by this surface.

`eventDetailRoutes` is composed before the historical app route table in `app.config.ts`. This is deliberate because the legacy route table is large and already owns `/events`; prepending only the detail route avoids duplicating or reordering unrelated application routes.

## Timezone behavior

The API continues to exchange ISO timestamps. Event feed and detail views parse the timestamp and format it with `Intl.DateTimeFormat` using the current application language and the browser's local timezone. DST conversion is therefore delegated to the browser's IANA timezone data rather than hard-coded offsets.

Invalid timestamps are displayed unchanged instead of throwing and breaking the feed.

## Failure and concurrency behavior

The feed distinguishes initial loading, empty results, initial failure, successful results, load-more pending, and load-more failure. Already loaded rows remain available when a later page fails. Pagination advances only after a successful response, so retrying a failed page cannot skip data.

Filter requests use monotonically increasing request identifiers. A slower response from an earlier filter selection cannot replace the current results.

The detail view similarly keeps a request identifier and exposes a retry action without leaking backend exception text.

If the category catalogue fails to load, event discovery still works with status/language filters; the category selector simply has no server-owned choices to apply.

## Accessibility and high zoom

Status selection remains a Spartan radio group so the mutually exclusive state is programmatic and keyboard operable. Select controls reuse `AppSelectComponent`. Event summaries use Relay cards, preserve heading hierarchy, expose normal links to details, and retain focus-visible rings. Command/link targets use the repository touch-size convention and flex layouts wrap rather than relying on fixed horizontal space.

Loading uses status semantics, failures use alert semantics, and the no-results state uses the shared empty-state primitive. Important state is not communicated by colour alone.

## Security and privacy

All event API routes remain behind `SupabaseAuthGuard`. This change does not move data access to Supabase from the browser and does not add public event endpoints. User-generated title, description, location and host text are rendered as text. No tokens, attendee lists, raw activity timestamps or private profile fields are logged or added to URLs.

The detail route takes only the event identifier from the URL and delegates authorization/data visibility to the existing authenticated backend endpoint.

## Verification

Regression coverage includes:

- frontend query serialization and server category loading;
- event detail endpoint use;
- initial discovery loading and category catalogue loading;
- status, language and category reset behavior;
- rejection of non-canonical category values;
- stale-response protection;
- cancelled-upcoming suppression;
- detail navigation;
- exact-page retry after load-more failure;
- accessible first-page failure/retry;
- detail loading, host navigation, retry and unsafe-content rendering as text;
- backend rejection of page sizes greater than 100.

Repository CI remains authoritative for Angular/Vitest, NestJS/Jest, lint, build, design-governance and translation-safety gates.

## Rollout and rollback

No database migration is required. Deploy backend and frontend in either order: the only backend contract change is stricter rejection of `limit > 100`, while existing production UI requests `limit=20`.

Rollback is a normal revert of this PR. No persisted data requires cleanup and no schema state is introduced.

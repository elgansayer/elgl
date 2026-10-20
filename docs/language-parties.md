# Language Parties

Language Parties are the spoken-practice subset of the existing LiveKit-backed audio-room platform. The feature reuses the authenticated audio-room lifecycle instead of introducing a second realtime or media stack.

## Product flow

The Angular `LanguagePartiesComponent` lists active rooms from `GET /audio-rooms/list?type=language_party`. Optional topic and proficiency filters are forwarded to that bounded backend list endpoint; the language-pair filter is applied to the returned language-party collection. The page exposes explicit loading, empty, filtered-empty, unavailable, and retry states.

Creating a party uses `POST /audio-rooms/language-parties` with a title, language pair, topic, level, and optional video flag. On success the client joins the authoritative room returned by the backend through `AudioRoomsStore`, which owns the existing LiveKit/Centrifugo connection lifecycle. Joining a listed party first reloads the room by ID so stale list data is not treated as the authoritative join contract.

The generic audio-room browser also continues to expose language-grouped rooms through `GET /audio-rooms/by-language`; Language Parties are a focused product surface over the same room records rather than duplicated persisted data.

## Client trust boundary

Audio-room responses are network input even when they come from the authenticated API. The Language Parties surface validates and bounds them before rendering or joining:

- list responses are arrays of at most 50 parties;
- malformed and duplicate list rows are discarded rather than rendered;
- identity, title, language, topic and participant fields have explicit length/count ceilings;
- avatar URLs are limited to credential-free HTTP(S) URLs and are rendered with `no-referrer`;
- an authoritative join lookup must return the requested room ID, an active room and either `party_type=language_party` or the mixed-version legacy response with no party type;
- stale, mismatched or different room types never reach `AudioRoomsStore.joinRoom()`.

This is defence in depth. Backend authentication, privacy and room membership remain authoritative.

## Creation, retry and concurrency behavior

Submitting the create modal no longer destroys the draft before the backend confirms creation. While the request is in flight, the modal and its controls are busy/disabled and duplicate submissions are ignored. A provider or persistence failure keeps the modal open, keeps the entered values intact, exposes an accessible error, and allows an explicit retry.

Creation and LiveKit joining are treated as two different state transitions. If the backend creates a room successfully but the subsequent LiveKit join fails, the client retains that validated room for the same unchanged payload. Retrying attempts to join the already-created room instead of issuing another `POST` and creating a duplicate party. Closing the modal deliberately abandons that local retry state; the already-created room remains available through the normal party list.

Only one listed-room join can be in progress at a time. Rapid clicks cannot start competing LiveKit connection lifecycles.

## Failure and retry behavior

A list-provider failure is not represented as a successful empty party list. Angular `resource()` retains the failure state and the page renders an accessible alert with a retry action. Invalid or unbounded list payloads are treated as unavailable rather than being trusted.

Creation and join failures retain the relevant retry state and use the existing translated toast failure path. A failed create never emits or joins a fabricated room. A failed authoritative room validation never opens a LiveKit connection.

## API compatibility

The backend list controller accepts the query parameter `type`; callers must not use the historical client-only name `party_type`. The persisted database field remains `party_type`, and the backend maps the public `type` filter to that storage field. This distinction is deliberate so the browser contract matches the controller while storage naming remains unchanged.

No schema migration is required. Existing room rows, LiveKit identities, Centrifugo channels, recordings, moderation, speaker controls, private-party support, and archive behavior are unchanged.

## Security and privacy

All audio-room controller routes remain behind `SupabaseAuthGuard`. The client never receives LiveKit server credentials and does not log party titles, room IDs, user IDs, access tokens, provider response bodies, or rejected room payloads. Existing backend membership, moderation, rate-limit, block, and room-state rules remain authoritative.

The listing path narrows discovery to `language_party` rows instead of the unfiltered active-room collection and does not broaden access to private rooms.

## Accessibility and responsive behavior

The page keeps its existing Spartan/native interaction ownership. Loading, empty and unavailable states remain textual rather than colour-only. The unavailable state uses `role="alert"`, and Retry is a touch-sized native Spartan button. User-supplied party/host text uses direction-aware rendering for mixed RTL/LTR content.

The create dialog exposes `aria-busy` while persistence/join work is running, prevents accidental dismissal during the mutation, and associates retryable failures with an assertive alert. Join controls expose their busy state and remain at least 44px tall. Existing responsive card grids and translated labels remain unchanged.

## Verification

Focused component/contract coverage verifies:

- the browser sends `type=language_party` rather than the unsupported `party_type` query key;
- listing failures and invalid/unbounded responses become retryable unavailable state;
- malformed/duplicate party rows and unsafe avatar URLs cannot enter rendered state;
- create requests use the dedicated language-party endpoint and join the validated returned room;
- create failures retain the modal and form values;
- repeated clicks cannot duplicate an in-flight create;
- a post-create LiveKit failure retries the existing room without issuing a duplicate create request;
- joining a listed party reloads and validates the authoritative room before entering it;
- mismatched/stale room responses are rejected and listed-room joins are serialized.

Repository pull-request CI remains authoritative for the full frontend unit, static-analysis, production-build, translation-safety, accessibility/design governance, backend, and E2E gates.

## Rollout and rollback

This is an application-only hardening change with no data migration. Deploy the frontend normally. Existing backend contracts remain compatible with older clients.

Rollback is a normal code revert; there is no persisted state or media cleanup. Reverting would restore the historical behavior where create drafts close before persistence is confirmed and post-create join retries can create duplicate rooms, so those failure modes should be considered before rollback.

# Language Parties

Language Parties are the spoken-practice subset of the existing LiveKit-backed audio-room platform. The feature reuses the authenticated audio-room lifecycle instead of introducing a second realtime or media stack.

## Product flow

The Angular `LanguagePartiesComponent` lists active rooms from `GET /audio-rooms/list?type=language_party`. Optional topic and proficiency filters are forwarded to that bounded backend list endpoint; the language-pair filter is applied to the returned language-party collection. The page exposes explicit loading, empty, filtered-empty, unavailable, and retry states.

Creating a party uses `POST /audio-rooms/language-parties` with a title, language pair, topic, level, and optional video flag. On success the client joins the authoritative room returned by the backend through `AudioRoomsStore`, which owns the existing LiveKit/Centrifugo connection lifecycle. Joining a listed party first reloads the room by ID so stale list data is not treated as the authoritative join contract.

The generic audio-room browser also continues to expose language-grouped rooms through `GET /audio-rooms/by-language`; Language Parties are a focused product surface over the same room records rather than duplicated persisted data.

## Failure and retry behavior

A list-provider failure is not represented as a successful empty party list. Angular `resource()` retains the failure state and the page renders an accessible alert with a retry action. Retrying reissues the same `type=language_party` contract.

Creation and join failures retain the current page/modal state and use the existing translated toast failure path. A failed create never emits or joins a fabricated room.

## API compatibility

The backend list controller accepts the query parameter `type`; callers must not use the historical client-only name `party_type`. The persisted database field remains `party_type`, and the backend maps the public `type` filter to that storage field. This distinction is deliberate so the browser contract matches the controller while storage naming remains unchanged.

No schema migration is required. Existing room rows, LiveKit identities, Centrifugo channels, recordings, moderation, speaker controls, private-party support, and archive behavior are unchanged.

## Security and privacy

All audio-room controller routes remain behind `SupabaseAuthGuard`. The client never receives LiveKit server credentials and does not log party titles, room IDs, user IDs, access tokens, or provider response bodies as part of this change. Existing backend membership, moderation, rate-limit, block, and room-state rules remain authoritative.

The listing fix narrows discovery to `language_party` rows instead of accidentally requesting the unfiltered active-room collection. It does not broaden access to private rooms.

## Accessibility and responsive behavior

The page keeps its existing Spartan/native interaction ownership. Loading, empty, and unavailable states remain textual rather than colour-only. The unavailable state uses `role="alert"`, and Retry is a touch-sized native Spartan button. Existing responsive card grids and translated labels remain unchanged.

## Verification

Focused component coverage verifies:

- the browser sends `type=language_party` rather than the unsupported `party_type` query key;
- listing failures are exposed through the resource error state and can be retried;
- create requests use the dedicated language-party endpoint and join the returned room;
- joining a listed party reloads the authoritative room before entering it;
- filter/modal behavior remains intact.

Repository pull-request CI remains authoritative for the full frontend unit, static-analysis, production-build, translation-safety, accessibility/design governance, backend, and E2E gates.

## Rollout and rollback

This is an application-only correction with no data migration. Deploy the frontend normally. Rollback is a normal code revert; there is no persisted state or media cleanup. Reintroducing `party_type` as the public list query key would restore the filtering bug and should not be used as a rollback strategy.

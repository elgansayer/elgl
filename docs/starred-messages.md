# Starred messages

Issue #1745 completes starred-message retrieval on top of the existing favourites data model. A star remains the existing `(user_id, message_id)` favourite relationship; this change does not create a second bookmark table or duplicate message content outside that row.

## API contract

New clients retrieve saved chat messages through the authenticated `GET /favourites/messages` endpoint.

Query parameters are bounded and validated by NestJS:

- `limit`: 1-100, default 50;
- `offset`: 0-10000, default 0.

The response is:

```json
{
  "items": [],
  "has_more": false,
  "next_offset": null
}
```

`next_offset` advances by the requested page size and is `null` on the final page. The endpoint intentionally fetches one extra favourite row rather than requesting an exact database count, avoiding an unnecessary count scan over private chat metadata.

The existing `GET /favourites`, `/favourites/user/:userId`, and `/chat/favourites` routes remain available for mixed-version clients. Star creation and removal use the canonical authenticated `/favourites` routes in the Angular `FavouriteService`.

## Authorization and privacy

The database write trigger continues to verify room membership when a star is created and rebuilds the stored snapshot from the canonical message row instead of trusting client JSON.

Retrieval also re-checks current state because a saved snapshot can outlive a later room-membership or message-state change. For every bounded page, the backend verifies the corresponding current `chat_messages` rows and current `chat_room_members` rows in two batched queries. A saved item is omitted when:

- the current user is no longer a member of the room;
- the message was deleted for everyone;
- the message was deleted for the current user;
- the canonical message no longer exists.

Provider or membership-verification failures fail closed with generic application errors. Message text, notes, media URLs, user identifiers, tokens, and provider error payloads are not added to logs.

View-once media remains protected by the existing favourite-normalisation trigger, which removes reusable media URLs from the stored snapshot.

## Frontend behaviour

`FavouritesComponent` now uses the dedicated `FavouriteService` rather than the broader `ChatService` compatibility routes. It follows the server pagination contract in 100-item pages, rejects non-advancing pagination, and stops after 500 retrieved items in one screen load so a corrupted or unexpectedly large account cannot cause an unbounded request loop.

The existing user-visible states remain intact:

- loading is announced through the existing live status;
- a failed retrieval is shown as a retryable error rather than an empty list;
- stale requests are ignored after a newer load or component destruction;
- removal remains server-confirmed and duplicate in-flight deletes are suppressed;
- text, correction, and voice filters retain the existing keyboard, screen-reader, RTL, and high-zoom behaviour.

## Verification

Focused automated coverage includes:

- DTO bounds for the paged query through NestJS validation;
- controller ownership of the authenticated user ID;
- service coverage for page look-ahead, current-message visibility, current room membership, deletion filtering, and fail-closed provider errors;
- Angular API-client coverage for the canonical `/favourites/messages` query and malformed pagination metadata;
- component coverage for multi-page retrieval, non-advancing pagination, filtering, deletion deduplication, audio playback, and list semantics;
- the cross-layer starred-message contract test for the route and service boundary.

Repository CI remains authoritative for full backend/frontend type checking, linting, unit tests, accessibility/design governance, and E2E contracts.

## Rollout and rollback

No migration is required. Deploy the backend before or with the frontend so the new paged endpoint is available when the Angular client switches to it. Existing routes remain compatible during a mixed-version deployment.

Rollback is a normal code revert. The existing favourites table, normalization trigger, and historical migrations are unchanged, so no data rollback or cleanup is required.

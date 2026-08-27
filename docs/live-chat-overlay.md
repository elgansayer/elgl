# Live chat overlay contract

Issue #1777 adds a bounded visual projection of live-room chat over host video streams.

## Architecture

`AudioRoomsStore` remains the single owner of the `room_<roomId>` Centrifugo subscription. It validates the active room lifecycle and appends `chat_message` events to `roomMessages`. `LiveChatOverlayComponent` does not create a second realtime subscription because `CentrifugeService` intentionally maintains one publication handler per channel; a second subscriber would replace the store handler and could cause either the room chat or overlay to stop receiving messages.

The overlay receives its room ID from the existing audio-room template and renders only when that ID matches `AudioRoomsStore.currentRoom().id`. This prevents stale comments from a room transition from being displayed over the next room. No new API, persistence, database table, migration, or background job is introduced.

## Rendering and bounds

The overlay is a visual duplicate of the canonical room chat and therefore:

- renders only the newest 30 unique messages;
- requires a non-empty message ID and text;
- rejects IDs longer than 128 Unicode code points;
- limits display names to 80 Unicode code points;
- limits visible comment text to 500 Unicode code points;
- deduplicates replayed realtime events by message ID, keeping the newest payload;
- uses normal Angular text interpolation, never `innerHTML`;
- uses `dir="auto"` for mixed RTL/LTR user content;
- does not persist or log comment content.

The full canonical message remains available in the room-chat panel. Overlay truncation affects display only.

## Accessibility and motion

The overlay is non-interactive (`pointer-events: none`) so it cannot block video controls, keyboard focus, or touch gestures. It is marked `aria-hidden="true"` because the same messages are already represented in the canonical room-chat UI; announcing both surfaces would duplicate live content for screen-reader users.

New comments use a short entrance animation for sighted users. `prefers-reduced-motion: reduce` disables that animation completely. User content is not communicated by colour alone.

## Failure and privacy behavior

Malformed realtime records are dropped from the overlay rather than rendered partially. Missing sender names fall back to the localized generic user label. If the active room and requested overlay room differ, the overlay renders nothing. Centrifugo outages continue to use the existing `AudioRoomsStore` / degradation-service behavior; the overlay does not invent stale or synthetic messages.

Because the overlay consumes the already-authorized room stream, it does not add a new authorization boundary. It deliberately avoids a parallel subscription, new telemetry containing message text, or any client-side persistence of live-room comments.

## Verification

Focused component tests cover:

- canonical room-chat rendering;
- room-switch isolation;
- duplicate replay handling and the 30-message cap;
- malformed and overlong realtime payloads;
- Unicode-safe display bounds;
- text-only rendering of markup-shaped content;
- mixed-direction content;
- non-interactive and screen-reader-duplicate suppression behavior.

Run the focused suite with the repository's normal frontend Vitest command targeting `live-chat-overlay.component.spec.ts`. Repository CI remains the authoritative full verification gate.

## Rollout and rollback

This is a frontend-only, backward-compatible change. It can be deployed independently of backend/database versions because the existing `chat_message` event and `AudioRoomsStore.roomMessages` contract are unchanged.

Rollback is a normal code rollback of the component and its tests. There is no persisted state or schema to reverse. During a mixed-version rollout, older clients may continue using the former parallel subscription while newer clients consume canonical store state; no server-side contract changes are required.

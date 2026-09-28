# Audio room stage UI contract

Issue: #993

`AudioRoomComponent` is the product surface for active audio rooms. It reuses the existing authenticated audio-room API, `AudioRoomsStore`, LiveKit connection, and Centrifugo room channel. This change does not add a parallel room model or a second realtime path.

## Runtime data flow

When a user joins a room, `AudioRoomsStore.joinRoom()` keeps the selected `AudioRoomRecord` as the immediate room snapshot and requests `GET /audio-rooms/:id/stage` for the richer stage state. The stage response supplies the host profile, co-host ID, speaker profiles, raised hands, and listener count. LiveKit/Centrifugo continue to update speaking, mute, promotion, demotion, and room lifecycle state.

The visual model is deliberately normalized before rendering:

- The host is rendered exactly once and first, even during a mixed-version rollout where an older room row does not include the host in its `speakers` array.
- The co-host is rendered after the host when present.
- Speaker cards are keyed only by backend-provided user IDs. Display names are never used as identities.
- The stage renders at most 24 participant cards and summarizes any remainder as `+N`, preventing an unexpectedly large payload from causing unbounded DOM work.
- Listener counts are finite, non-negative integers capped at 10,000 before use by the UI.
- The audience renders at most eight anonymous seats and summarizes the remainder. The current stage API does not expose listener profiles, so the frontend does not fabricate listener names or infer identities from unrelated data.

## Loading and failure behavior

The existing room-directory loading and empty states remain unchanged. After a room is selected, the room snapshot is immediately sufficient to show the title, host identity, and listener count while the stage request is in flight.

`GET /audio-rooms/:id/stage` remains best-effort in `AudioRoomsStore`. If it is slow or unavailable, the UI keeps the room-snapshot host and listener count instead of blanking them. When the stage response arrives, the normalized stage state becomes authoritative.

LiveKit degradation continues to be handled by `AudioRoomDegradationService`; the stage UI does not invent a successful media connection. Realtime speaker mutations remain server-authorized and are only reflected from the existing store/API paths.

## Accessibility and responsive behavior

The stage and audience are exposed as semantic lists with list items. Empty states use status semantics. Host/co-host and muted state have textual labels in addition to color or icons, and the active-speaker indicator remains supplementary rather than the only description of a participant.

The existing responsive grid remains two columns on narrow viewports and expands at larger breakpoints. The bounded participant count prevents the room surface from becoming unusable under high zoom or unusually large room state.

## Security and privacy

This change adds no API endpoint, schema, storage, credential, logging, analytics, or authorization surface. Room and participant identities still come from authenticated backend responses. Listener identities are intentionally not exposed because the current API only provides a count.

No private room content, access tokens, LiveKit credentials, user IDs, or room payloads are added to logs by this UI normalization layer.

## Verification

`audio-room-view-model.spec.ts` covers:

- host fallback and de-duplication;
- host/co-host ordering;
- preservation of live speaking/mute state;
- duplicate participant IDs;
- bounded stage rendering and overflow counts;
- invalid, fractional, and oversized listener counts;
- bounded anonymous audience-seat rendering.

The normal frontend unit, static-analysis, production-build, translation-safety, UI-design, and repository CI workflows remain the authoritative integration checks.

## Rollout and rollback

There is no migration and no API contract change. Deploy the frontend normally after required checks pass. Mixed frontend/backend versions are supported because the view model accepts both the room snapshot and the existing stage response.

Rollback is a normal revert of this change. No persisted data requires cleanup or transformation.

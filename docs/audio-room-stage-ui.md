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

The stage and audience are exposed as semantic lists with list items. Empty states use status semantics. Host/co-host and muted state have textual labels in addition to colour or icons, and the active-speaker indicator remains supplementary rather than the only description of a participant.

The existing responsive grid remains two columns on narrow viewports and expands at larger breakpoints. The bounded participant count prevents the room surface from becoming unusable under high zoom or unusually large room state.

## Security and privacy

This change adds no API endpoint, schema, storage, credential, logging, analytics, or authorization surface. Room and participant identities still come from authenticated backend responses. Listener identities are intentionally not exposed because the current API only provides a count.

No private room content, access tokens, LiveKit credentials, user IDs, or room payloads are added to logs by this UI normalization layer.

Host moderation may mute a speaker or remove them from the stage, but it never remotely unmutes a participant. Restoring microphone capture always requires an action by that participant. The authenticated API and audio-room service intentionally expose no remote-unmute operation.

Mute and kick are enforced by the LiveKit server API before the endpoint reports success. Mute applies to the participant's published microphone tracks. Kick revokes LiveKit publish permission before removing the participant from the persisted speaker list. The Centrifugo event remains a UI synchronisation mechanism rather than the security boundary.

Supabase mutations and every required Centrifugo publication are checked. A rejected media-plane, persistence, or notification operation returns an unavailable response, so the frontend cannot show a successful moderation toast for a failed action. Retrying mute is safe because already-muted tracks are skipped; retrying kick is safe because speaker removal and permission revocation are idempotent.

Privileged moderation attempts are persisted through `AdminAuditService` with the actor, target speaker, room, `moderation_enforcement` reason, request correlation ID, and final `success`, `denied`, or `failed` outcome. Identifiers remain structured data fields and are never interpolated into audit messages.

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

There is no migration and no request-body contract change. Deploy the backend before or with the existing frontend. Mixed frontend/backend versions are supported because moderation still uses the established endpoints and event payloads.

Rollback is a normal code revert and no schema cleanup is required. A failed kick after LiveKit revocation can leave the participant unable to publish while the database still lists them on stage; retry the kick to converge, or re-approve the speaker to restore publish permission. Audit records are retained under the existing admin audit retention policy and are not removed during rollback.

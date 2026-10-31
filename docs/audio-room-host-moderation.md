# Audio room host moderation

Issue #1759 completes the existing host controls for muting a stage speaker and returning a speaker to the listener audience. It reuses `AudioRoomsService`, `AudioRoomsStore`, the `audio_rooms.speakers` source of truth, LiveKit participant administration, and the existing `room_{audio_room_id}` Centrifugo channel.

## Behaviour and authority

Only the authenticated room host may call either mutation. The server derives the actor from the Supabase session and rejects attempts to moderate the host. A mute also rejects a target who is not currently a stage speaker. The Angular host-only controls are a usability boundary and do not replace these server checks.

Mute follows this order:

1. Read the authoritative room row and verify host and target rules.
2. Resolve the target's exact LiveKit identity, failing closed if a legacy shortened identity is ambiguous.
3. Mute every active microphone track through `RoomServiceClient.mutePublishedTrack`.
4. Publish `force_mute` so the target client disables its local microphone and every room client updates muted presentation.

Stage removal follows this order:

1. Read the authoritative room row and verify host and target rules.
2. Revoke LiveKit `canPublish` before changing application state, immediately unpublishing active media even if the client is uncooperative.
3. Remove the user from `audio_rooms.speakers` and clear `co_host_id` when applicable.
4. Publish `speaker_demoted`, plus `co_host_removed` when applicable.

`POST /audio-rooms/kick-speaker` is retained as a backward-compatible alias to the canonical `demote-speaker` behaviour. Both paths use the same permission, persistence, and realtime implementation.

## Failure and recovery

LiveKit lookup, identity ambiguity, mute, or permission-revocation failure stops the mutation before persistence or realtime notification. A disconnected target has no active media, so the persisted stage action may continue safely. Database failure after permission revocation leaves the target unable to publish while the room row remains unchanged; retrying the idempotent action reconciles the row without restoring unsafe publishing.

Centrifugo delivery is best effort after LiveKit and room state are authoritative. Delivery failure is logged as a correlated partial failure without room content or provider payloads. Clients recover stage membership from the room and stage endpoints, while LiveKit remains authoritative for active media.

The host UI disables moderation controls while an action is pending. Removing a speaker requires confirmation with consequence text. Success and failure use translated toast copy, and the visible controls have participant-specific accessible names and busy state.

## Observability and privacy

Successful, denied, and failed actions emit a structured `audio_room_host_moderation` log containing the action, actor ID, target user ID, room ID, fixed reason code, outcome, and a server-generated correlation ID. Provider failures log only a stable error code and error class. No LiveKit token, track payload, room content, display name, or provider response is logged.

## Verification, rollout, and rollback

Focused backend tests cover server authorization, host self-protection, LiveKit microphone muting, publish revocation, persistence, canonical realtime payloads, backward-compatible routing, and fail-closed provider behaviour. Frontend tests cover request contracts, state updates, confirmation, cancellation, and pending-state cleanup. The structural room contract verifies translated, accessible host controls.

No migration or configuration change is required. Deploy the backend before or with the frontend. Existing clients already understand `force_mute` and `speaker_demoted`; unknown events continue to be ignored. Rollback is a normal code revert. If a deployment fails after LiveKit revocation but before room persistence, retry the stage removal or ask the participant to rejoin with a token minted from the authoritative room row.

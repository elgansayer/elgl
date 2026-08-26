# Audio room co-host replacement

Issue: #1025

## Purpose

Audio rooms support one host and at most one co-host. Replacing an existing co-host must never leave both the outgoing and incoming co-host able to publish media at the same time.

Supabase remains the source of truth for room roles. LiveKit is the media plane and Centrifugo carries the realtime role-change notification to connected clients.

## Replacement state transition

`AudioRoomsService.inviteCoHost()` keeps the existing host-only authorization boundary and performs a replacement in this order when another co-host is already present:

1. Resolve the outgoing LiveKit participant from the stable user-id suffix used by current room identities.
2. Revoke `canPublish` through `RoomServiceClient.updateParticipant` while preserving subscribe and data permissions. LiveKit unpublishes active microphone, camera and screen tracks when publish permission is revoked.
3. Persist the outgoing co-host demotion by clearing `co_host_id` and removing that user from `speakers`.
4. Await the `co_host_removed` Centrifugo event so the outgoing client applies its local demotion before a replacement event is emitted.
5. Persist the incoming `co_host_id`, speaker membership and raised-hand removal.
6. Await the existing `co_host_changed` event for the incoming co-host.

If there is no existing co-host, the normal assignment path remains unchanged. Re-inviting the current co-host remains idempotent and does not revoke that user's publish permission.

## Security and privacy

Only the room host may call the existing invite endpoint. The host still cannot assign themselves as co-host.

The media permission change is server-side. A stale, slow or modified client cannot continue publishing merely by ignoring the Centrifugo demotion event. The LiveKit lookup does not log participant identities or user IDs. Failure logs contain only the operation and sanitized error class.

Legacy LiveKit identities include the first six user-id characters. If more than one connected identity matches that suffix, replacement fails closed rather than risking revocation of the wrong participant. A disconnected outgoing co-host is safe to replace because it has no active tracks to revoke.

No new user data is persisted and no schema, retention or deletion behavior changes are introduced.

## Failure and retry behavior

The replacement is deliberately fail-safe:

- LiveKit permission-revocation failure stops before any database role mutation.
- Database demotion failure stops before notifying or assigning the replacement.
- Outgoing Centrifugo notification failure leaves the room without an active co-host and does not assign the replacement.
- Incoming assignment failure leaves the room without an active co-host rather than preserving two publishers.
- Incoming notification failure may leave the new co-host persisted but unaware of the change. Retrying the same invite is safe and re-emits the current `co_host_changed` event without demoting that user.

These failure states prefer temporarily having no co-host over allowing two co-host publishers.

## Observability

Important failure boundaries log sanitized messages through the existing Nest logger:

- LiveKit participant control unavailable or permission revocation failed.
- Outgoing co-host demotion persistence failed.
- Outgoing demotion notification failed.
- Incoming assignment persistence failed.
- Incoming assignment notification failed.

Logs intentionally omit room IDs, user IDs, tokens and provider response bodies.

## Verification

Focused regression coverage lives in `backend/src/audio-rooms/audio-rooms.cohost-replacement.spec.ts` and verifies:

- LiveKit revocation happens before database demotion.
- Database demotion and `co_host_removed` happen before incoming assignment.
- The replacement event is emitted only after persistence.
- LiveKit revocation failures prevent database/realtime mutation.
- Disconnected outgoing co-hosts can be replaced safely.
- Ambiguous legacy participant identities fail closed.

The existing `audio-rooms.service.spec.ts` continues to cover host authorization, self-invite rejection, same-co-host idempotency and Centrifugo event contracts.

## Rollout and rollback

No migration or configuration change is required. Deploy the backend normally with the existing LiveKit service credentials.

After deployment, verify a room with an active co-host by replacing that co-host while microphone or camera publishing is active. The outgoing participant's tracks should disappear before the incoming participant is announced as co-host.

Rollback is code-only: revert the service/test/documentation commits. No database rollback or data repair is required. If a deployment fails during a replacement and leaves `co_host_id` empty, the host can invite the intended co-host again after service recovery.

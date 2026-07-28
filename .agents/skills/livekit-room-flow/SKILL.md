---
name: livekit-room-flow
description: 'Implement or modify LiveKit audio/video room flows in the HelloTalk clone: room creation, join tokens, raise-hand/approve-speaker stage management, captions, and recording archive. Use when working on backend/src/audio-rooms or the Angular AudioRoomComponent/room-chat UI.'
---

# LiveKit Room Flow

## When to Use

- Adding a new room capability (e.g. co-hosting, screen share, a new stage role) or modifying token grants/permissions for audio/video rooms.

## Architecture Recap (`SPEC.md` Section 4)

- `RoomServiceClient` (from `livekit-server-sdk`) is configured once in `AudioRoomsService` (`onModuleInit`) from `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_SECRET`.
- Room metadata (host, topic tag, target language, speakers, raised hands, listener count, recording URL) lives in the `audio_rooms` Supabase table, not just in LiveKit's own room state - LiveKit is the media plane, Supabase is the source of truth for app-level state.

## Stage Management Protocol (Raise Hand -> Approve -> Publish)

1. Listener calls `POST /audio-rooms/raise-hand` -> appends their id to `audio_rooms.raised_hands` and (optionally) publishes a `room_{id}` Centrifugo notification so the host's UI updates live.
2. Host calls `POST /audio-rooms/approve-speaker` -> removes the id from `raised_hands`, adds it to `speakers`, and mints a **refreshed** LiveKit `AccessToken` with `canPublish: true` (and `canPublishData: true` if the room uses data-channel captions/reactions). The listener's Angular client must reconnect (or LiveKit's token refresh flow) with the new token to actually gain publish rights - a token grant on the server does nothing until the client presents it.
3. Default/listener tokens must be minted with `roomJoin: true, canPublish: false` - never default a new participant to `canPublish: true`.
4. Only the room's `host_id` (or another already-approved co-host, if that role exists) may call `approve-speaker` - verify this server-side (`ForbiddenException` otherwise), never trust a client-asserted host flag.

## Token Minting Pattern

```ts
const token = new AccessToken(this.apiKey, this.secretKey, { identity: userId });
token.addGrant({ room: roomName, roomJoin: true, canPublish, canPublishData, canSubscribe: true });
return { token: await token.toJwt() };
```

Always scope the grant to the specific `room` the caller is actually authorised for - never issue a token without a `room` restriction.

## Captions & Recording

- Real-time STT captions are forwarded from LiveKit audio tracks to a STT worker/service, then broadcast on the `room_{id}` Centrifugo channel (see `realtime-centrifugo-channel` skill) as caption events, and optionally persisted (`audio_room_captions` table, see `006_audio_rooms.sql`).
- Recordings/composite archives are stored to Cloudflare R2 via the same presigned-URL pattern as other media (`MediaService`), with the resulting URL saved to `audio_rooms.recording_url` through `POST /audio-rooms/archive`.

## Networking Reminder (VPS deployment)

LiveKit needs `7880/tcp` (HTTP/WS API), `7881/tcp` (WebRTC over TCP fallback), and `50000-60000/udp` (SFU media) open and forwarded, with `use_external_ip: true` in `config/livekit/config.yaml` for real VPS deployments (`SPEC.md` Section 7). Don't forget this when adding a feature that depends on media actually flowing (screen share, video tiles, etc.) - a correct token with no reachable media port still fails silently on the client.

## Tests

`audio-rooms.service.spec.ts` mocks `RoomServiceClient`/`AccessToken` - follow that pattern: never hit a real LiveKit server in unit tests. Assert token grants (`canPublish` true/false) match the caller's actual role, and that `approve-speaker` rejects non-host callers.

---
name: realtime-centrifugo-channel
description: 'Add or modify a real-time Centrifugo channel and its JSON payload contract in the HelloTalk clone (chat, group chat, audio room overlays, gift/notification broadcasts). Use when wiring a new real-time event, channel naming scheme, or Centrifugo publish/subscribe flow between NestJS and Angular.'
---

# Realtime Centrifugo Channel

## When to Use

- Adding a new kind of real-time event (a new chat payload type, a new broadcast, a new presence/typing signal).
- Adding a brand-new channel namespace (beyond `chat_*`, `group_*`, `room_*`, `user_*`, `global_announcements`).

## Existing Channel Namespaces (`SPEC.md` Section 3 - keep new channels consistent with these)

| Channel                                      | Purpose                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| `chat_{min(userA,userB)}_{max(userA,userB)}` | 1-on-1 chat (deterministic ordering so both users compute the same channel name) |
| `group_{room_uuid}`                          | Group chats                                                                      |
| `room_{audio_room_id}`                       | Audio/video room text chat overlay + live caption broadcast                      |
| `user_{user_id}`                             | Personal notifications (gifts received, VIP status changes, etc.)                |
| `global_announcements`                       | Platform-wide broadcasts                                                         |

## Backend Side (`backend/src/chat/centrifugo.service.ts`)

```ts
await this.centrifugoService.publish(channel, data);
```

`publish()` POSTs to the Centrifugo HTTP API (`{CENTRIFUGO_URL}/api`) with `Authorization: apikey {CENTRIFUGO_API_KEY}` and returns `boolean` (catches and logs errors rather than throwing) - always check the return value if delivery is important to the feature, and consider persisting the event to Supabase first so it's recoverable even if the publish fails.

Connection tokens are minted via `CentrifugoService.generateConnectionToken(userId)`, signing a JWT with `CENTRIFUGO_SECRET` and a `sub` claim equal to the Supabase user id, exposed through `POST /chat/token` (`SupabaseAuthGuard`-protected). Do not mint a token for a channel/user the caller doesn't own or isn't authorised to join (e.g. verify room membership before minting a `room_{id}` presence token).

## Payload Contract (`SPEC.md` Section 3 - extend this table, don't invent an ad hoc shape)

Every message has a `type` discriminator and a fixed JSON shape, e.g.:

```json
{ "type": "text", "content": "Hello world", "replyToId": null }
{ "type": "correction", "original": "I goes to school", "fixed": "I go to school", "notes": "..." }
{ "type": "voice", "url": "https://r2.cdn.com/audio/clip123.mp3", "durationSec": 14, "transcript": "..." }
{ "type": "doodle", "imageUrl": "https://r2.cdn.com/doodles/draw123.png" }
{ "type": "gift", "giftId": "golden_dragon", "coinValue": 50, "animationUrl": "https://r2.cdn.com/animations/dragon.json" }
```

When adding a new `type`, update:

1. `SPEC.md` Section 3 (canonical payload docs).
2. The backend DTO/validation for that payload type (see `chat/dto/`).
3. The Angular rendering switch (likely `@switch (message.type)` in the chat/room component template) plus the `TranslatePipe`-driven copy for any new UI text.

## Frontend Side

`CentrifugeService` (`frontend/src/app/services/centrifuge.service.ts`) wraps `centrifuge-js`, exposing reconnection state as signals. Subscribe to a channel, and always unsubscribe on component destroy to avoid leaking listeners across route changes.

## Tests

Backend: mock `fetch`/HTTP calls in `centrifugo.service.spec.ts`-style tests, asserting the correct channel name and payload shape are sent, and that a non-2xx response is handled gracefully (`publish()` returning `false`, not throwing).

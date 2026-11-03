# Doodle message sharing

Issues: #1176 (original feature), #1811 (production hardening)

A doodle is a freehand drawing sent into a chat room. This document is the production contract for the whole path: the drawing surface, the upload, the chat message, retries, failure handling, security and rollout.

## Why the flow changed

The first implementation exported the canvas as a `data:image/png;base64,...` URL and posted it inline as `media_url` on `POST /api/chat/messages`. That had four production problems:

1. **Large drawings were rejected and then lost.** The JSON body parser keeps Express's default 100 KiB limit (`registerBodyParsers` only raises it for the UI translation route), so the DTO's 3,000,000 character allowance was unreachable. A dense drawing failed with HTTP 413 before validation, and the client closed the pad and only wrote to the console, so the learner lost the drawing without any message.
2. **The image was stored inline.** Every doodle put a base64 PNG into `chat_messages.media_url`, copied it into the Centrifugo publication, and returned it again in every history page (up to 100 messages per request).
3. **Retries could duplicate.** There was no stable retry key, so a lost response followed by a retry created a second doodle.
4. **A late response could land in the wrong room.** The component read the room id again after the request finished.

Doodles now use the same owned-object pipeline as chat photos and videos (`docs/chat-photo-video-sharing.md`): the PNG goes straight to object storage, and the chat message stores only a reference to it.

## User flow and state transitions

1. The learner chooses **Doodle** in the composer. A Spartan modal dialog opens, labelled by the pad title. The primitive owns focus trapping, focus restoration, backdrop dismissal and `Escape`; **Cancel** and the close button also dismiss it.
2. `DoodlePadComponent` owns freehand drawing, colour and brush selection, clear, cancel and save. Save serialises the canvas to a PNG data URL and emits it only if the browser really produced `data:image/png;base64,`.
3. `ChatRoomComponent.onDoodleSaved` takes over. The pad stays open and reports `busy` while the doodle is sent.
4. `ChatMediaService.uploadDoodle` decodes the data URL locally, checks the PNG signature and the size, asks `POST /api/media/chat/presigned-url` for a ticket (`purpose: 'doodle'`) and `PUT`s the bytes to the signed storage URL.
5. `ChatMediaMessageService.send` calls `POST /api/media/chat/send` with only the room id, `mediaKind: 'doodle'` and the server-issued object key.
6. The backend checks room membership and object ownership. If no message already uses the object, it verifies through the authenticated storage gateway that the object exists, is a non-empty PNG and is at most 2 MiB before persistence.
7. The backend confirms Centrifugo accepted the persisted message before returning it. The chat room appends it once (deduplicated by id, so a replayed realtime event and the response never double up) and closes the dialog.

| State   | What the learner sees                                                | Controls                                                                                            |
| ------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Idle    | Pad ready, no message                                                | All enabled                                                                                         |
| Sending | **Sending doodle...** on the send button, polite status announcement | Drawing, clear and send disabled. Cancel stays enabled so a stalled request cannot trap the learner |
| Failed  | Inline `role="alert"` message, the drawing is kept                   | Everything enabled; **Send doodle** retries                                                         |
| Sent    | Dialog closes, doodle appears in the timeline                        | n/a                                                                                                 |

The message uses translation keys throughout (`doodle.*`, `chatRoom.doodleAlt`).

## API contract

| Step   | Endpoint                             | Request                                                                                         | Notes                                                                            |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Ticket | `POST /api/media/chat/presigned-url` | `filename`, `contentType: 'image/png'`, `quality: 'standard'`, `sizeBytes`, `purpose: 'doodle'` | Throttled to 30 per minute. The filename is ignored when choosing the object key |
| Upload | `PUT <signed storage URL>`           | PNG bytes                                                                                       | The storage gateway enforces the signed key, content type and byte ceiling       |
| Send   | `POST /api/media/chat/send`          | `roomId`, `mediaKind: 'doodle'`, `objectKey`                                                    | Throttled to 60 per minute. Returns the persisted `ChatMessage`                  |

Doodle policy, owned by the server (`ChatMediaUploadService`):

- PNG only (`image/png`); `quality` must be `standard`; at most **2 MiB** (a 600 x 400 RGBA raster cannot exceed 1 MiB, so this leaves headroom without inviting abuse).
- Object key: `chat-media/<user id>/doodle/standard/<timestamp>-<24 hex nonce>.png`, nonce from a CSPRNG.
- `POST /media/chat/send` accepts a doodle key only in that exact shape (`SendChatMediaMessageDto`).

Error behaviour:

| Status | Cause                                                                                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | Not a PNG, HD quality requested, over 2 MiB, or a malformed key                                                                                                                         |
| 401    | Missing or invalid session                                                                                                                                                              |
| 403    | The object key does not belong to the caller, or its kind segment does not match `mediaKind`                                                                                            |
| 404    | The caller is not a member of the selected room                                                                                                                                         |
| 409    | The uploaded object already backs a message in another room or of another type                                                                                                          |
| 422    | The upload is missing or violates the doodle object policy, or instant-video was requested                                                                                              |
| 429    | Throttled                                                                                                                                                                               |
| 503    | Room membership or object metadata could not be verified, or realtime delivery was not accepted. A message may already be persisted in the last case, so retry with the same object key |

### Legacy inline doodles

`POST /api/chat/messages` with `message_type: 'doodle'` and a PNG data URL is still accepted so clients that have not updated keep working, and it is still validated as a canvas PNG (see `docs/chat-message-api.md`). It remains subject to the 100 KiB body limit. Existing inline doodle rows stay valid and keep rendering. Once no supported client sends inline doodles, a follow-up can remove that branch from `SendMessageDto`.

## Persistence, idempotency and concurrency

A doodle is one `chat_messages` row with `message_type = 'doodle'` and `media_url` set to the public URL of the uploaded object. The URL is derived on the server from the owned key; the browser never chooses it. The old caption in `text_content` was never rendered and is no longer written.

The uploaded object is the retry key:

1. `POST /media/chat/send` first looks for a message from the same sender with that media URL. If present, it republishes that row and returns it only after Centrifugo accepts the event.
2. Otherwise it verifies the object metadata through the authenticated storage gateway and sends through `ChatService.sendMessage`, which persists and then publishes to Centrifugo.
3. If persistence succeeded but publication failed, the service looks the row up and attempts one safe id-based republication. It returns 503 if Centrifugo still refuses the event. The next request finds and republishes the same row without depending on another storage lookup.
4. If the response was lost after accepted publication, retry may publish the same message id again. Both chat renderers deduplicate messages by id, so this heals ambiguous delivery without duplicating the persisted message or timeline entry.
5. The partial unique index `chat_messages_sender_doodle_media_url_unique_idx` (migration `20261102120000_chat_doodle_media_idempotency.sql`) is the database backstop for two concurrent retries: the loser fails on the insert, looks the row up again and republishes the winner.

The browser mirrors this. It keeps the uploaded object between attempts, so a failed send is retried against the same object and the PNG is never uploaded twice. One attempt runs at a time, so a double tap cannot race itself. If the learner changes the drawing, a new object is uploaded.

## Failure behaviour

| Failure                                         | Learner sees                                                                                                            | Data behaviour                                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Not a PNG, malformed or over 2 MiB              | Inline error, drawing kept                                                                                              | Nothing uploaded                                                                                                 |
| Not signed in                                   | Inline error                                                                                                            | Nothing uploaded                                                                                                 |
| Ticket request fails or is refused              | Inline error, drawing kept                                                                                              | Nothing uploaded                                                                                                 |
| Storage `PUT` fails                             | Inline error, drawing kept                                                                                              | No chat message                                                                                                  |
| Uploaded object missing or violates policy      | Inline error, drawing kept                                                                                              | No chat message                                                                                                  |
| Storage metadata lookup unavailable             | Inline error, drawing kept                                                                                              | Fails closed, nothing is sent                                                                                    |
| Send fails before persistence                   | Inline error, drawing kept; retry reuses the object                                                                     | No chat message                                                                                                  |
| Response or publication fails after persistence | Inline error while publication remains unavailable; retry republishes and returns the existing message after acceptance | No duplicate row; repeated events use the same message id                                                        |
| Delivery state lookup fails                     | Inline error                                                                                                            | Fails closed, nothing is sent                                                                                    |
| Pad dismissed while the send was in flight      | Error toast if it fails                                                                                                 | A request that already left cannot be recalled, so it may still be delivered                                     |
| Learner moved to another room mid-send          | Error toast if it fails                                                                                                 | The late message is never appended to the new room's timeline; the pad closes and the stored object is forgotten |

An uploaded object can outlive a dismissed pad. Lifecycle cleanup of unsent uploads belongs to the repository-wide media finalisation policy; a client must not guess that an ambiguous send failed and delete media that may already back a persisted message.

## Security and privacy

- Both endpoints require `SupabaseAuthGuard` and are throttled. The caller identity comes from the session, never the body.
- The send boundary verifies `(room_id, user_id)` membership with the service-role database client before looking up or creating a message. A lookup failure fails closed with 503, while a non-member receives the same 404 as an unavailable room.
- Ownership is checked from the object key (`chat-media/<authenticated user>/doodle/`), and the kind segment must equal `mediaKind`, so a doodle key cannot be replayed as a photo and a photo key cannot be sent as a doodle.
- Before a new message is persisted, the backend checks the object through the authenticated gateway and accepts only the exact key, `image/png`, a positive size and the 2 MiB ceiling. A shaped but never-uploaded key cannot create a broken message.
- The generic `POST /chat/messages` endpoint still rejects arbitrary URLs for doodles, so a client cannot attach someone else's object or an external URL.
- The browser decodes the data URL locally (no `data:` fetch, so no connect-src exception), requires the PNG signature, and bounds the size before any network call.
- The image is rendered through an `<img>` source only; it is never interpreted as HTML.
- Doodle content is private chat content. Logs contain bounded event names, message type, message id and safe failure class/status only: never bytes, object keys, URLs (which can include signatures), provider details or tokens. Structured events: `chat_media_send_replayed`, `chat_media_send_recovered`, `chat_media_realtime_delivery_failed`, `chat_media_send_conflict`, `chat_media_object_missing`, `chat_media_object_lookup_failed`, `chat_media_object_rejected`.
- Block, first-message privacy filter and spam checks continue to run in `ChatService.sendMessage`, which this path reuses. Membership is verified at this endpoint before that shared pipeline is called.
- Retention and deletion follow the containing chat message. The storage object follows the media finalisation policy above.

## Accessibility

- The pad uses the installed Spartan dialog, which provides modal semantics, focus trapping, focus restoration, backdrop dismissal and `Escape`; it is labelled by the translated pad title.
- Colour and brush choices are mutually exclusive Spartan radio groups with translated labels, touch targets of at least 44 px, and controls that wrap at high zoom.
- Freehand drawing is a pointer interaction and the component does not claim a keyboard equivalent; every surrounding control is keyboard operable.
- Sending is announced through a polite `role="status"` region and failure through `role="alert"`. Neither relies on colour alone, because the text states what happened.
- Received doodles have a translated, sender-aware text alternative ("Doodle from {{name}}") in both chat renderers, with a translated fallback when the sender is unknown.

## Observability and operations

- Membership/object lookup failure, object rejection, realtime refusal, replay, recovery and conflict are structured warn/log events, so a rejected, stuck or duplicated doodle can be traced without database access or content. The safe message id correlates a realtime refusal with its later replay or recovery. These events carry no user, room, object key or provider detail.
- Watch the rates of presign rejection (400/403), `chat_media_object_missing`, `chat_media_object_rejected`, `chat_media_realtime_delivery_failed`, `chat_media_send_conflict`, `chat_media_send_recovered`, the bounded `unavailable`/`replayed` send metrics and 5xx on `/media/chat/send`. A rise in realtime delivery failures or `unavailable` indicates Centrifugo refusal after persistence; a later `replayed` or `recovered` confirms healing.
- The new index is partial and only covers doodles minted by this pipeline, so it stays small.

## Verification

- `backend/src/media/chat-media-upload.service.spec.ts`: doodle policy (PNG only, standard only, 2 MiB ceiling, key shape, no photo regression).
- `backend/src/media/dto/chat-media-upload.dto.spec.ts` and `send-chat-media-message.dto.spec.ts`: purpose and key validation, traversal and kind confusion.
- `backend/src/cloudflare-r2/r2-object.service.spec.ts`: authenticated object metadata delegation.
- `backend/src/chat/chat-media-message.service.spec.ts`: server-derived URL, ownership, room membership, object existence/type/size, kind confusion, idempotent replay without another object lookup, recovery after publication failure, conflict, sanitised logs.
- `backend/src/chat/chat.module.spec.ts`: controller and service registration in the runtime Nest module.
- `backend/src/media/chat-media.controller.spec.ts` and `backend/src/chat/chat-media-send.controller.spec.ts`: guards and delegation as the authenticated user.
- `backend/src/database/chat-doodle-media-migration.contract.spec.ts`: the index predicate, including that legacy inline doodles are never indexed.
- `frontend/src/app/services/chat-media.service.spec.ts` and `chat-media-message.service.spec.ts`: local PNG validation, ticket mismatch, storage refusal, authentication.
- `frontend/src/app/components/doodle-pad/doodle-pad.component.spec.ts`: busy and error states, frozen raster, cancel stays available.
- `frontend/src/app/components/chat-room/chat-room.doodle-sharing.spec.ts`: dialog semantics, single upload and send, double-submit guard, failure with retry reusing the object, redraw after failure, cancel mid-send, room change mid-send, legacy rendering and alt text.
- `frontend/src/app/components/chat-message/chat-message.component.spec.ts`: translated alt text.

```bash
cd backend
npm run test -- --configLoader runner --run src/cloudflare-r2/r2-object.service.spec.ts src/media/chat-media-upload.service.spec.ts src/media/dto/chat-media-upload.dto.spec.ts src/media/dto/send-chat-media-message.dto.spec.ts src/media/chat-media.controller.spec.ts src/chat/chat-media-message.service.spec.ts src/chat/chat-media-send.controller.spec.ts src/chat/chat.module.spec.ts src/metrics/metrics.service.spec.ts src/database/chat-doodle-media-migration.contract.spec.ts

cd ../frontend
./node_modules/.bin/ng test --watch=false --include src/app/services/chat-media.service.spec.ts --include src/app/services/chat-media-message.service.spec.ts --include src/app/components/doodle-pad/doodle-pad.component.spec.ts --include src/app/components/chat-room/chat-room.doodle-sharing.spec.ts --include src/app/components/chat-message/chat-message.component.spec.ts
```

## Rollout and rollback

Order matters because the global validation pipe rejects unknown properties:

1. Apply `20261102120000_chat_doodle_media_idempotency.sql`. It is a single `CREATE UNIQUE INDEX IF NOT EXISTS`, safe to retry, and takes a short write lock on `chat_messages` while it scans (the same as the photo/video index). It cannot fail on historical rows because no row matches the new key shape.
2. Deploy the backend. The `purpose` field is optional, so existing photo and video clients are unaffected, and the inline doodle endpoint still works.
3. Deploy the frontend. Deploying it before the backend would send `purpose` to a server that rejects the property.
4. Smoke test: draw and send a doodle, send one with the network blocked and retry, send in a second tab to confirm one message, and confirm a doodle key belonging to another user returns 403.

Rollback: revert the frontend first so no new doodle uploads start, then the backend. Doodles already sent are ordinary rows with a storage URL and keep rendering. The index is harmless to leave in place; if it must go:

```sql
DROP INDEX IF EXISTS public.chat_messages_sender_doodle_media_url_unique_idx;
```

Do not roll back by raising the global JSON body limit or by accepting arbitrary URLs for doodles on the generic endpoint.

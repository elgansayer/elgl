# Audio-room tip animations

Audio-room host tips use the existing room API, Supabase wallet, Centrifugo room channel and global `GiftAnimationOverlayComponent`. There is no second gift catalogue or animation transport.

## User flow

1. A signed-in viewer opens the tip dialog, selects a positive coin amount and submits it.
2. The browser creates a UUID idempotency key and retains it while the dialog remains open.
3. `POST /api/audio-rooms/:roomId/tip` passes the authenticated user, room, amount and key to `transfer_audio_room_tip`.
4. PostgreSQL locks both wallets in stable UUID order. It verifies that the room exists and is active, rejects self-tips, checks the balance, writes both balances and records `audio_room_tips` in one transaction.
5. NestJS publishes the persisted tip on `room_{roomId}` as `host_tip`.
6. The sender uses the authoritative response balance and starts the existing global animation. Other room participants validate the realtime payload and start the same animation. A bounded recent-tip set suppresses duplicate `tip_id` deliveries.

The full-screen overlay remains a polite live-region notification with a translated dismiss label. Its Lottie player uses the SVG renderer, and users who prefer reduced motion receive the textual gift banner without script-driven animation.

## API and retry contract

Request body:

```json
{
  "room_id": "f98648c2-95d1-47c9-80f5-1ba30fbdbc40",
  "amount_coins": 50,
  "idempotency_key": "7a28776a-93f9-4c0e-b1bc-d47d02a9ca12"
}
```

Successful response:

```json
{
  "tip_id": "2843941e-22ed-45c3-94aa-2ba274931893",
  "amount_coins": 50,
  "receiver_id": "2c84ccac-2c40-4e39-a72c-e9d28442c576",
  "sender_new_balance": 70,
  "receiver_new_balance": 230
}
```

The key is bound to the original sender, room, receiver and amount. Reusing it for another tip returns `409`. A duplicate request for the same tip returns the saved balances without another transfer. The key remains optional at the DTO boundary only for mixed-version clients; the backend generates a key when an older client omits it.

The endpoint is authenticated and limited to ten attempts per minute by the global throttler override. The RPC is executable only by `service_role`; browser roles cannot call the money-moving function directly.

## Failure behaviour

- Invalid amounts are rejected by DTO validation before the service runs.
- Missing rooms or senders return `404`; inactive rooms, self-tips and insufficient balances return `400`; key subject conflicts return `409`.
- Unexpected database failures return `503` without exposing provider details or changing only one wallet.
- The tip is persisted before realtime publication. If Centrifugo rejects or throws, the endpoint returns `503` and the dialog stays open. Retrying with the same key does not charge again and republishes the same `tip_id`.
- The browser does not guess a balance. It changes the displayed balance only from a successful authoritative response.
- Malformed realtime payloads and repeated tip IDs do not render an animation.

Structured logs record the operation code for RPC failure and the room and tip identifiers for publication failure or success. They exclude access tokens, wallet owner identifiers and payload bodies.

## Persistence and retention

`audio_room_tips` is the financial audit record. The migration adds a nullable idempotency key and committed balance snapshots, plus a partial unique index on `(sender_user_id, idempotency_key)`. Browser roles cannot read or mutate these records directly, so wallet snapshots and all mutations remain behind backend service-role flows. Existing rows and older backend writers remain valid. The established privacy retention job continues deleting audio-room tips after 365 days and account deletion removes tips associated with that user.

## Rollout and rollback

Deploy `20261102000000_atomic_audio_room_tips.sql` before the backend, then deploy the frontend. This expand-first order supports old and new application versions at the same time.

For rollback, revert the frontend and backend first. The additive columns, index and service-role RPC can remain in place safely. Remove them only in a later reviewed contraction after confirming no deployed backend uses `transfer_audio_room_tip`; removing them is not required for service recovery.

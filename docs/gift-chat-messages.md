# Inline gift chat messages

Inline gift messages reuse the existing economy transaction, chat persistence, and Centrifugo paths. The Angular application does not query Supabase directly.

## Delivery path

1. An authenticated sender calls the economy `send-gift` endpoint with a catalogue gift and an authorised room recipient.
2. The backend commits the balance transfer and gift transaction.
3. For a room gift, the backend stores a `chat_messages` row with `message_type = 'gift'` and a bounded `gift_payload`, then publishes the saved message on `chat:<roomId>`.
4. `ChatRoomComponent` receives validated realtime messages. REST loading remains the recovery path after a missed publication or reconnect.
5. Both chat renderers delegate gift payload presentation to `GiftAnimationComponent`.

The payload contains the catalogue gift identifier, display name, icon, coin value, and optional animation metadata. It never contains credentials or payment-provider data.

## Failure and accessibility behaviour

- Malformed realtime gift payloads are rejected before they enter room state.
- A missing or invalid payload loaded from persistence renders the localised unavailable state instead of an empty message.
- Gift text remains visible when animation is unavailable. Reduced-motion users do not receive bouncing or particle motion.
- Forced-colour mode uses system colours and keeps a visible boundary.
- Existing backend warning logs diagnose best-effort chat insertion or Centrifugo publication failures without logging credentials or private message content. Existing gift metrics record catalogue identifier, animation type, and coin value.

## Rollback and recovery

The UI integration can be reverted independently because it does not change the REST contract, Centrifugo channel, database schema, or transaction rules. Persisted gift rows remain readable after a frontend rollback. Restoring the UI change makes those rows visible again without data migration.

# Chat location sharing

Chat messages may carry a typed location payload rendered as a map card.

## Contract

`POST /api/chat/messages` (via `SendMessageDto`) accepts `message_type: 'location' | 'live_location'` and a required nested payload:

```json
{
  "room_id": "uuid",
  "message_type": "location",
  "location_payload": {
    "latitude": 51.5074,
    "longitude": -0.1278,
    "label": "Trafalgar Square",
    "is_live": false
  }
}
```

- `latitude` is bounded to `[-90, 90]`, `longitude` to `[-180, 180]`, `label` to 120 characters.
- `location_payload` is rejected on every other message type and is required for the two location types, so coordinates cannot be smuggled into text messages or omitted silently.

## Persistence and realtime

`20261114160000_add_chat_location_payload.sql` adds `chat_messages.location_payload JSONB` with a defensive bounds check. `ChatService.sendMessage` writes the normalised payload (label null-coalesced, `is_live` defaulting to `false`) and publishes the saved row over `chat:{room_id}` through Centrifugo, so connected clients receive the message exactly like any other type.

## Rendering

`ChatMessageComponent` renders a card with a pin icon, the translated static/live label, the optional label, the coordinates in an `ltr` monospace line, and an external `OpenStreetMap` link (`target="_blank"`, `rel="noopener noreferrer"`). Live messages also show a short lifetime hint. The card exposes a group role and a translated accessible name; no state relies on colour alone.

## Privacy

Location is only stored when the sender explicitly sends a location message. The payload is not logged by the service. Existing room membership, message filters and block checks apply before persistence, unchanged.

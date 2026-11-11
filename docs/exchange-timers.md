# Reciprocal 1:1 exchange timers

## Purpose

1:1 calls between language partners enforce equal speaking time so both participants practise their own language instead of one participant dominating the conversation. The server owns the turn clock, the frontend only renders and enforces it.

## Behaviour

- A call session is created when `POST /video-calls/start` creates the room.
- Participants' native and target languages are read from the `users` table. A reciprocal pair is preferred: the caller's native language that the partner is learning and the partner's native language that the caller is learning. If no reciprocal pair exists, each participant's first native language is used and `reciprocal` is `false`.
- The timer starts only after both intended participants have joined through `POST /video-calls/accept`, so the first speaker is not penalised while waiting alone.
- Turns alternate automatically after `EXCHANGE_TURN_DURATION_SECONDS` (default 300 seconds, clamped to 60-1800).
- The current speaker can hand over early. Other participants cannot end someone else's turn.
- Turn handovers are idempotent through `expectedTurnIndex`: retrying a successful handover returns the current state instead of advancing twice.
- The frontend mutes the local microphone while the participant is not the current speaker and disables the mute control until their turn starts.

## API

Authenticated through the existing Supabase guard and video-call rate limiter.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/video-calls/:roomName/exchange-timer` | Current speaker, language, remaining seconds and turn counts for the authenticated participant. |
| `PUT` | `/video-calls/:roomName/exchange-timer/advance` | Ends the current speaker's turn early. Body: `{ "expectedTurnIndex": 0 }`. |

Status response:

```json
{
  "active": true,
  "waitingForParticipant": false,
  "reciprocal": true,
  "roomName": "video_...",
  "turnDurationSeconds": 300,
  "turnIndex": 0,
  "currentSpeakerId": "...",
  "currentSpeakerLanguage": "en",
  "remainingSeconds": 240,
  "isCurrentSpeaker": true,
  "participants": [
    { "userId": "...", "language": "en", "turnsTaken": 0 },
    { "userId": "...", "language": "es", "turnsTaken": 0 }
  ]
}
```

## Storage and retention

Timer state is ephemeral call state, not durable learning history. It lives only in Redis under `video-calls:exchange:<roomName>` with a two-hour TTL, mirroring the existing E2EE call-session broker. No schema migration is required and no personal data beyond the two participant IDs and language codes is stored. The key expires automatically and is never included in logs.

## Failure handling and rollout

- A Redis outage never blocks call creation or joining. The call proceeds without a timer and the status endpoint degrades gracefully in the frontend.
- If the users lookup fails, the timer still runs with null languages so equal speaking time is preserved.
- Set `EXCHANGE_TIMERS_ENABLED=false` to roll back the feature without a deployment. `EXCHANGE_TURN_DURATION_SECONDS` changes the turn length.
- The status endpoint returns `503` when the timer store cannot be read so clients can stop enforcing a stale turn.

## Observability

- Invalid or missing sessions are not logged with participant content.
- Redis persistence failures during call creation and participation updates emit sanitised warnings containing only the room name and error message.

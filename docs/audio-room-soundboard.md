# Audio room soundboard

Issue: #1732

## Product contract

Hosts and co-hosts can trigger one of the fixed sound effects exposed by the audio-room soundboard while every participant in that room hears the same effect. The controls are rendered inside the existing live-room chat surface, so the feature does not create a parallel room lifecycle or realtime connection.

The initial catalogue is intentionally small and bounded: applause, laughter, drum roll, air horn, and gong. The server remains authoritative for which IDs are available and who may trigger them. Clients ship reviewed audio for those IDs and never play an arbitrary media URL received from the API or realtime channel.

## Request and realtime flow

1. An authenticated client requests `GET /api/audio-rooms/soundboard/list`.
2. The client accepts only known, bundled sound IDs and bounded display metadata. Legacy `url` fields are ignored.
3. A host or co-host sends `POST /api/audio-rooms/soundboard/play` with the current `room_id` and fixed `sound_id`.
4. `SupabaseAuthGuard` derives the caller identity. `AudioRoomsService.playSound` verifies that the room exists and that the caller is its host or co-host before publishing `soundboard_play` on `room_<room id>` through Centrifugo.
5. The existing `AudioRoomsStore` room subscription receives the publication and records it through the shared Centrifugo event signal.
6. `SoundboardComponent` verifies the channel, event type, and fixed sound ID, then resolves that ID against the bundled audio catalogue. Any `sound_url` supplied by a legacy server or malicious realtime payload is ignored.

The triggering client also waits for the realtime echo instead of playing optimistically. This avoids hearing the effect twice and means the host hears the same authoritative event as the rest of the room.

## Security and abuse resistance

- Both soundboard API calls include the authenticated Supabase access token. Missing sessions fail closed before network I/O.
- The mutation caller is derived from the authenticated principal; no user ID is accepted from the request body.
- Room and sound IDs are bounded at both the Angular and NestJS DTO boundaries.
- Unknown sound IDs are rejected by the client before network I/O and by the server catalogue before publication.
- Only the current host or co-host can publish a soundboard event. Listener UI never exposes playable controls.
- The browser never loads audio from a URL contained in an untrusted Centrifugo payload. Playback uses bundled, fixed PCM WAV data only.
- API failures use stable client messages; arbitrary upstream status text and response bodies are not reflected to users or logs.
- The client serializes play mutations so rapid taps do not create concurrent duplicate requests. Server/global throttling remains the final abuse boundary for malicious clients.

No user-generated audio, personal data, persistent listening history, or new database tables are introduced by this feature.

## Accessibility and responsive behaviour

The control surface uses Spartan buttons with a minimum 44px touch target, visible focus supplied by the shared button primitive, translated accessible names, `aria-busy` for loading/in-flight state, and explicit alert/status regions for recoverable failures. Buttons wrap rather than overflow at narrow widths and high zoom. Sound names use `dir="auto"` for mixed-direction labels.

Participants who cannot trigger sounds do not receive a visually disabled control panel; the component remains mounted only so validated realtime effects can be heard.

## Failure handling

- Catalogue failure: show a retryable error and no controls.
- Missing authentication: fail closed without issuing the API request.
- Play API or Centrifugo publication failure: keep the room usable and expose a retryable non-destructive error.
- Unknown or malformed realtime event: ignore it.
- Browser autoplay rejection or missing audio support: ignore the non-critical effect without interrupting voice-room participation.
- Room switch during catalogue loading: stale results are discarded.
- A new trigger while one mutation is in flight: ignored until the authoritative request completes.

Soundboard failure never disconnects LiveKit, blocks chat, or changes stage membership.

## Mixed-version rollout

The backend currently includes a legacy `sound_url` in catalogue and realtime responses. New clients deliberately ignore it and resolve the fixed `sound_id` locally, so they remain compatible with the current backend while removing remote media URLs from the playback trust boundary. Older clients can continue using the legacy field during rollout. A later cleanup can remove `sound_url` after the mixed-version window without changing the new client contract.

No database migration is required.

## Verification

Focused coverage includes:

- authenticated catalogue and mutation requests;
- fail-closed unauthenticated behaviour;
- bounded DTO identifiers;
- malformed/unknown catalogue entries;
- host and co-host UI permissions;
- serialized play mutations and retryable failures;
- cross-room and unknown realtime-event rejection;
- proof that a malicious `sound_url` is ignored and bundled audio is used instead.

Run the relevant suites with the repository's normal frontend/backend Vitest commands, then run the root verification and clean-lint workflows.

## Rollback

Rollback is code-only. Revert the soundboard UI/service changes and this document. There is no schema or persisted state to unwind. If backend and frontend are rolled back independently, the legacy server payload remains compatible with older clients; new clients continue to ignore `sound_url` until their rollback completes.

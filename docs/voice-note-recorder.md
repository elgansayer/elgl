# Voice note recorder and direct upload

Issue #968 is implemented by the existing Angular `VoiceRecorderComponent`, the shared `MediaService`, and the authenticated NestJS media boundary. The implementation deliberately reuses the existing chat `voice` message type and inline `<audio>` playback instead of introducing a second voice-message model.

## User flow

1. Open the existing voice-note recorder from a chat or another surface that consumes `VoiceRecorderComponent`.
2. Press and hold the record button with a pointer, Space, or Enter. Recording starts only after microphone permission succeeds.
3. Releasing the pointer/key stops recording. A synthetic assistive-technology click remains supported as an accessible start/stop toggle.
4. The browser renders a local object-URL preview. Nothing is uploaded until Send is activated.
5. Send requests an authenticated, user-scoped R2 upload URL from `POST /media/voice-note/presigned-url`.
6. The browser PUTs the audio blob directly to the Cloudflare R2 gateway and emits the returned public media URL only after the PUT succeeds.
7. Existing chat code persists that URL as a `voice` message. Existing message bubbles provide inline native audio playback and transcription actions.

A recording is automatically stopped after 120 seconds. The client rejects empty recordings and voice-note blobs above 10 MiB. The R2 upload ticket independently enforces the same 10 MiB ceiling.

## Failure and concurrency behaviour

- Missing browser recording APIs or denied microphone permission leave the recorder idle and expose an accessible error.
- Releasing the hold gesture while a permission prompt is still pending invalidates that start attempt. If a stream arrives later its tracks are stopped without beginning a recording.
- Repeated start requests while recording/preparing/uploading are ignored.
- Cancel and component destruction stop active tracks, clear timers, invalidate pending permission work, discard an in-progress capture, and revoke preview object URLs.
- A failed presign request or R2 PUT keeps the local preview available for retry. The component never fabricates or emits a fallback media URL.
- Duplicate Send activation is suppressed while an upload is in flight.

## Security and privacy

`MediaController` is protected by `SupabaseAuthGuard`. The client supplies only a filename and content type; the server owns the `voice-notes/<authenticated-user>/...` object prefix. Audio MIME types are allow-listed before signing. The browser receives a bounded upload ticket and never receives Cloudflare service credentials.

The direct upload path does not log recording content, upload URLs, object keys, user IDs, or provider error payloads. The historical multipart `POST /media/voice-note` route remains available for mixed-version clients, but the Angular recorder uses the direct R2 path.

## Data lifecycle

This change adds no database table or migration. A successfully uploaded R2 object becomes reachable from the existing chat message only after the caller emits the URL and the chat send succeeds. Existing account/chat retention and deletion policies remain authoritative for message records. Orphan cleanup for media uploaded immediately before a failed chat send remains an R2 lifecycle/retention concern and is unchanged by this issue.

## Verification

Automated coverage verifies:

- authenticated voice-note presign delegation;
- user-scoped object-key generation, MIME validation, and the 10 MiB R2 ticket limit;
- direct browser PUT behaviour and failed-PUT handling;
- client-side empty/oversized blob rejection;
- recording/stop/preview lifecycle and microphone release;
- the 120-second maximum duration;
- release-before-permission race handling;
- permission and upload failures;
- absence of fabricated fallback URLs;
- object-URL and timer cleanup.

The repository's normal frontend/backend test, lint, build, dependency-review, and UI governance workflows are the release gate.

## Rollout and rollback

Deploy the backend before the frontend so `POST /media/voice-note/presigned-url` exists before clients request it. No migration is required. The legacy multipart voice-note endpoint remains compatible during rollout.

Rollback the frontend first to restore multipart uploads, then roll back the backend if required. Existing R2 voice-note objects and chat messages need no data migration or rewrite.

# Instant video messages

Issue #1171 adds short camera-recorded video notes to the existing authenticated chat media pipeline.

## Product contract

- A learner explicitly opens **Video note**, grants camera/microphone access, records up to 30 seconds, previews the clip, then chooses **Send video note**, **Retake**, or **Cancel**.
- Recording uses the front-facing camera where the browser supports it, with bounded capture dimensions and bitrates. Camera and microphone tracks are stopped immediately when recording ends, is cancelled, errors, or the component is destroyed.
- The browser uploads the clip through the existing authenticated Cloudflare R2 chat-media presign flow using the Standard video limit. The R2 object remains an ordinary owned `video` object; only the send request carries `presentation: instant_video`.
- The backend derives the public URL from that owned object key and persists `message_type = video_note`. This prevents a client-provided URL from bypassing ownership validation.
- `video_note` messages render as circular, `playsinline` video controls. Ordinary uploaded `video` messages retain their existing rectangular presentation.

## Validation and abuse resistance

- The recorder automatically stops at 30 seconds and targets approximately 864 Kbit/s combined audio/video bitrate, comfortably below the existing 12 MB Standard video limit under normal browser implementations.
- The uploader still applies its existing content-type allowlist and size enforcement. Recorded clips are normalized to WebM or MP4 before upload.
- `/media/chat/presigned-url` and `/media/chat/send` remain authenticated and throttled. No new anonymous upload surface is introduced.
- `presentation = instant_video` is accepted only with `mediaKind = video`; the backend rejects image/presentation mismatches before persistence.
- The existing send idempotency boundary remains authoritative: retries reuse the same uploaded object, and an object already used with a different room or presentation fails with a conflict instead of producing a second message.
- Media URLs are rendered only after the existing HTTP(S) URL check. Recording blobs, camera frames, message media URLs, and private content are not written to application logs or analytics by this feature.

## Failure behavior

- Camera/microphone denied or unsupported: the dialog stays open with a retryable error; no upload is attempted.
- Recorder failure or empty recording: no message is created and the user can retry.
- Oversized recording: upload is blocked and the user is asked to record a shorter note.
- R2/presign upload failure: the local recording preview is retained so Upload/Send can be retried without recording again.
- Message-send failure after upload: `ChatMediaShareComponent` retains the uploaded object and exposes the existing retry/dismiss flow. Backend idempotency makes retry safe.
- Centrifugo publication failure after persistence: the media-message service re-reads the persisted row and returns it rather than inserting a duplicate.

## Accessibility and responsive behavior

- All recording actions use the shared Relay/Spartan button primitives with at least 44px targets.
- The modal exposes dialog semantics and labels; recording/error state uses live-region or alert semantics.
- The preview is bounded with responsive square sizing, so it reflows on narrow layouts and at high zoom.
- Circular rendering is a visual treatment only. Playback remains a native video control with an explicit accessible name.

## Retention and deletion

Instant video notes use the same R2 object and `chat_messages` retention/deletion lifecycle as ordinary chat videos. This change introduces no additional database table or copy of the recording.

## Rollout

1. Deploy the backend DTO/service change first. Older clients continue sending photo/video media without `presentation`, which defaults to the existing behavior.
2. Deploy the frontend. New clients can then send `presentation: instant_video` while older clients can safely receive the `video_note` row even if they do not yet apply the circular presentation.
3. Smoke-test camera permission denied/granted, manual stop, automatic 30-second stop, retake, upload failure/retry, send failure/retry, and two-device playback.
4. Monitor existing media upload/send HTTP status and latency telemetry for unexpected increases in 4xx/5xx responses.

No schema migration is required because `chat_messages.message_type` is a bounded-length string rather than a database enum/check constraint.

## Rollback

Remove the frontend entry point first, then revert the backend presentation mapping. Existing `video_note` rows and R2 objects should be retained; dropping or rewriting historical messages is not required for rollback. If an older client cannot render `video_note`, the media remains an ordinary HTTP(S) video asset and can be recovered by a subsequent forward-compatible client release.

## Verification

Focused coverage locks:

- frontend send payload behavior and image/video presentation validation;
- instant-video upload emission and retry preservation;
- circular versus ordinary video rendering and unsafe URL rejection;
- backend `video_note` mapping, non-video rejection, ownership enforcement, retry idempotency, presentation-conflict handling, post-persist recovery, and fail-closed datastore errors.

Repository CI remains authoritative for the full Angular/NestJS unit suites, builds, lint/static analysis, dependency review, accessibility/design governance, E2E contracts, and clean-environment verification.

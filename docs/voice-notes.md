# Voice notes

Issue #968 is implemented by `VoiceRecorderComponent` and the existing media upload boundary.

## Product contract

The chat voice-note recorder is a press-and-hold interaction. Pointer users press and hold the record control and release to stop. Keyboard users receive the same press/release behavior with Space or Enter. The control stays in the DOM while recording so pointer capture and keyboard focus are not lost mid-gesture.

After recording stops, the browser creates a local object-URL preview. Users can listen before sending. The preview is local-only and is revoked on retry replacement, successful upload, cancellation, or component teardown.

## Upload boundary

`VoiceRecorderComponent` does not contain Cloudflare credentials or construct bucket URLs. It passes the recorded blob to the shared `MediaService.uploadVoiceNote()` boundary. The media layer remains responsible for the currently deployed Cloudflare/R2 upload architecture and any future presigned-upload transport changes.

Only the URL returned by a successful media upload is emitted to the parent chat flow. Provider or network failure never becomes a fabricated media URL. The preview remains available so the user can retry without recording again.

## Failure and concurrency behavior

- microphone permission/provider failure leaves the recorder idle and shows a user-visible failure message;
- releasing the hold before microphone permission resolves cannot leave a recorder running in the background;
- only one recording start may be in flight at a time;
- only one upload may be in flight at a time;
- upload failure emits no `audioUploaded` event and preserves the local preview;
- cancellation and component teardown stop active media tracks, clear timers, and revoke object URLs;
- no audio data, media URL, credential, or provider error body is written to logs.

## Accessibility and input methods

The record control remains a native Spartan button with visible focus behavior. Pointer and keyboard press/release paths share the same recording state machine. Recording state is exposed with `aria-pressed`, and upload state uses native `disabled` plus `aria-busy`. The touch target is at least 44 CSS pixels high.

The HTML5 `<audio controls>` element owns preview playback semantics so keyboard, screen-reader, playback-rate, and platform media behavior remain browser-native.

## Verification

Focused coverage lives in `voice-recorder.component.spec.ts` and verifies:

- pointer hold/release recording;
- keyboard hold/release recording;
- release-before-permission race handling;
- media-track and timer cleanup;
- object-URL cleanup;
- successful upload emission;
- truthful upload failure with retryable preview;
- duplicate-upload suppression.

Repository CI should also run the normal frontend unit, static-analysis, build, design-governance, and dependency-review gates.

## Rollout and rollback

This is a frontend-only behavioral hardening change and does not change the persisted chat-message schema or media API response shape. A normal frontend rollback is sufficient. Rollback must not restore the former `mock-voice-url` fallback because that represented failed uploads as successful media.

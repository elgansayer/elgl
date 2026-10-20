# Profile learning UI contract

Issue #1310 owns the learner-facing profile summary for native languages, target languages, audio introduction, and study streak.

## Existing profile surface

`ProfileComponent` loads the authenticated profile through `UserService.getMyProfile()` and renders the existing native/target language summary, audio-intro card, and `study_streak_days` value from the same authoritative profile response. It does not introduce a second profile store or a browser-to-Supabase read path.

Language selection remains bounded by the existing profile editor and backend validation. The display path treats language identifiers as text and the editor resolves the repository-owned flag/name helpers. Study streak is display-only on this surface; profile UI does not mutate streak state.

## Audio introduction lifecycle

`AudioIntroRecorderComponent` is both the persisted intro player and the recorder used by `ProfileComponent`.

1. A stored intro is rendered only when it is an absolute HTTP(S) URL. Unsupported schemes and malformed values fail closed and do not become an `<audio>` source.
2. Recording requires the browser MediaDevices and MediaRecorder APIs. A recording is limited to 30 seconds and microphone tracks are stopped when recording stops, fails, or the component is destroyed.
3. Stopping a recording creates a local object-URL preview only. It does **not** update the profile and does not emit `recordingComplete`.
4. Saving requests the existing authenticated presigned-upload contract, validates that both returned upload and durable media URLs are HTTP(S), uploads the blob, and then persists `audio_intro_url` through `UserService.updateMyProfile()`.
5. Only after both upload and profile persistence succeed does the component emit the durable URL to `ProfileComponent`, which updates its local profile signal and success feedback.
6. A failed upload or persistence attempt retains the local blob so the learner can retry without recording again. Concurrent save attempts are deduplicated.

The component revokes local object URLs, stops active tracks/audio, and clears timers during replacement and destroy. No audio bytes, URLs, tokens, profile identifiers, or provider response bodies are logged or added to analytics by this flow.

## Failure and compatibility behavior

- Profile loading continues to use the existing authenticated profile API and its existing loading/error contract.
- Browser recording support or permission failures are presented as an accessible generic error and do not change persisted profile state.
- Unsafe/malformed persisted audio URLs are ignored instead of handed to the media element.
- Upload/provider failures preserve the local preview and are retryable.
- Older clients remain compatible because the profile schema and `audio_intro_url` API contract are unchanged.
- No database migration, backfill, background job, or retention change is introduced by this completion work.

## Accessibility

The audio card is a semantic region with a heading, native audio controls, explicit accessible labels, touch-sized actions, `aria-busy` during recording/upload, a live timer status, and an alert role for failures. Decorative recording indicators are hidden from assistive technology. Reduced-motion users do not receive the recording pulse animation.

The profile's language and streak information remains text-backed rather than colour-only, so it is available to screen readers and survives high zoom/reflow.

## Verification

Focused Angular coverage locks:

- native/target language and study-streak rendering in `ProfileComponent`;
- persisted audio URL integration between `ProfileComponent` and the audio-intro component;
- HTTP(S)-only persisted audio rendering;
- no premature profile update/event when recording stops;
- the 30-second timer and destroy-time microphone/timer cleanup;
- durable event emission only after successful upload plus profile persistence;
- retry preservation after upload failure;
- duplicate-save suppression; and
- fail-closed handling of unsafe presigned/media URLs.

Repository CI remains authoritative for the full frontend unit/static-analysis/build and design/accessibility governance suites.

## Rollout and rollback

This is a frontend-only, API-compatible hardening change. Deploy with the normal Angular release. Existing `audio_intro_url` values and uploaded objects require no migration.

Rollback is a normal code revert. Persisted audio introductions remain valid because their storage/API contract is unchanged. Do not delete media objects as part of a UI rollback.

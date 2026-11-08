# Profile learning summary UI contract

Issue #1310 established the learner-facing profile summary. Issue #1842 completes its native and target language badges, audio introduction, study streak, accessibility, and failure states without creating a parallel profile surface.

## Existing profile surface

`ProfileComponent` loads the authenticated profile through `UserService.getMyProfile()` and renders native and target language badges, the audio-intro card, and the `study_streak_days` value from the same authoritative profile response. It does not introduce a second profile store or a browser-to-Supabase read path.

Language selection remains bounded by the existing profile editor and backend validation. `ProfileLanguageBadgesComponent` trims and de-duplicates returned identifiers, ignores non-string entries, resolves names in the active interface locale with `Intl.DisplayNames`, and uses the repository-owned flag helper. Malformed language tags remain inert text rather than breaking the profile. Missing language lists render an explicit translated not-set state.

`ProfileStudyStreakComponent` is display-only. It normalises absent, negative, non-finite, and fractional API values to a safe whole-day count, formats digits in the active interface locale, and selects a translated singular or plural label with `Intl.PluralRules`. A zero streak includes a translated start prompt and never invents progress.

## Audio introduction lifecycle

`AudioIntroRecorderComponent` is both the persisted intro player and the recorder used by `ProfileComponent`.

1. A stored intro is rendered only when it is an absolute HTTP(S) URL. Unsupported schemes and malformed values fail closed and do not become an `<audio>` source.
2. Recording requires the browser MediaDevices and MediaRecorder APIs. A recording is limited to 30 seconds and microphone tracks are stopped when recording stops, fails, or the component is destroyed.
3. Stopping a recording creates a local object-URL preview only. It does **not** update the profile and does not emit `recordingComplete`.
4. Saving requests the existing authenticated presigned-upload contract, validates that both returned upload and durable media URLs are HTTP(S), uploads the blob, and then persists `audio_intro_url` through `UserService.updateMyProfile()`.
5. Only after both upload and profile persistence succeed does the component emit the durable URL to `ProfileComponent`, which updates its local profile signal and success feedback.
6. A failed upload or persistence attempt retains the local blob so the learner can retry without recording again. Concurrent save attempts are deduplicated.
7. A persisted introduction that emits a media error keeps the re-record action available and presents a translated alert. Replacing the URL clears the stale alert.

The component revokes local object URLs, stops active tracks/audio, and clears timers during replacement and destroy. No audio bytes, URLs, tokens, profile identifiers, or provider response bodies are logged or added to analytics by this flow.

## Failure and compatibility behavior

- Profile loading continues to use the existing authenticated profile API. Loading uses the existing skeleton; an empty or failed response renders an accessible translated error and a working retry action without manufacturing profile data.
- A visitor-list partial failure uses translated generic copy and never exposes transport or provider details.
- Browser recording support or permission failures are presented as an accessible generic error and do not change persisted profile state.
- Unsafe/malformed persisted audio URLs are ignored instead of handed to the media element.
- A safe persisted URL that the browser cannot play renders an accessible unavailable state while leaving replacement recording available.
- Upload/provider failures preserve the local preview and are retryable.
- Older clients remain compatible because the profile schema and `audio_intro_url` API contract are unchanged.
- No database migration, backfill, background job, or retention change is introduced by this completion work.

## Accessibility

The audio card is a semantic region with a heading, native audio controls, explicit accessible labels, touch-sized actions, `aria-busy` during recording/upload, a live timer status, and an alert role for failures. Decorative recording indicators are hidden from assistive technology. Reduced-motion users do not receive the recording pulse animation.

The language summary has separately labelled native and learning groups. Flags and the streak flame are decorative, while language names and the full streak value remain text-backed rather than colour-only. Badges wrap at narrow widths, the summary reflows from one to two columns, and all spacing uses logical properties for RTL.

The code-first visual contract is mapped as `screen.profile`. `frontend/design-preview/screens/profile.html` shows the language badge groups, persisted audio player, and translated streak treatment in the existing mobile light/dark specimen.

## Verification

Focused Angular coverage locks:

- native/target language grouping and study-streak integration in `ProfileComponent`;
- locale-aware language naming, malformed/duplicate input handling, empty lists, wrapping, group labelling, and RTL-safe classes;
- plural-aware streak labels, locale-formatted counts, invalid values, zero-state guidance, and non-colour status text;
- persisted audio URL integration between `ProfileComponent` and the audio-intro component;
- profile loading failure, retry, and recovery without synthetic data;
- persisted audio playback failure and recovery when the durable URL changes;
- HTTP(S)-only persisted audio rendering;
- no premature profile update/event when recording stops;
- the 30-second timer and destroy-time microphone/timer cleanup;
- durable event emission only after successful upload plus profile persistence;
- retry preservation after upload failure;
- duplicate-save suppression; and
- fail-closed handling of unsafe presigned/media URLs.

Repository CI remains authoritative for the full frontend unit/static-analysis/build and design/accessibility governance suites.

## Rollout and rollback

This is a frontend-only, API-compatible presentation and hardening change. Deploy with the normal Angular release. Existing language arrays, streak values, `audio_intro_url` values, and uploaded objects require no migration.

Rollback is a normal code revert. Persisted audio introductions remain valid because their storage/API contract is unchanged. Do not delete media objects as part of a UI rollback.

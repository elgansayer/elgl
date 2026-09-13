# Sequential voice-note autoplay

Issue: #1845

## Product contract

The chat experience exposes an **Auto-play voice notes** preference in Settings. The preference is stored on the authenticated user's profile as `auto_play_voice_notes` and defaults to `false` for accounts that have not opted in.

When enabled, finishing a voice message in a chat asks the browser to play the next playable voice message later in the same loaded timeline. Non-voice messages and malformed voice records without a media URL are skipped. Only one next recording is started for each `ended` event; the next recording's own `ended` event continues the sequence. When the preference is disabled, finishing a recording never starts another recording.

The setting is account-scoped and is read when a chat room is initialised. Existing browser-native audio controls remain available at all times, so users can pause, seek, change output volume, or manually start any recording regardless of the preference.

## Failure behaviour

Autoplay is deliberately best-effort. Browsers may reject a programmatic `HTMLMediaElement.play()` call because of autoplay policy, device state, missing codecs, media/network failure, or loss of the user-activation chain. Those failures are swallowed and the sequence stops; they must not break chat rendering, message history, or manual playback.

If the current message no longer exists in the loaded timeline, no matching audio element exists, or no later playable voice message exists, the operation is a no-op. This makes stale `ended` events safe when navigation or realtime updates change the room.

Failure to load the profile preference also fails closed to `false`, preserving manual playback without unexpectedly starting audio.

## Privacy and security

The feature introduces no new API, credential, message, telemetry, or storage surface. It reuses authenticated profile reads and the existing authorised chat-message/media pipeline. The preference contains no message content. Voice media URLs continue to be obtained through the same chat history and media authorization paths used for manual playback.

No voice transcript, message text, media URL, or playback failure is logged by the autoplay path.

## Accessibility

The setting is exposed through the existing labelled Spartan checkbox in Settings. Native `<audio controls>` remain the primary playback controls, preserving keyboard and assistive-technology operation. Autoplay is opt-in and can be disabled without losing access to voice messages.

The feature does not communicate state through colour and does not replace native focus, seek, pause, or volume controls.

## Verification

Focused frontend regression coverage lives in:

- `frontend/src/app/components/chat-room/chat-room.voice-autoplay.spec.ts`

The suite verifies:

1. the authenticated profile preference is loaded into the room;
2. the next playable voice note starts after the current note ends;
3. records without playable media are skipped;
4. disabling the preference prevents automatic playback;
5. browser autoplay rejection is non-fatal; and
6. stale/unknown message identifiers are safe no-ops.

Run the focused suite from `frontend/` with the repository's Vitest test command targeting `chat-room.voice-autoplay.spec.ts`, or run the normal frontend verification/CI pipeline.

## Rollout and rollback

No schema change is required in this PR. The existing additive migration `20260808000259_add_auto_play_voice_notes_column.sql` already provides the nullable/defaulted profile preference used by both Settings and Chat Room, so mixed-version clients remain compatible.

Rollout requires only the frontend deployment. Rollback is a frontend revert: persisted `auto_play_voice_notes` values can remain in the database because older clients safely ignore the column. There is no data migration or destructive rollback step.

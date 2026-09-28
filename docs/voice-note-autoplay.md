# Sequential voice-note autoplay

Issue #1389 is implemented by the existing profile preference, Settings control, and Chat Room playback chain. This document defines that cross-layer contract so later chat or settings refactors do not silently remove part of the feature.

## Product contract

- `users.auto_play_voice_notes` is the account-scoped preference and defaults to `false`.
- Settings loads the authenticated profile value, exposes it through the translated `settings.autoPlayVoiceNotes` checkbox, and persists it with the normal profile update request.
- Chat Room loads the same authenticated preference after the room is available. If the preference cannot be loaded, autoplay remains off rather than guessing that the learner opted in.
- Autoplay is sequential, not unsolicited. A learner starts a voice note with the native audio control; when that note emits `ended`, Chat Room looks forward for the next voice message with playable media.
- Text, correction, image, sticker, doodle, and voice records without media are skipped.
- Turning the preference off prevents the next note from being started.
- Browser autoplay policy remains authoritative. If `HTMLMediaElement.play()` is rejected, the chain stops without fabricating playback success or retrying in a loop.

This keeps the feature compatible with browser media-consent rules and makes the setting an explicit opt-in rather than a hidden local-device behavior.

## Accessibility and interaction

The preference is associated with visible translated text through the existing labelled Spartan checkbox. Voice-note playback continues to use the browser's native audio controls, preserving keyboard, screen-reader, playback-position, and volume behavior. The feature does not introduce a second custom media control or a focus-management path.

## Privacy and persistence

The preference is ordinary authenticated profile state. No voice-note content, media URL, account identifier, or playback history is required to persist the setting. Failure to load the profile degrades to autoplay off. Playback failures are not logged with private media URLs.

The schema column was added by `20260808000259_add_auto_play_voice_notes_column.sql`; no new migration or backfill is required for #1389.

## Verification

Run the cross-layer contract directly:

```bash
node --test scripts/voice-note-autoplay-contract.test.mjs
```

Frontend CI also owns the behavioural suite at:

```text
frontend/src/app/components/chat-room/chat-room.voice-autoplay.spec.ts
```

The contract fails if the persisted column/default, Settings toggle/save path, Chat Room preference load, `ended` chaining hook, or active behavioural suite is removed.

## Rollout and rollback

This completion change adds verification/documentation only because the runtime feature is already present on `main`. There is no data migration or mixed-version dependency. A rollback may revert the contract files, but removing the runtime preference requires an explicit product decision because stored user intent already exists in the database.

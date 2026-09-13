# Voice message playback speed

Issue #1172 is implemented by the existing `ChatMessageComponent` voice-message renderer. This document records the production contract and the regression coverage that closes the remaining definition-of-done gap.

## User contract

Voice messages expose a touch-sized playback-speed control beside the play action. The control cycles deterministically through `1×`, `1.5×`, `2×`, then back to `1×`. The selected speed is applied when a voice note starts, and changing the speed while that note is active updates the current `HTMLAudioElement` immediately.

The speed is intentionally local to the rendered message component. It is not written to the profile, browser storage, chat payload, analytics, or backend. Re-rendering the message therefore starts from `1×`; this avoids silently changing another device or account's playback preference.

## Failure and lifecycle behaviour

- A voice message without a `media_url` does not construct or start an audio player.
- A browser playback rejection is non-fatal. The failed `HTMLAudioElement` is released from the component's active-player reference, allowing the user to retry playback or choose another speed.
- When playback ends, the active-player reference is released. Later speed changes do not mutate an already-ended audio element.
- The speed control is independent of transcription. A missing or failed transcript does not disable audio playback or speed selection.
- The media URL remains the same authenticated/application-supplied URL already used for normal playback. This feature does not introduce a new network endpoint, persistence layer, or media proxy.

## Privacy and security

Playback speed is purely client-side presentation state. No voice content, transcript, selected speed, token, credential, or additional user identifier is sent by the speed control. Existing authorization and media-delivery controls remain authoritative.

The component must not derive executable markup from media metadata, and the speed value remains a closed TypeScript union (`1 | 1.5 | 2`) rather than accepting untrusted arbitrary values.

## Accessibility

The speed selector is a Spartan touch-sized button and exposes the current multiplier through its accessible label as well as visible text. The multiplier is therefore not communicated by colour alone and remains operable with keyboard, switch, and touch input.

## Verification

Focused regression coverage lives in:

- `frontend/src/app/components/chat-message/chat-message.component.spec.ts`
- `frontend/src/app/components/chat-message/chat-message.voice-playback.spec.ts`

The contract tests cover the complete speed cycle, start-time speed application, live speed changes, playback rejection recovery, ended-playback cleanup, and the no-media no-op path.

Run the frontend unit suite through the repository's normal verification pipeline. GitHub Actions remains the authoritative clean-environment check for this connector-authored change.

## Rollout and rollback

No schema, API, environment, cache, or persisted-data migration is required. The change is safe to deploy with mixed frontend versions because playback speed never leaves the browser.

Rollback is a normal revert of the tests/documentation commit(s). Existing voice messages and uploaded media require no rewrite or cleanup.

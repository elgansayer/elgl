# Click-to-translate and word definition modal

`WordDefinitionModalComponent` is the shared vocabulary surface opened from tokenised chat, Moments, AI conversation and reading experiences.

## Behaviour

- A lookup starts only after Angular has bound the selected `wordToken`; required signal inputs are never read from the constructor.
- The translation target defaults to the current application language. Callers may provide `targetLanguage` when a different explicit target is required.
- Lookup input is bounded to 200 characters and the target language must be a compact BCP-47-style language code.
- The modal renders the translated text, optional transliteration, optional definition and provider pronunciation audio returned by the authenticated `/nlp/translate` flow.
- Provider degradation is fail-closed. Known fallback responses that simply echo the source text and report that translation is unavailable are shown as an error/retry state rather than as a plausible translation or definition.
- Pronunciation URLs are passed through `HtmlSanitisationService` before use. Unsafe URLs are discarded. Only one audio element is active at a time and playback is stopped when the modal closes or is destroyed.
- SRS actions remain retryable after failure. The modal only closes after persistence succeeds.
- If creating a flashcard succeeds but the following SRS-level update fails, the created card is retained locally. Retrying updates that card instead of issuing another create request.
- Saved context is bounded to 2,000 characters to avoid accidental oversized payloads.

## Accessibility and responsive behaviour

The component uses the repository's Spartan dialog primitive rather than a hand-built fixed overlay. That provides dialog semantics, focus management, keyboard dismissal and focus restoration. Actions use touch-sized buttons, content wraps rather than overflowing, and the dialog scrolls inside a viewport-relative maximum height for high zoom and narrow screens. Loading and failure states use status/alert semantics and do not rely on colour alone.

## Privacy and observability

The selected token and surrounding sentence can contain private conversation content. Error reports therefore contain only the component operation and stack information; the raw token/context are not copied into diagnostic metadata or error messages. Provider errors are surfaced to the existing Angular `ErrorHandler` while the user receives a generic retryable state.

No new persistent data is introduced. Flashcard retention/deletion continues to follow the existing flashcard service and database policies.

## Verification

The component test suite covers:

- lookup after required inputs are bound;
- application-language and explicit target-language selection;
- fail-closed provider degradation;
- retryable SRS failures;
- idempotent recovery after a partial create/update failure;
- close/status events only after successful persistence;
- bounded context and unsafe pronunciation URL handling.

Run the frontend test/lint/type-check jobs used by the repository CI before release. Manual verification should include keyboard-only open/close, Escape dismissal, focus restoration, 200%+ zoom, a narrow mobile viewport, a provider failure, audio playback failure and an SRS write failure.

## Rollout and rollback

This is an additive frontend hardening change with no schema migration. It can be deployed with the existing backend. Rollback consists of reverting the component, reader binding and tests/docs commit(s); existing flashcards require no data migration or cleanup.

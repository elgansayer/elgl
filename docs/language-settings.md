# Language Settings contract

Issues: #1097, #1736

## Purpose

`/settings/language` owns the application interface language only. It must not read from or mutate the learner's native languages, target languages, proficiency levels, diagnostic results, discovery filters, or recommendation settings.

The legacy `/language` route redirects to `/settings/language` for backward compatibility. The Settings screen links to the same route.

## Runtime ownership

`LanguageSettingsComponent` reads the supported locale catalogue and current locale through `UiLanguagePreferenceService`. Every rendered interface-language picker uses that same transaction boundary rather than calling the legacy `I18nService.setLanguage(code)` loader directly.

`UiLanguagePreferenceService` validates the selected locale, serialises concurrent changes, waits for a usable dictionary, and commits the preference only after the dictionary is active. If loading fails, it restores the previous locale, dictionary, document language and direction, and persisted preference.

Study-language state remains owned by the profile and learning settings flows. Changing the UI locale therefore cannot silently alter whom the learner is matched with or what language they are studying.

The selection surface uses the repository-owned Spartan radio-group primitive because the interface language is a single-choice setting. The primitive owns selection and keyboard semantics. Relay semantic tokens own surface, text, focus, and selected-state presentation.

## State and failure behaviour

- The currently active interface language is the selected radio value.
- Selecting the already-active locale is an idempotent no-op.
- Unknown locale values are rejected before reaching `I18nService`.
- A locale change disables its picker until the in-flight operation completes. Repeated requests for the same pending locale share the attempt; a conflicting locale request is refused until that attempt finishes.
- Failure restores the controls to an actionable state and exposes a generic translated alert. Provider or credential details are not shown or logged by this component.
- The authenticated `POST /api/nlp/translate-ui` endpoint validates and bounds locale tags and dictionaries, rate-limits requests, batches provider calls, and caches translations by locale and source-text hash. This prevents one caller from poisoning another caller's dictionary keys.
- The translation route has a bounded 512 KiB JSON body limit because the shipped dictionary is larger than Express's 100 KiB default. Other routes retain the default limit, and payment webhook raw-body capture remains intact.
- No database schema or profile mutation is required by this menu.

## Failure handling and observability

- Unsupported locale input is rejected before the translation loader or provider is called.
- Provider absence, timeouts, malformed responses and outages return a generic typed failure. Provider response bodies and credentials are neither logged nor returned.
- Redis read or write failures do not block translation. A cache miss may call the provider again, and successful batches remain cached for a retry after a later batch fails.
- Backend summary logs contain only the normalised locale, counts, provider request count and duration. Frontend refusal logs contain only an allow-listed locale code and failure category. Dictionary keys, translated values, credentials and provider bodies are excluded.

## Accessibility and internationalisation

The page exposes a named `main` landmark and a labelled/described radio group. Spartan provides the single-selection keyboard contract. Every option exposes its native language name as the accessible name; flags are decorative. The selected state is available through radio semantics rather than colour alone.

Layout uses logical spacing, wraps long translated language names, and remains usable in RTL locales and at high zoom. The back action is a touch-sized native Spartan button.

## Verification

Focused component tests cover:

- rendering the supported interface-language catalogue;
- UI-locale changes through `UiLanguagePreferenceService` only;
- current/unknown-locale no-ops;
- radio-group event validation;
- duplicate in-flight change suppression;
- failure recovery and alert semantics;
- landmark/group labelling;
- back navigation without locale mutation.

Focused backend tests cover request-size routing, raw-body preservation, DTO validation, HTTP validation, rate limiting, cache isolation, bounded provider batching, retries, provider failures and sanitised operational logs.

Repository pull-request CI remains authoritative for frontend unit tests, static analysis, production build, translation-safety, Spartan ownership, design governance, and wider integration checks.

## Rollout and rollback

This is a backward-compatible frontend and API change. Deploy the backend before or with the frontend so uncached non-English locale changes can submit the complete dictionary. No database migration, backfill or Redis cache migration is required because the new source-text cache keys are additive and expire after seven days.

Rollback is a normal code revert. The existing `hellotalk_locale` and browser dictionary keys remain compatible with the previous UI. Reverting the backend removes only the additive per-source cache entries through normal expiry; it does not require deleting persisted user or study-language data.

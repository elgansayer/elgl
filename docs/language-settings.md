# Language Settings contract

Issue: #1097

## Purpose

`/settings/language` owns the application interface language only. It must not read from or mutate the learner's native languages, target languages, proficiency levels, diagnostic results, discovery filters, or recommendation settings.

The legacy `/language` route redirects to `/settings/language` for backward compatibility. The Settings screen links to the same route.

## Runtime ownership

`LanguageSettingsComponent` reads the supported locale catalogue and current locale from `I18nService`. Selecting a locale calls only `I18nService.setLanguage(code)`.

Study-language state remains owned by the profile and learning settings flows. Changing the UI locale therefore cannot silently alter whom the learner is matched with or what language they are studying.

The selection surface uses the repository-owned Spartan radio-group primitive because the interface language is a single-choice setting. The primitive owns selection and keyboard semantics. Relay semantic tokens own surface, text, focus, and selected-state presentation.

## State and failure behaviour

- The currently active interface language is the selected radio value.
- Selecting the already-active locale is an idempotent no-op.
- Unknown locale values are rejected before reaching `I18nService`.
- A locale change disables the group until the in-flight operation completes, preventing conflicting concurrent updates.
- Failure restores the controls to an actionable state and exposes a generic translated alert. Provider or credential details are not shown or logged by this component.
- No backend schema or profile mutation is required by this menu.

## Accessibility and internationalisation

The page exposes a named `main` landmark and a labelled/described radio group. Spartan provides the single-selection keyboard contract. Every option exposes its native language name as the accessible name; flags are decorative. The selected state is available through radio semantics rather than colour alone.

Layout uses logical spacing, wraps long translated language names, and remains usable in RTL locales and at high zoom. The back action is a touch-sized native Spartan button.

## Verification

Focused component tests cover:

- rendering the supported interface-language catalogue;
- UI-locale changes through `I18nService` only;
- current/unknown-locale no-ops;
- radio-group event validation;
- duplicate in-flight change suppression;
- failure recovery and alert semantics;
- landmark/group labelling;
- back navigation without locale mutation.

Repository pull-request CI remains authoritative for frontend unit tests, static analysis, production build, translation-safety, Spartan ownership, design governance, and wider integration checks.

## Rollout and rollback

This is a frontend-only, backward-compatible change. No database migration, backfill, cache migration, or server rollout is required. Rollback is a normal code revert; the existing `hellotalk_locale` preference remains compatible with the previous UI.

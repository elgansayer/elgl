# Language Settings

## Purpose

The Language Settings screen controls the application interface locale independently of the languages a member studies or speaks natively. Changing the interface language must not mutate target-language, native-language, discovery, diagnostic, or learning-plan state.

The canonical route is `/settings/language`. The historical `/language` URL remains as a redirect so saved links continue to work, but both routes are owned by the settings route group rather than the learning route group.

## Runtime contract

`LanguageSettingsComponent` renders the supported interface locales from `I18nService.availableLanguages` with one Spartan radio group. The selected value is the active UI locale only. The component does not load or persist profile study-language fields.

User-triggered changes go through `UiLanguagePreferenceService`, which adds a transactional boundary around the legacy dynamic translation loader:

1. Reject values that are not in the supported interface-language catalogue.
2. Snapshot the active locale and dictionary.
3. Discard a malformed cached dictionary for the requested locale.
4. Ask `I18nService` to load/switch the locale.
5. Commit only when the requested locale is active and a usable dictionary is present.
6. Roll back the locale, dictionary, document `lang`/`dir`, and best-effort persisted locale if loading fails.

English (`en`, `en-GB`, `en-US`) uses the checked-in base dictionary and does not require the dynamic translation provider. Non-English locale changes require a newly loaded/cached dictionary. This specifically closes the legacy split-brain failure mode where `currentLang` could change while UI strings remained in the previous language after an authentication, provider, or network failure.

## Persistence and privacy

The device preference uses the existing `hellotalk_locale` local-storage key. Dynamic dictionaries use the existing `hellotalk_dict_<locale>` keys. Browser storage is best effort: privacy mode, quota limits, or disabled storage must not corrupt the active in-memory UI state.

Changing interface language does not write profile language fields and does not change partner matching or study recommendations. Dynamic UI translation sends the checked-in interface dictionary to the authenticated translation endpoint; it does not send chat messages, Moments, profile biographies, vocabulary, or other user-authored content.

No credentials, translation dictionaries, or user content should be logged by this boundary.

## Failure behaviour

- Unsupported locale: no translation request is made and the existing UI locale remains active.
- Authentication/provider/network failure: the previous locale and dictionary are restored and the screen exposes a retryable error state.
- Malformed cached dictionary: the cache entry is removed before loading; provider loading may then recover normally.
- Browser storage unavailable: the active session can still change language; persistence may be lost after reload.
- RTL rollback: the document `lang` and `dir` attributes are restored together with the previous dictionary.
- Concurrent clicks: the screen disables the radio group while a change is in progress, preventing overlapping menu mutations.

## Accessibility

The settings page uses a labelled main landmark and a labelled Spartan radio group. Each language option exposes its native name, selected state is available through radio semantics rather than colour alone, controls retain a minimum 44 px touch target, and the loading state is announced through a polite status region. The document direction is updated by the active locale and restored on failed switches.

## Verification

Focused coverage lives in:

- `frontend/src/app/services/ui-language-preference.service.spec.ts`
- `frontend/src/app/pages/language-settings/language-settings.component.spec.ts`
- `frontend/src/app/routes/language-settings.routes.spec.ts`

The suites cover successful changes, unsupported values, silent translation-loader failure, thrown provider failure, RTL rollback, corrupt cached dictionaries, retryable UI errors, duplicate in-flight prevention, accessible radio semantics, and settings-owned routing.

Canonical CI should additionally run frontend lint/static-analysis/build and the repository-wide UI, E2E, dependency, and governance checks.

## Rollout and rollback

No database migration, API schema change, or data backfill is required. Deploy as a normal frontend release. Existing stored locale and dictionary keys remain compatible.

Rollback is a normal code revert. The `/language` compatibility redirect should be retained if the implementation is reverted so existing bookmarks do not break. No server or Supabase cleanup is required.

# Interface translation and mirroring contract

Issue: #1752

## Purpose

This contract covers how the application interface is translated into the learner's language, how the layout is
mirrored for right-to-left languages, and how the correction and translation surfaces keep mixed-direction text
readable. It builds on `docs/chat-translation-and-corrections.md` (message translation and corrections),
`docs/nlp-translation-routing.md` (provider order and keys) and `docs/language-settings.md` (the language picker).

## What was broken

- The browser sent the whole English dictionary (about 109 KiB, over 2,000 strings) in one request. The API body
  parser allows 100 KiB and rejected it with HTTP 413, and DeepL accepts at most 50 texts per request, so dynamic
  interface translation could not succeed for any language.
- Translations were cached as one entry per language for seven days. Whichever request arrived first after the
  entry expired decided the strings every other user received, including strings of its own choosing, and a changed
  English string did not reach users until the entry expired.
- Placeholders such as `{{coins}}` were sent to the provider unprotected, so a provider could alter or translate
  one, and the interface would then print the damaged placeholder literally.
- Right-to-left mirroring only recognised the bare codes `ar`, `he`, `fa` and `ur`. A locale such as `ar-EG` or
  `he-IL` stayed left to right.
- The quick tags in the correction modal were hard-coded English, and the translate control on a correction was
  invisible until hover, which keyboard and touch users cannot do.

## API contract

`POST /api/nlp/translate-ui` (called by the browser as `${environment.apiUrl}/nlp/translate-ui`).

Request body:

| Field | Rule |
| --- | --- |
| `target_language` | BCP 47 style tag, for example `ar`, `pt-BR`, `zh-Hant-TW`. At most 35 characters, matching `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` and parseable as a locale. |
| `dictionary` | Plain object of English strings keyed by translation key. 1 to 500 entries, keys 1 to 200 characters (never `__proto__`, `constructor` or `prototype`), values at most 2,000 characters, at most 100,000 characters in total. |

Unknown properties are rejected by the global validation pipe. The limits live in `UI_DICTIONARY_LIMITS` in
`backend/src/nlp/dto/translate-ui.dto.ts`.

Response body:

```json
{
  "target_language": "ar",
  "translations": { "common.coinsBalance": "{{coins}} عملة" },
  "cached": false
}
```

`translations` has exactly the keys that were sent. `cached` is `true` when no provider call was needed.

| Status | When |
| --- | --- |
| 201 | Every string is translated, served from the cache, or deliberately left in English. |
| 400 | The body fails validation, or the language tag is not a valid locale. |
| 401 | The bearer token is missing, invalid or expired. |
| 429 | The per-minute throttle, the per-user rate limit or the daily provider budget is exhausted. |
| 503 | No provider is configured, or at least one chunk could not be translated by any provider. |

The response is never stored by a browser or a shared cache (`Cache-Control: private, no-store`).

### Text that is not translated

- Any tag whose language is English (`en`, `en-GB`, `en-AU`, ...) returns the dictionary unchanged with
  `cached: true`. No provider, cache or budget is touched.
- Strings with no letters once placeholders are removed (numbers, symbols, emoji, a lone `{{count}}`) are returned
  unchanged and never sent to a provider.
- A string whose translation fails validation stays in English for that request and is not cached (see below).

## How a dictionary is translated

### Browser

`I18nService.setLanguage(code)` (`frontend/src/app/services/i18n.service.ts`):

1. Trims the code, ignores an empty one, and records the choice in `hellotalk_locale`.
2. Sets `lang` and `dir` on the document immediately, so the layout mirrors before any network call.
3. English codes use the built-in dictionary and make no request.
4. A dictionary cached in `hellotalk_dict_<code>` is applied without a request.
5. Otherwise, with an access token, it sends the English dictionary in sequential batches of
   `UI_TRANSLATION_BATCH_SIZE` (400, which must stay at or below the API limit of 500). About six requests cover
   the whole dictionary.
6. The result is applied and cached only when every batch succeeded and returned a `translations` object of
   strings. Any failed batch keeps the current dictionary and caches nothing, so a half translated interface is
   never shown or stored.
7. A request is applied only if it is still the latest selection. A slower response for an earlier choice cannot
   overwrite a newer language, although its complete dictionary is still cached for its own language.

A visitor without an access token receives the layout direction and any cached dictionary but no new translations,
because the route is authenticated.

### API

`UiDictionaryTranslationService` (`backend/src/nlp/ui-dictionary-translation.service.ts`):

1. **Content-addressed cache.** Each unique source string is cached at
   `ui_i18n:v2:<language>:<sha256(source)>` for 30 days. A cached value can only be the translation of the exact
   text it is addressed by, so one user cannot change what another receives, and an edited English string is
   translated afresh without any invalidation. Values are re-validated when read.
2. **One translation per language at a time.** Concurrent requests for a language wait on an in-process lock and
   re-read the cache, so identical strings are not paid for twice in one process.
3. **Provider order.** DeepL when `DEEPL_API_KEY` is set, then Azure AI Translator when `AZURE_TRANSLATOR_KEY` is set.
   If DeepL rejects the language or is unavailable, the rest of that request uses Azure.
4. **Provider limits.** Strings are chunked to at most 50 texts, 96 KiB and 20,000 characters per request, three
   chunks in flight, 10 second timeout per provider request.
5. **Placeholder protection.** `{{name}}` placeholders are wrapped so the provider does not translate them (DeepL
   `tag_handling: xml` with `ignore_tags`, Azure `notranslate` spans), and `&`, `<` and `>` are escaped.
6. **Output validation.** A translation is accepted only if it is non-empty, at most 4,000 characters, contains
   exactly the placeholders of its source, and contains no `<` unless its source does. Anything else is dropped,
   the English string is returned, and nothing is cached.
7. **Resumable.** Each accepted chunk is written to the cache immediately. After a provider failure a retry only
   translates what is still missing.

## Abuse resistance and cost control

- `SupabaseAuthGuard` authenticates every call, and the controller rejects a request without a user.
- `@Throttle` allows 30 requests per minute, and `@NlpRateLimit` allows 40 requests per 10 minutes per user. A full
  language needs about six requests.
- Cache misses are charged against a daily budget of 300,000 provider characters per user (UTC day). Cache hits
  are free. Characters that were not translated because a provider failed are refunded.
- Input is bounded by the DTO (see above), including a total character cap per request.
- The Redis counters (rate limit and budget) fail open, consistent with `NlpRateLimiterGuard`, so a Redis outage
  does not take translation down. The throttle and the DTO bounds still apply. The cache is unavailable in the same
  incident, so every request translates from scratch: watch `ui_translation_budget_unavailable` and provider spend
  until Redis recovers.

## Failure behaviour

| Failure | API result | Browser result |
| --- | --- | --- |
| Invalid body or locale | 400, nothing is called | Dictionary unchanged, language and direction still applied |
| Over the throttle, rate limit or budget | 429, no provider call | Dictionary unchanged, the user can retry later |
| No provider configured | 503 and an error log | Dictionary unchanged |
| Provider error, timeout or bad payload | Falls back to Azure, then 503 with a generic message | Dictionary unchanged, nothing cached |
| Placeholder altered by a provider | The English string is kept for that key | Shown in English |
| Redis unavailable | Warning logs, translation continues without the cache | Slower, otherwise unaffected |
| Network failure in the browser | Not applicable | Dictionary unchanged, nothing cached |

Provider response bodies, source strings and translated strings are never returned to the caller or logged.

## Observability

All lines are emitted by `UiDictionaryTranslationService` with `key=value` fields and carry no keys, strings,
tokens or user identifiers:

| Event | Level | Meaning |
| --- | --- | --- |
| `ui_translation_completed` | log | Language, entry count, unique strings, cache misses, source fallbacks, duration in milliseconds |
| `ui_translation_provider_failure` | warn | Provider, failure class or HTTP status, language, chunk size |
| `ui_translation_incomplete` | warn | Failed chunks, translated and requested counts before the 503 |
| `ui_translation_unconfigured` | error | Neither provider key is configured |
| `ui_translation_budget_exceeded` | warn | Requested characters and the budget when a 429 is returned |
| `ui_translation_budget_unavailable` | error / warn | The budget counter could not be read, or a refund failed |
| `ui_translation_cache_unavailable` | warn | A cache read or write failed |

Correlate a user report with the request log (status 429 or 503 and the route) and the lines emitted during the
same request. A rising `cacheMisses` count for an already warmed language points at a changed English dictionary
or a cache problem.

## Interface mirroring

`resolveTextDirection(locale)` in `frontend/src/app/services/text-direction.ts` is the single source of truth.

- Right-to-left languages are matched by their primary language subtag, so `ar`, `ar-EG`, `he-IL`, `fa-IR` and
  `ur-PK` all mirror. Case and `_` separators are accepted. The list covers Arabic, Hebrew, Persian, Urdu, Pashto,
  Sindhi, Uyghur, Yiddish, Dhivehi, Central Kurdish and related languages.
- An explicit script subtag wins: `az-Arab`, `ku-Arab` and `pa-Arab` are right to left while `az`, `ku` and `pa` are
  not, and `ar-Latn` is left to right.
- Unknown or empty input is left to right.

It drives `document.documentElement.dir`, the `I18nService.direction` signal and the rollback of a failed language
change in `UiLanguagePreferenceService`. A test checks that the `isRtl` flag of every selectable language agrees
with it.

Layout uses Tailwind logical properties only (`npm run check:rtl-logical` and `npm run check:rtl-logical-contract`
enforce this). Text that comes from a user or a translation can be in a different direction from the interface, so
it uses `dir="auto"`: the compared text and tutor explanation in `VisualDiffComponent`, the correction modal fields,
and, in the chat room, translations, transliterations and the sentence in a correction request.

## Language corrections

- The correction modal quick tags are the keys `correction.tag.naturalPhrasing`, `correction.tag.grammar`,
  `correction.tag.typo` and `correction.tag.vocabulary`. Labels follow the interface language and are tracked by
  key, so two languages that translate two tags identically still render both.
- `VisualDiffComponent` marks changes with `<ins>` and `<del>` (strikethrough as well as colour), keeps the
  translate control permanently visible and keyboard reachable, exposes its state with `aria-pressed`, and
  announces the translated explanation in a `role="status"` region. A failed translation or flashcard shows a
  translated error toast (`moments.transError`, `correction.flashcardError`) and keeps the explanation on screen.
- The decorative symbol on the flashcard action is hidden from the accessible name.

## Data, retention and privacy

No database table or migration is added. Redis holds `ui_i18n:v2:<language>:<hash>` (30 days) and
`ui_i18n:budget:<userId>:<UTC date>` (2 days). The cache holds only English interface strings and their
translations, never user content. The old `ui_dict:<language>` keys are no longer read or written and expire within
seven days of the last old write. The browser keeps `hellotalk_dict_<code>` and `hellotalk_locale` in local storage
as before.

## Configuration

No new variable is required. The route reuses `DEEPL_API_KEY`, `AZURE_TRANSLATOR_KEY` and
`AZURE_TRANSLATOR_REGION` (`global` omits the regional header), documented in `docs/nlp-translation-routing.md`.

## Verification

- Backend unit: `ui-dictionary-translation.service.spec.ts` (cache addressing, poisoning, chunk limits, placeholders,
  fallback, failure, budget, concurrency, logging), `dto/translate-ui.dto.spec.ts`, `nlp.controller.spec.ts` and
  `translate-ui.contract.spec.ts` (guards, throttle, and that the browser batch size and field names match the DTO).
- Backend end to end: `test/nlp-translate-ui.e2e-spec.ts` (validation, authentication, no-store header, cache reuse,
  429 and 503) and the `/nlp/translate-ui` case in `test/app.e2e-spec.ts`.
- Frontend: `text-direction.spec.ts`, `i18n.service.translate-ui.spec.ts` (mirroring, batching, failure,
  overlapping selections), `correction-modal.completion.spec.ts`, `visual-diff.component.spec.ts` and the
  mixed-direction cases in `chat-room.component.spec.ts`.

Repository CI remains authoritative for the full build, lint and test gates.

## Rollout

1. Deploy the API first. It is backward compatible: an older browser already fails against the body limit, and a
   new browser only sends requests the new API accepts.
2. Deploy the browser bundle. Dictionaries already cached in local storage keep working.
3. Watch `ui_translation_completed` (`cacheMisses`, `durationMs`), `ui_translation_provider_failure` and 429 or 503
   rates. The first user of a language pays for provider calls (about 40 DeepL requests for the whole dictionary),
   and later users are served from the cache.

## Rollback and recovery

- Revert the browser bundle before, or together with, the API. A new browser against an older API sends batches of
  up to 400 strings, which exceeds the 50 texts DeepL accepts per request, so every batch fails and the browser
  keeps its current dictionary.
- Reverting the API needs no data repair. `ui_i18n:*` keys are ignored by the older code and expire on their own.
- To discard cached translations (for example after finding a poor provider output), delete the keys matching
  `ui_i18n:v2:<language>:*` with a Redis `SCAN`. They are rebuilt on demand.
- To lift a user's daily limit, delete `ui_i18n:budget:<userId>:<date>`.
- To stop provider spend during an incident, remove both provider keys. Requests then return 503 and browsers keep
  their current dictionary.

## Known limits and follow-ups

- A dictionary cached in the browser is never refreshed. A new or corrected English string reaches existing users
  only when their local copy is cleared. Storing a revision of the English source next to the cached dictionary
  would let the browser re-request just the changed strings, which the API now serves cheaply.
- The language lock is per process. Several API instances can translate the same new language at the same time,
  bounded by each user's budget.
- Visitors who are not signed in cannot fetch new interface translations, because the route requires a user. A
  public, edge-cached dictionary would be a separate design.
- Metrics for provider latency and cache hit rate are not exported yet. The log events above carry the counts and
  durations needed to add them through `MetricsService`.

# PII scrubbing before text reaches DeepL or Azure

Issue: #2042

## Outcome

Chat text that is sent to a third-party language provider no longer carries the sensitive values it contains. Before a request to DeepL or Azure Translator is built, every email address, phone number, payment card, IBAN, national identifier, IP address, URL and social handle is replaced by an opaque redaction token. The provider translates the words around the redaction token, and the original values are put back into the response before the user sees it. The user-visible result is unchanged; the provider never receives the value.

The scrubber is a pure module, `backend/src/privacy/pii-redaction.ts`. It has no I/O, no state and no configuration, so it cannot be left half-wired: every egress method below calls it before building its request.

## Egress paths covered

| Service and method | Provider call | Protection |
| --- | --- | --- |
| `TranslationService.detectLanguage` (chat voice-room overlay) | DeepL translate, used for detection | placeholders |
| `TranslationService.translate` and `translateWithDetection` (`/chat/translate-voiceroom`, `/chat/translate-real-time`) | DeepL translate | placeholders |
| `TranslationRouterService.translate` (`/nlp/translate`) | DeepL, then Azure Translator fallback | placeholders, fresh per attempt |
| `TranslationRouterService.transliterate` and the automatic transliteration after a translation (`/nlp/transliterate`) | Azure transliterate | only the pieces between sensitive spans are sent |
| `NlpService.translate` (used by `translateBio`) | DeepL translate and the reverse look-up | placeholders |
| `NlpService.translateAndCorrect` (`/nlp/translate-and-correct`) | DeepL translate, Azure detect, dictionary lookup and translate | placeholders |
| `NlpService.grammarCheck` | Azure detect, dictionary lookup and translate | placeholders |

Egress that is deliberately not covered:

- **Audio.** Azure Speech transcription and pronunciation scoring receive a recording. The audio is the personal data and cannot be scrubbed as text, and a pronunciation reference text must match what was spoken. These flows rely on the existing consent and rate-limit controls.
- **Curated vocabulary.** `HobbyTagsService` sends words from the static `TAG_BASE_VOCABULARY` dictionary in code, not chat text.
- **Interface strings.** `NlpService.translateUi` sends the client's static English dictionary, never user content.
- **Other processors.** The `pronunciation_url` returned by the translation endpoints is a Google text-to-speech link that the client fetches, and the LLM proxy forwards prompts to its own provider. Neither is DeepL or Azure, so both remain follow-up work.

## What is detected

Detection favours recall. A false positive costs almost nothing because every value is restored, while a miss sends a value to a third party.

| Category | Detects | Validation |
| --- | --- | --- |
| `url` | `http(s)://`, `www.` and `domain.tld/path` links | trailing punctuation stays outside the span |
| `email` | addresses with Unicode and fullwidth characters | bounded local part and domain |
| `handle` | `@name` social handles and mentions | at least two characters after the `@` |
| `iban` | IBANs with or without spaces | ISO 7064 mod 97 checksum, longest valid prefix so trailing words stay readable |
| `national_id` | US social security numbers, UK national insurance numbers | impossible areas, groups and prefixes are rejected |
| `ip` | IPv4 and IPv6 | octet range for IPv4, `net.isIPv6` for IPv6 |
| `card` | 13 to 19 digit payment cards, spaced, hyphenated or compact | Luhn checksum |
| `phone` | digit runs joined by single spaces, dots, hyphens or brackets: at least 7 digits after a `+`, 8 with separators, 9 when compact | dates, decimals and year ranges are excluded |

Digits are matched in every Unicode decimal-digit script, so a number typed with Arabic-Indic or fullwidth digits is masked too. Digits next to CJK text are masked without needing a space, and groups may be joined by ordinary or non-breaking spaces, dots, brackets, hyphens or en dashes.

Out of scope, because they cannot be recognised without a statistical model: personal names, free-form postal addresses and deliberately obfuscated values such as `john at example dot com`. National identifiers that are purely numeric are still caught by the generic long-number rule, which reports them as `phone`.

## How it works

1. `protectText` finds spans with the detectors, in priority order. A lower-priority match that overlaps an accepted span is dropped, so a URL keeps the email, IP and digits inside it.
2. Each span becomes a redaction token `PII<8 random letters><index>Z`, for example `PIIQKXTMWHP0Z`. The letters are random per call, so a user cannot forge a redaction token, and the redaction token contains only ASCII letters and digits so providers leave it alone and right-to-left rendering cannot reorder it.
3. The masked text is sent. The original values stay inside the `ProtectedText` object, in private fields, so serialising or logging the object cannot disclose them. Its string form is `ProtectedText(redactions=<n>)`.
4. `restore` swaps the placeholders in the provider response back to the original values. Matching ignores case, tolerates a provider localising the digits of the index, and inserts values literally, so a value such as `$&` cannot be misread as a replacement pattern.
5. If only sensitive spans remain (for example a message that is just an email address), no provider is called. Translation returns the text unchanged and language detection returns `en`.

Script conversion is different. A transliteration provider rewrites letters, so it would also rewrite a redaction token. For `transliterate` the provider receives only the non-sensitive pieces, as separate `Text` entries, and the original spans are re-inserted between the converted pieces with their surrounding whitespace preserved.

## Failure and partial-failure behaviour

A response is treated as invalid when a redaction token is missing, unknown or damaged. The user never sees a translation that silently dropped a value.

| Path | On a damaged redaction token |
| --- | --- |
| `TranslationRouterService.translate` | the response counts as invalid, so Azure is tried with a fresh masked request; if no provider returns it intact the endpoint answers `503` as it does for any provider outage |
| `TranslationService.translate` | the source text is returned and nothing is cached, so a retry can succeed |
| `NlpService.translate` | falls back to the existing degraded result; a damaged reverse look-up keeps the translation as the transliteration |
| `NlpService.grammarCheck` and `translateAndCorrect` | the correction falls back to the original text and the explanation to its default |
| transliteration | a response with the wrong number of results is invalid |

Provider outages, timeouts, rate limits and authorisation are unchanged. Masking runs before any request is built, so if it ever failed the call would fail and nothing would be sent (fail closed); for any string input the practical worst case is that it finds nothing.

## Observability

Logs never contain message text, values, user identifiers or provider payloads.

- `pii_scrubbed provider=<deepl|azure> operation=<operation> outcome=<redacted|skipped> redactions=<n> categories=email:1,phone:2` at debug level.
- `pii_placeholder_mismatch provider=<provider> operation=<operation> redactions=<n>` at warn level.

Prometheus counters on `/metrics`, all with closed label sets:

- `hellotalk_pii_scrub_total{provider,operation,outcome}` where `outcome` is `clean`, `redacted`, `skipped` or `placeholder_mismatch`. It counts every provider call that carries user text.
- `hellotalk_pii_redactions_total{provider,operation,category}` counts redacted spans.

Useful queries:

```promql
# Share of redacted calls where the provider damaged a redaction token
sum(rate(hellotalk_pii_scrub_total{outcome="placeholder_mismatch"}[15m]))
  / sum(rate(hellotalk_pii_scrub_total{outcome="redacted"}[15m]))

# Volume by category, to spot unusual spikes
sum by (category) (rate(hellotalk_pii_redactions_total[1h]))
```

A sustained mismatch share above a few percent means a provider changed how it treats opaque tokens and the redaction token format needs revisiting.

## Performance and abuse resistance

Every pattern is linear time: quantifiers are unambiguous or bounded, and lookbehinds stop a scan from restarting inside a run it already rejected. The spec asserts that 100,000 character inputs designed to trigger backtracking (long runs, repeated `@`, endless domains, digit chains ending in a letter, IBAN-like prefixes) finish within two seconds; they complete in about 150 ms or less locally. Request size is still bounded by the existing 100 KiB body limit and the existing per-user rate limits.

## Configuration, data and retention

There is no configuration, flag, migration or persisted data. Raw values exist only in memory for the duration of one request. The in-memory chat translation cache is unchanged and still keyed by the source text it already held. The scrubber cannot be switched off at runtime, by design.

## Rollout and rollback

Deploy the backend normally. The change is stateless and safe with mixed versions: instances running the old code simply send unscrubbed text, instances running the new code scrub it. To roll back, revert the deployment; no stored data needs repair, and the two metric families stop receiving samples. Text sent to a provider before the rollout cannot be recalled.

## Adding a category

Add a `Detector` to `DETECTORS` in `pii-redaction.ts` at the right priority, add its name to `PII_CATEGORIES`, and add a row to the table-driven cases in `pii-redaction.spec.ts`. Keep the pattern linear time and add an adversarial input to the worst-case list.

## Verification

- `backend/src/privacy/pii-redaction.spec.ts`: every category, false-positive guards, restore tolerance and rejection, segments, disclosure safety, worst-case input and the telemetry helpers.
- `translation.service.spec.ts`, `translation-router.service.spec.ts` and `nlp.service.spec.ts`: for each egress path, the outbound request body never contains the value, the response is restored, a damaged redaction token is handled as above, sensitive-only text makes no call, and metrics and logs are value-free.
- `chat.translate-pii.http.spec.ts` and `nlp.translate-pii.http.spec.ts`: the real controllers and services booted the way `main.ts` does, with only the provider network replaced. They post a message over HTTP and assert that the provider request is free of the values, the response carries them, a damaged redaction token is handled as above, and a malformed body is rejected before any provider call.
- `metrics.service.spec.ts`: the two counters.

Run them with `cd backend && npx vitest run src/privacy/pii-redaction.spec.ts src/chat/translation.service.spec.ts src/chat/chat.translate-pii.http.spec.ts src/nlp src/metrics/metrics.service.spec.ts`.

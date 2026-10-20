# NLP translation and transliteration routing

Issue: #975

## Runtime contract

Authenticated user translation requests use `POST /nlp/translate`. The backend owns provider selection so browsers never receive DeepL or Azure credentials.

The route uses this order:

1. DeepL translation when `DEEPL_API_KEY` is configured.
2. Azure AI Translator when DeepL is unavailable, times out, rejects the request, or returns an invalid payload.
3. `503 Service Unavailable` when neither provider can return a real translation.

The backend no longer treats the source text as a successful translation when both providers are unavailable. This prevents degraded infrastructure from being presented to learners as valid language output.

For translated text that is already Latin script, `transliteration` is the translated text. For supported non-Latin target languages the router asks Azure Translator for an ISO 15924 script conversion. If automatic transliteration is unavailable, translation still succeeds and the optional `transliteration` field is omitted.

Explicit script conversion uses `POST /nlp/transliterate` with:

```json
{
  "text": "こんにちは",
  "language": "ja",
  "from_script": "Jpan",
  "to_script": "Latn"
}
```

`language` accepts a bounded BCP-47-style language tag and script fields accept four-letter ISO 15924 identifiers. Text is limited to 5,000 characters. Azure returns `400` for unsupported language/script combinations; the API exposes that as a generic validation error without returning provider response bodies.

## Authentication and abuse resistance

Both endpoints inherit `SupabaseAuthGuard` and `NlpRateLimiterGuard` from `NlpController`. They also use endpoint throttling and the existing daily AI allowance in `NlpService.checkRateLimit`:

- free accounts consume the existing daily AI quota;
- VIP accounts keep the existing unlimited daily allowance;
- one translation request consumes one quota unit even when provider fallback or automatic transliteration is required;
- provider keys, request text, user IDs and provider response bodies are never written to logs.

Important provider failures emit only a structured provider/operation/status or exception-name signal, for example `provider=deepl operation=translate status=503`. This is sufficient to correlate outages without exposing private message content.

## Provider configuration

Required production secrets remain server-side:

- `DEEPL_API_KEY`
- `AZURE_TRANSLATOR_KEY`
- `AZURE_TRANSLATOR_REGION` when the Azure resource requires a regional header

DeepL keys ending in `:fx` use `api-free.deepl.com`; other keys use the production `api.deepl.com` host. `AZURE_TRANSLATOR_REGION=global` intentionally omits the regional header. The existing environment validation and example files already define these variables.

Every external request has a 10-second timeout. A provider timeout or malformed payload moves translation to the next provider instead of hanging the request. Explicit transliteration has no honest second provider and therefore fails with `503` when Azure is unavailable.

## Automatic transliteration

Automatic transliteration is deliberately conservative. The router currently knows the standard Latin-target script pair for Arabic, Persian, Hebrew, Hindi, Japanese, Russian, Thai and Ukrainian. Azure remains authoritative for whether a specific pair is supported. Unsupported automatic conversion never prevents a valid translation from being returned.

Clients that need a specific Azure-supported language/script pair should call `/nlp/transliterate` explicitly rather than relying on automatic inference.

## Verification

Automated coverage includes:

- DeepL as the primary translation provider;
- Azure fallback after DeepL failure;
- local language detection when `source_language` is omitted;
- fail-closed behaviour when both providers are unavailable;
- automatic Azure transliteration after non-Latin translation;
- explicit script normalisation and transliteration;
- unsupported explicit script-pair handling;
- Azure global versus regional header behaviour;
- controller authentication/profile routing and VIP-state propagation.

The repository CI remains authoritative for backend build, lint, unit and E2E verification.

## Rollout

Deploy the backend normally with both provider credentials configured. No database migration or persisted-data backfill is required. Existing `/nlp/translate` clients keep the same success response fields. The new `/nlp/transliterate` route is additive.

During rollout, watch sanitised `nlp_provider_failure` and `nlp_provider_exception` log volume. A rise in DeepL failures with successful requests indicates Azure fallback is carrying traffic. Failures from both providers result in explicit `503` responses and should be treated as an upstream outage.

## Rollback

Revert the issue #975 PR. There is no schema or stored-state rollback. If a provider has an incident, disable only that provider credential to force the remaining configured route. Do not restore the previous behaviour that returned the source text as though it were a successful translation.

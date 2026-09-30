# Pronunciation scoring

## API contract

`POST /nlp/pronunciation-score` provides scripted pronunciation assessment for authenticated learners. The route keeps the existing Supabase authentication boundary, NestJS request throttle, per-user NLP rate limiter, free-tier daily AI quota, and `Cache-Control: private, no-store` behavior.

Request body:

```json
{
  "audio_url": "https://media.example.com/pronunciation/sample.wav",
  "target_text": "Good morning.",
  "language": "en-US"
}
```

`audio_url` must be a trusted HTTPS media URL. The backend accepts the canonical `CLOUDFLARE_R2_PUBLIC_URL` host and hosts explicitly configured in `CLOUDFLARE_R2_SOURCE_HOSTS`; arbitrary Internet URLs are rejected before fetch to prevent the scoring endpoint becoming an SSRF primitive. Redirects are not followed. URLs are capped at 2,048 characters and target text at 1,000 characters.

Azure Speech's short-audio pronunciation REST API supports 16 kHz mono PCM WAV and OGG/Opus. The service therefore validates the fetched media type rather than labelling arbitrary browser audio as WAV. Downloaded samples are bounded to 2 MiB, which comfortably covers Azure's pronunciation-assessment limit of at most 30 seconds for the supported formats. Unsupported WebM or other codecs return a validation error; clients should transcode/record into one of the supported formats before upload.

A successful response preserves the existing typed contract:

```json
{
  "overall_score": 92,
  "breakdown": [
    {
      "word": "morning",
      "score": 83,
      "feedback": "Azure assessment: Mispronunciation",
      "phonemes": [
        {
          "phoneme": "ə",
          "expected_phoneme": "ɔ",
          "score": 61,
          "feedback": "Needs practice"
        }
      ]
    }
  ],
  "feedback_summary": "Excellent pronunciation!",
  "detected_language": "en-US",
  "transcription": "Good morning."
}
```

All scores are real Azure assessment values clamped to the public 0-100 contract. The service does **not** synthesize an 85/100 score when Azure is unavailable or omits pronunciation assessment data.

## Azure request

The provider integration uses the backend-only `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`. It does not reuse `AZURE_TRANSLATOR_KEY`.

For every request the service creates a Base64-encoded `Pronunciation-Assessment` header with:

- the trimmed `ReferenceText` supplied by the learner;
- `GradingSystem: HundredMark`;
- `Granularity: Phoneme`;
- `Dimension: Comprehensive`;
- `EnableMiscue: true`;
- three best phoneme candidates so feedback can distinguish the expected sound from Azure's highest-ranked spoken sound.

The Speech request asks for detailed output and masks profanity. Overall grading prefers Azure's `PronScore`, which is Azure's aggregate pronunciation-quality score, and uses provider `AccuracyScore` only when the aggregate is absent. Word and phoneme scores come directly from Azure's corresponding pronunciation-assessment objects.

## Failure behavior

The endpoint fails truthfully:

- missing/invalid authentication: rejected before controller execution;
- invalid body, blank reference text, untrusted media host, oversized/empty audio, unsupported codec: HTTP 400;
- Azure HTTP 400/415 caused by audio incompatibility: HTTP 400 with a stable client-safe message;
- missing Speech configuration, timeout/network failure, Azure capacity/auth/quota failures, malformed JSON, or a successful Speech response without real pronunciation scores: HTTP 503;
- free-tier daily AI cap or route/NLP abuse limits: existing 429 behavior.

Provider response bodies, keys, media URLs, reference text, audio bytes, transcripts, and user IDs are not included in pronunciation provider logs. Operational diagnostics are limited to provider status/region or recognition status.

The provider call has a 15-second timeout. Media download uses the same bounded timeout and rejects redirects.

## Privacy and retention

The backend downloads the learner's short audio only into memory and forwards it to Azure Speech for the requested assessment. The scoring service does not persist the audio, reference text, Azure response, transcript, or scores. Existing media retention/deletion rules for the source object remain authoritative.

Because the endpoint is explicitly no-store, shared caches must not retain its response. Operators must not add request/response body logging around this route.

## Verification

Focused verification:

```bash
cd backend
npm test -- --run \
  src/nlp/pronunciation-scoring.service.spec.ts \
  src/nlp/nlp.controller.spec.ts
npm run lint:check
npm run build
```

Regression coverage verifies:

- HundredMark/Phoneme/Comprehensive assessment header construction;
- the dedicated Azure Speech key and region;
- real overall, word, and phoneme score mapping;
- expected versus highest-ranked spoken phonemes;
- WAV and OGG provider content types;
- media-host allowlisting and redirect-safe source fetching;
- audio-size and codec validation;
- quota-before-provider ordering;
- fail-closed missing configuration and malformed/missing Azure assessment data;
- provider failure responses do not expose upstream diagnostics.

Repository CI remains authoritative for full backend/frontend/database/security checks.

## Rollout

1. Verify `AZURE_SPEECH_KEY` belongs to the Speech resource deployed in `AZURE_SPEECH_REGION`.
2. Verify pronunciation upload URLs use `CLOUDFLARE_R2_PUBLIC_URL` or an explicitly approved `CLOUDFLARE_R2_SOURCE_HOSTS` entry.
3. Verify clients produce 16 kHz mono PCM WAV or OGG/Opus and keep samples at or below 30 seconds.
4. Deploy the backend. No database migration or API response-shape migration is required.
5. Monitor rates of HTTP 400, 429, and 503 and sanitized Azure status diagnostics. A sharp rise in 400s indicates client audio-format drift; 503s indicate provider/configuration health.

## Rollback

Revert the application commits in this PR. There is no schema or persisted pronunciation state to unwind. Do not restore synthetic scores as an outage fallback; a provider outage must remain distinguishable from a genuine learner assessment.
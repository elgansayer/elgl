# Word of the Day

## Runtime contract

`GET /api/word-of-the-day` returns one reviewed vocabulary entry for the current UTC calendar day. The response contains:

- `word`: source-language vocabulary;
- `translation`: concise English gloss;
- `language`: display name for the source language;
- `languageCode`: ISO 639-1 source-language code;
- `example`: reviewed example sentence;
- `date`: UTC date in `YYYY-MM-DD` format.

The backend selects the entry deterministically from the checked-in curated catalogue. Every caller therefore receives the same entry for the same UTC day, and a process restart cannot change that day's selection.

## Failure semantics

The backend does not generate or substitute synthetic vocabulary when a request fails. An invalid internal date is treated as a programming error rather than returning fabricated content.

The Angular home card treats the API as a public content endpoint and does not require or transmit a Supabase access token. It validates the response before rendering it. Network errors, non-2xx responses, and malformed payloads produce a translated retry state instead of the former hard-coded `Hola` fallback.

## Caching

The endpoint uses the repository's short public cache policy. The vocabulary is daily, but a 24-hour edge TTL can cross UTC midnight and serve yesterday's entry for nearly another full day depending on when the cache was filled. The bounded public TTL trades a small amount of origin traffic for predictable day rollover.

## Privacy and security

Word of the Day is public product content. Requests do not require an account and do not include credentials, learner profile data, chat content, or other personal data. The catalogue contains reviewed application content only and has no runtime third-party provider dependency.

## Accessibility and responsive behaviour

The home card remains a named region. Loading is exposed as a status, failure as an alert, and retry is a native Spartan button with the repository touch target. Successful content uses wrapping-safe text so long translations and CJK examples can reflow at narrow widths and high zoom without horizontal overflow.

## Verification

Backend unit coverage locks deterministic UTC-day selection, date rollover, catalogue rotation, completeness, and invalid-date behavior. Frontend component coverage locks public fetching, successful rendering, malformed-response rejection, explicit failure presentation, and retry recovery.

Repository CI remains authoritative for the complete backend and frontend unit, lint/static-analysis, production-build, design-governance, and dependency checks.

## Rollout and rollback

No database migration, backfill, new secret, or provider configuration is required. Deploy the backend and frontend together or backend first; the additional response fields are backward-compatible with the previous client contract.

Rollback is a normal application revert. Do not restore fabricated client-side fallback vocabulary; an unavailable state is the truthful degraded behavior.

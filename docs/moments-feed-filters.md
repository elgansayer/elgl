# Moments feed filters

`GET /moments/feed` is authenticated by `SupabaseAuthGuard` and accepts the existing `filter` query parameter.

Supported filters are:

- `All`: the normal authenticated Moments feed.
- `Classmates`: Moments for the viewer's study language. `lang` may explicitly select the language; when omitted, the viewer's primary `target_languages` entry is used. If no target language is available, the endpoint returns an empty list rather than assuming English.
- `Following`: Moments from followed users. The viewer's own Moments are excluded from this filtered response.
- `For You`: the existing recommendation filter retained for backward compatibility.

Language values are trimmed and normalised to lowercase before they reach `MomentsService`. Unknown filters are rejected with HTTP 400 rather than silently widening the response to `All`.

The controller also removes legacy generated `mock-moment-*` fallback records from production feed responses. A genuinely empty feed is therefore represented as `[]`.

## Security and privacy

The route remains authenticated. Blocking and targeted-visibility rules continue to be owned by `MomentsService`; the controller does not bypass those checks. The Classmates default comes only from the authenticated viewer's own profile and no profile or language data is logged by this filter layer.

## Verification

The focused controller regression suite covers default `All`, explicit and profile-derived Classmates language selection, missing-language empty state, Following self-exclusion, mock-record suppression, and invalid-filter rejection.

Run the normal backend validation, including unit tests, lint, build, and E2E checks, before merge.

## Rollback

This change has no schema, persistence, or migration impact. Roll back by reverting the controller and its regression tests. Existing clients using `GET /moments/feed?filter=...` retain the same route shape.

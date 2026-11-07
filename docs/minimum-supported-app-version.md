# Minimum supported app version

Issue: #1415

## Contract

The NestJS version module exposes the minimum supported client version through `GET /version/minimum` (served as `/api/version/minimum` behind the application's global API prefix). The response is intentionally small and stable:

```json
{
  "minimumSupported": "2.4.1"
}
```

The endpoint is public because a client must be able to determine compatibility before or without an authenticated application session. It returns no account, device, request, or other personal data.

`MINIMUM_SUPPORTED_APP_VERSION` is the authoritative deployment setting. If it is omitted, the backend uses `1.0.0`. When configured, it must be a stable semantic version in `major.minor.patch` form. The service fails fast for malformed values instead of publishing a value that clients could compare incorrectly.

The minimum-version response uses `Cache-Control: no-store`. Compatibility policy can change independently of an already running client, so intermediaries and browsers must not extend an obsolete minimum-version decision through cached API data.

## Failure behaviour

The minimum-supported version is local configuration and does not depend on GitHub, Redis, Supabase, or another network provider. A GitHub release lookup failure can affect the separate `latest` version field returned by `GET /version`, but it does not affect `GET /version/minimum`.

Malformed configured minimum versions are deployment errors and stop service construction. Operators should fix the environment value rather than silently falling back to a different policy.

## Observability

The endpoint reads in-memory configuration, so the signals that matter are the shared ones:

- `MetricsInterceptor` (registered globally by `MetricsModule`) records request count and latency labelled by method, route and status code, which exposes unusual volume or error rates for `/version/minimum`.
- The shared structured request logger (`SharedLoggerModule`) emits one `request completed` line per call with `authorization` and `cookie` headers redacted. The endpoint adds no logging of its own because it handles no personal data.
- A malformed `MINIMUM_SUPPORTED_APP_VERSION` stops the backend at start-up with an error that names the variable and does not echo the rejected value.

## Verification

Focused backend coverage lives in:

- `backend/src/version/version.controller.spec.ts`, which locks the `GET /version/minimum` route, service delegation, the absence of any guard (the endpoint must stay public) and the `Cache-Control: no-store` header;
- `backend/src/version/version.service.spec.ts`, which covers configured/default values, whitespace normalisation, and rejection of malformed stable-version strings;
- `backend/test/app.e2e-spec.ts`, which boots the full `AppModule` with `MINIMUM_SUPPORTED_APP_VERSION` configured and asserts over HTTP that `GET /version/minimum` returns exactly `{ "minimumSupported": "<configured value>" }` as JSON with `Cache-Control: no-store`, and that `GET /version` (the response the Angular shell enforces) reports the same value.

The E2E suite does not apply the `/api` global prefix (only `main.ts` does), so it requests `/version/minimum`; the prefixed path is `/api/version/minimum` in a running deployment.

The repository backend unit, lint, build, and E2E workflows remain the authoritative merge validation.

## Rollout and rollback

Changing the supported-version floor requires only a backend configuration rollout. Raise the value only after the required client release is available through the supported distribution channels. Because the endpoint is not cached, newly started/rechecking clients receive the updated policy directly.

Rollback is a configuration change back to the previous stable semantic version followed by the normal backend rollout. No database migration, persisted user data change, or destructive cleanup is involved.

# Client crash analytics

## Scope

The Angular application installs `GlobalErrorHandler` as the root `ErrorHandler`. Browser-side uncaught failures are reported with a best-effort `POST /api/analytics/client-error` request. Reporting is deliberately non-blocking: an analytics outage must not create another application failure or prevent the original Angular error behavior.

The endpoint remains unauthenticated because failures can occur before a Supabase session exists. That public boundary is therefore treated as untrusted telemetry ingestion rather than a privileged application API.

## Privacy and security

Client reports are data-minimised before they leave the browser:

- page/request URLs retain only HTTP(S) origin and pathname; query strings, fragments and embedded credentials are discarded;
- messages, names, stack traces, user agents and stack-frame strings are length-bounded;
- at most 30 parsed stack frames are transmitted;
- concurrent identical reports are deduplicated while the first network request is in flight;
- SSR does not emit browser crash telemetry;
- the backend accepts only bounded DTO fields and whitelists `status`, `statusText` and `rawType` from metadata. Arbitrary nested client metadata is not persisted;
- the public ingestion route is throttled to 10 requests per minute per throttler identity;
- provider/database failure messages are never copied into logs or responses.

`client_errors` contains diagnostic material and is not a browser-readable analytics store. RLS is enabled and table privileges are revoked from `anon` and `authenticated`; the NestJS service-role client is the only normal application writer/reader.

Do not add access tokens, cookies, chat/Moment content, email addresses or other user content to this payload. A future field must be reviewed as telemetry before being added to both the DTO and persistence whitelist.

## Failure behavior and observability

The browser treats reporting as fire-and-forget. Failed telemetry is not retried by the error handler itself and is not written to local storage. The backend returns an unavailable response when Supabase persistence fails so HTTP metrics expose ingestion loss; it logs only a stable failure classification.

The existing `created_at` index supports recent-error operational queries. Alert on elevated `5xx` or throttling rates for `/api/analytics/client-error` and on unusual ingestion volume. Diagnostic queries should aggregate by error `name`/time before inspecting individual rows.

## Retention and deletion

Crash rows should be retained only for the operational debugging window. The retention target is 30 days: production operations should schedule deletion of rows where `client_errors.created_at < now() - interval '30 days'`. This change intentionally does not introduce a second application scheduler solely for analytics retention; retention automation belongs with the deployment/database maintenance layer and must be configured before production rollout. Account deletion does not need a per-user cascade because the crash table intentionally stores no user ID.

## Verification

Focused regression coverage verifies URL redaction, payload bounds, in-flight deduplication, DTO limits, metadata whitelisting and fail-closed persistence. A clean Supabase migration replay verifies the service-role-only table boundary.

Recommended production smoke check:

1. trigger a synthetic browser error on a non-sensitive test route;
2. confirm one bounded row is stored and the URL contains no query or fragment;
3. submit an oversized or over-frame payload directly and confirm validation rejects it;
4. confirm `anon`/`authenticated` direct table access is denied;
5. temporarily break the persistence dependency in staging and confirm the endpoint returns `5xx` without provider details in logs.

## Rollout and rollback

Roll out the additive RLS/grant migration before or with the backend. The backend already uses `SUPABASE_SERVICE_ROLE_KEY`, so mixed frontend versions can continue to post the legacy payload shape while the DTO accepts the same fields within production-safe limits. Then deploy the frontend privacy/bounding changes.

A normal application rollback can revert frontend/backend code while leaving the RLS/grant hardening in place. Do not roll back direct-table protection. If legacy clients exceed the new bounds, prefer increasing a reviewed bound rather than restoring unbounded ingestion.

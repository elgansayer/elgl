# My Stats dashboard production contract

Issue: #395

## Scope

`GET /api/stats/me` is the authenticated source for the My Stats dashboard. It exposes only the requesting user's aggregate learning/activity metrics:

- `study_hours`: seven UTC day buckets for the current Sunday-to-Saturday week, derived from completed direct-call durations where the user was the caller or receiver.
- `messages_sent`: lifetime count of chat messages sent by the user.
- `corrections_count`: lifetime count of Moment comments authored by the user that contain a correction payload.
- `moments_count`: lifetime count of Moments authored by the user.

The dashboard renders the study-hours time series, an activity breakdown, and summary counts. No new persistent analytics table is introduced by this feature.

## Data integrity and query bounds

The backend calculates week boundaries and day buckets in UTC so deployments in different server time zones return the same result. Weekly call-log reads are capped at 10,000 rows. Reaching that cap is treated as an unavailable result instead of silently returning partial study time.

Malformed timestamps and non-positive/non-finite durations are ignored. A single call can contribute at most 24 hours, preventing corrupt source rows from dominating the aggregate. Count responses must be non-negative safe integers; malformed count results fail closed.

The four source queries execute concurrently to avoid avoidable request latency and N+1 query behavior.

## Authentication, privacy, and security

The endpoint is protected by `SupabaseAuthGuard` and derives the subject exclusively from the verified session. It does not accept a user ID from the request.

Responses include `Cache-Control: private, no-store` because the aggregates are account-private activity data. The Angular client also requests with `cache: 'no-store'` and keeps the response only in component memory.

Provider failures are converted to a stable `503 Service Unavailable` response. Logs identify only the failing aggregate stage and, when available, a conservative provider error code. User IDs, tokens, query contents, provider messages, and private activity data are not logged by the stats service.

## Failure handling

The dashboard deliberately fails the aggregate request when any source is unavailable. Mixing fresh and missing metrics would present an inaccurate personal dashboard as authoritative data.

The Angular client:

- requires an authenticated access token before making the request;
- aborts an in-flight request when Angular disposes/restarts the resource;
- validates the complete runtime response before rendering it;
- rejects negative/malformed counts and incomplete/duplicate seven-day series;
- shows an accessible error state with a Retry action after transient failures.

No placeholder or synthetic statistics are used in production failure paths.

## Accessibility and responsive behavior

Chart.js canvases are treated as visual enhancements. The weekly study-hours chart has a screen-reader text equivalent containing all seven daily values, while the pie-chart values are duplicated in semantic summary data. Loading uses a polite status region, failures use an alert region, and the Retry control uses the shared Spartan button primitive.

The existing one-column mobile layout expands to two columns at the established medium breakpoint, with the summary spanning the available desktop width. Text remains normal document content so browser zoom and reflow continue to work without a separate viewport-specific data path.

## Observability

A stats failure emits a sanitized NestJS error log containing the aggregate stage (`query_execution`, `call_logs`, `chat_messages`, `moment_comments`, `moments`, result limit, or malformed count) and optionally a short provider error code. This is sufficient to distinguish source outages and data-integrity failures without exposing account data.

## Verification

Focused automated coverage verifies:

- authenticated dashboard retrieval and empty-state zeroes;
- seven UTC day buckets and duration aggregation;
- the 10,000-row weekly call-log bound;
- corrupt duration protection;
- stable, non-leaking provider failure behavior;
- malformed count rejection;
- authenticated frontend requests and no unauthenticated network call;
- runtime response validation;
- loading/error/retry behavior;
- the accessible chart text equivalent.

Repository CI remains the authoritative clean-environment verification for lint, builds, unit suites, static analysis, E2E contracts, and UI governance.

## Rollout and rollback

There is no schema migration. Backend and frontend can be deployed independently: the response shape is unchanged and the frontend validation accepts the existing canonical shape.

Rollback is a normal application revert. No database rollback, backfill, retention job, or stored user-data cleanup is required.

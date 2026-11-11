# Performance report

Issue: #2038

## Outcome

`GET /api/stats/me/report?period=week|month` gives a learner a detailed, comparable view of their own progress: activity totals for the latest rolling window next to the equally long window before it, the badges unlocked in the latest window, and the persisted study streak. `PerformanceReportComponent` renders it as a section of the My Stats screen (`/profile/me/stats`).

It extends the existing My Stats dashboard (`docs/my-stats-dashboard.md`) and the badge catalogue (`docs/achievements-service.md`). It adds no table, column, job or persisted copy of user data.

## API contract

```
GET /api/stats/me/report?period=week
GET /api/stats/me/report?period=month
Authorization: Bearer <Supabase access token>
```

- `period` is optional and defaults to `week`. Any other value, and any other query parameter (including a `userId`), is rejected with `400` by the global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`).
- The subject is always the verified session. There is no way to request another account's report.
- Responses carry `Cache-Control: private, no-store`.

```ts
interface PerformanceReportResponse {
  period: 'week' | 'month';
  window: { start: string; end: string }; // [start, end), ISO-8601 UTC
  previous_window: { start: string; end: string }; // the equally long window before `window`
  metrics: Array<{
    key:
      'study_hours' | 'messages_sent' | 'corrections_made' | 'moments_posted' | 'lessons_completed';
    current: number;
    previous: number;
  }>; // always all five keys, in this order
  badges_unlocked: Array<{
    code: string;
    name: string;
    description: string;
    unlocked_at: string;
  }>; // newest first, at most 50
  streak_days: number;
}
```

Status codes: `200`, `400` (invalid query), `401` (no or invalid session), `429` (global throttle, 10 requests per minute), `503` (a source is unavailable).

## Windows

Windows are rolling and measured in UTC instants, so the result does not depend on the server time zone or the learner's locale:

| Period  | `window`               | `previous_window`             |
| ------- | ---------------------- | ----------------------------- |
| `week`  | the last 7 x 24 hours  | the 7 x 24 hours before that  |
| `month` | the last 30 x 24 hours | the 30 x 24 hours before that |

Rolling windows of equal length keep the comparison fair: a calendar week or month that is still in progress would always look smaller than the finished one before it.

## Metric definitions

Each definition matches the lifetime figure the learner already sees elsewhere, restricted to the window.

| Key                 | Source                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `study_hours`       | `call_logs.duration_seconds` where the learner was caller or receiver, by `started_at`, rounded to 0.1 h |
| `messages_sent`     | `chat_messages` with `sender_id` equal to the learner, by `created_at`                                   |
| `corrections_made`  | `moment_comments` by the learner with a `correction_payload`, by `created_at`                            |
| `moments_posted`    | `moments` by the learner (stories included, as on the dashboard), by `created_at`                        |
| `lessons_completed` | `lesson_progress` rows of the learner with `completed = true`, by `completed_at`                         |

`streak_days` is the persisted `users.study_streak_days`. `badges_unlocked` is read from `user_achievements.unlocked_at` joined to the catalogue.

## Query bounds and performance

- One request runs 11 independent queries concurrently: two head-count queries (current and previous window) for each of the four counted sources, one bounded call-log read, one streak read and one bounded badge read. There is no per-row follow-up query (no N+1).
- Counts are `head: true` exact counts filtered by the learner id and a time range, so no rows are transferred.
- The call-log read covers both windows in a single query and is capped at 10,000 rows. Reaching the cap fails the report instead of understating study time. Malformed timestamps and non-positive or non-finite durations are ignored, and one call contributes at most 24 hours.
- The badge read is capped at 50 rows (the catalogue holds 12 badges).
- Existing indexes are used: `moments_user_created_idx`, `moment_comments_user_created_idx`, `chat_messages_sender_id_idx`, the `lesson_progress` primary key `(user_id, lesson_id)`, the `call_logs` caller and receiver indexes and `user_achievements (user_id)`. No migration is required.

## Failure handling

The report is all or nothing. If any source errors, times out or returns a malformed count, the endpoint answers `503 Performance report is temporarily unavailable`. It never returns zeroes or partial figures for a source that failed, and it never falls back to mock data. Counts must be non-negative safe integers.

The frontend validates the whole payload at runtime before rendering it: the period must match the request, all five metric keys must be present exactly once with non-negative numbers, badges must be well formed and the streak must be a non-negative integer. Anything else shows the error state with a Retry button.

## Security, privacy and abuse resistance

- `SupabaseAuthGuard` protects the route and the subject comes only from the session.
- The response holds aggregate counts, the learner's own badge names and one streak number. It contains no message text, correction text, call participants or other users' data.
- The per-learner work is bounded by the caps above and by the global throttle (10 requests per minute).
- The access token is sent only in the `Authorization` header and is never logged.

## Observability

Failures log fixed identifiers only: `performance_report.<source>_failed`, optionally followed by a short provider error code (`code=PGRST123`) that is validated against `^[A-Za-z0-9_-]{1,32}$`. `<source>` is one of `chat_messages`, `moment_comments`, `moments`, `lesson_progress`, `call_logs`, `call_logs_result_limit`, `streak` or `invalid_count`. Badge read failures log `achievements.unlocked_read_failed`. User ids, provider messages, query contents and tokens are never logged, so a failing source can be identified without database access.

Latency and request volume for `GET /stats/me/report` are recorded by the global `MetricsInterceptor` (`hellotalk_http_request_duration_seconds` and `hellotalk_http_requests_total`, labelled by method and route), so a latency regression is visible without a new metric. The interceptor records an error response before the exception filter sets its status code, so use the `performance_report.*_failed` log identifiers, not the status-code label, to measure failures.

## Frontend behaviour and accessibility

- The period switch is a labelled group of two buttons using `aria-pressed`. Changing it reloads the report and aborts the request that is still in flight.
- Loading uses a polite `role="status"` region, failure uses `role="alert"` with a Retry button, and the section sets `aria-busy` while loading.
- Every comparison is worded ("Up 7 on the previous period", "Down 3 on the previous period", "No change on the previous period"). The arrow icon is decorative (`aria-hidden`) and colour is not used to carry meaning.
- Numbers are formatted for the interface language with `Intl.NumberFormat`. All copy comes from translation keys (`stats.report.*`). Layout uses logical properties and collapses from three columns to two to one as the width shrinks, so it reflows at high zoom.
- Badge names and descriptions resolve through `achievements.badge.<code>.name` and `.description`, falling back to the server text for a badge the dictionary does not know yet.

## Retention

Nothing new is persisted. The report is computed on request from data that already follows the `users` cascade lifecycle, and is not cached on the server or in the browser.

## Verification

- `backend/src/stats/performance-report.service.spec.ts`: windows, fixed metric order, caller and window scoping of every query, call-log bucketing and caps, missing streak row, every source failing closed with sanitised logs, malformed counts, and the achievement store outage.
- `backend/src/stats/dto/performance-report-query.dto.spec.ts`, `backend/src/stats/stats.controller.spec.ts` and `backend/test/performance-report.e2e-spec.ts`: authentication, validation, self-only access, uncached responses and stable `503` behaviour.
- `backend/src/stats/stats.module.spec.ts`: module wiring.
- `frontend/src/app/components/my-stats/performance-report.component.spec.ts`: request shape, rendering, worded trends, period switching and abort, loading, error and retry, runtime rejection of malformed payloads, translated badge copy and locale number formatting.

Repository CI remains the authoritative clean-environment verification.

## Rollout and rollback

No schema migration, backfill or configuration change is needed. Deploy the backend first and the frontend second; an older frontend simply does not call the route, and a newer frontend against an older backend shows the error state for the report section only.

Rollback is a normal application revert of the backend and frontend. There is no stored state to clean up.

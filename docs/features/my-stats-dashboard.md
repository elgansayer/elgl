# My Stats dashboard

Issue: #395

## Scope

The My Stats dashboard is the authenticated personal-learning summary served by `GET /stats/me` and rendered by `MyStatsComponent`.

It reports:

- study hours for the current week, grouped into Sunday through Saturday buckets from completed call-log duration;
- total chat messages sent by the authenticated user;
- total corrections authored by the authenticated user, derived from Moment comments with a correction payload;
- total Moments posted, which is shown as an additional activity metric.

The dashboard renders weekly study time as a line chart, activity totals as a pie chart, and message/correction/Moment totals as summary cards.

## Authentication and privacy

`StatsController.getMyStats()` is guarded by `SupabaseAuthGuard`. The controller takes the user ID only from the authenticated request subject and does not accept another user ID from query/body input.

The frontend sends the current access token to `/stats/me`. If there is no access token, the resource fails instead of making an anonymous request.

No stats endpoint response contains message text, correction text, call participants, or other users' personal data. The response consists only of aggregate counts and per-day study-hour totals for the authenticated user.

## Data contract

```ts
interface MyStatsResponse {
  study_hours: Array<{ day: string; hours: number }>;
  messages_sent: number;
  corrections_count: number;
  moments_count: number;
}
```

Study hours are calculated from `call_logs.duration_seconds` for calls where the current user is either caller or receiver, restricted to the current week. Values are rounded to one decimal place and zero-filled so all seven weekday buckets are always present.

Message, correction, and Moment totals use exact count queries and return zero when the database returns no rows/count.

## Failure behaviour

Database/query failures are propagated by `StatsService`; the backend does not replace unavailable data with fabricated zeroes. The Angular resource consequently enters its error state and renders translated unavailable copy.

A successful empty dataset is different from failure: it produces seven zero-hour buckets and zero activity totals.

## Accessibility and localisation

Visible dashboard headings, metric labels, loading/error text, weekday abbreviations, and chart labels are translation-owned through the application i18n layer. Summary values are also present as ordinary DOM text rather than being available only inside canvas charts.

The chart visualisations are supplemental to the text summary. Future chart changes must preserve equivalent non-canvas text for important activity totals and must not make colour the only way to communicate a metric.

## Verification

Backend coverage includes:

- authenticated subject forwarding from `StatsController` to `StatsService`;
- an explicit regression assertion that `SupabaseAuthGuard` protects the personal endpoint;
- failure propagation rather than fabricated successful output;
- weekly call-duration aggregation and one-decimal rounding;
- exact activity counts and successful empty-data behaviour;
- database failure handling.

Frontend coverage includes:

- authenticated `/stats/me` requests;
- loading and unavailable states;
- rendering the returned summary totals.

Canonical repository CI remains authoritative for merge readiness.

## Rollout and rollback

This completion change does not alter the API, database schema, route, or production calculation. Rollback is a normal revert of the documentation/test commit. The production dashboard implementation remains unchanged.

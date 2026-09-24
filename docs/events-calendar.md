# Upcoming events calendar

Issue: #1515

## Product contract

`/events/calendar` is the authenticated learner's calendar of upcoming events. It includes both:

- events the learner hosts; and
- events where the learner has RSVP'd as `attending` or `interested`.

The calendar is intentionally future-facing. The current month is the earliest navigable month, cancelled events are suppressed, and an event that has already started is not reintroduced when the current month is refreshed. Event details continue to use the canonical `/events/:id` route.

Dates and times are rendered in the browser's locale and local timezone. The frontend sends the displayed local month's ISO start/end boundaries to the backend, so events near a UTC date boundary remain grouped by the date the learner sees locally.

## API

The calendar uses:

```text
GET /events/my/calendar?from_date=<ISO>&to_date=<ISO>&limit=100
```

Authentication is provided by the existing Supabase JWT guard. The backend derives the user ID from the verified session and never accepts a caller-supplied user identifier.

`from_date` and `to_date` are required ISO-8601 timestamps. `limit` is optional and constrained to `1..100`; service code applies the same 100-item cap defensively for programmatic callers. The frontend requests one displayed month at a time, rather than fetching an unbounded RSVP history and filtering it in the browser.

The two bounded source queries are executed in parallel. Hosted events and RSVP events are merged by event ID and sorted chronologically. This also fixes the previous behavior where a learner's own event disappeared from My Events unless they separately RSVP'd to it.

## Failure behavior

A storage/provider failure returns a stable unavailable response instead of presenting a false empty calendar. The Angular resource renders an explicit error with Retry and preserves the displayed month so retry performs the same range request.

Malformed or cancelled event records are rejected at the read boundary and are also ignored defensively by the frontend. Invalid/reversed date ranges fail before storage access. A range that has entirely elapsed resolves to an empty upcoming result without querying the database.

Logs identify only the failed calendar operation. They do not include user IDs, event titles/descriptions, RSVP details, access tokens, raw provider messages, or location data.

## Privacy and security

The endpoint returns only events belonging to the authenticated learner's host/RSVP calendar. It does not expose another user's calendar or a list of attendees. Existing event content is rendered by Angular text interpolation rather than raw HTML.

The read is bounded to 100 merged rows per displayed month. This avoids the historical `/events/my` pattern of loading every RSVP ID before looking up events and limits both response size and provider work.

## Accessibility and internationalisation

The calendar uses native/Spartan buttons for month and date interactions, a labelled grid, `aria-pressed` for the selected date, and `aria-current="date"` for today. Loading and error states are announced independently from a genuinely empty date.

User-authored title, description, and location content uses `dir="auto"` for mixed-direction text. Month/date/time labels continue to use the active application locale and browser timezone. At the current-month boundary, Previous is a real disabled button rather than an inert visual affordance.

## Verification

Regression coverage includes:

- month-specific range requests and refetch on month navigation;
- prevention of past-month navigation for the upcoming calendar;
- hosted-only, RSVP-only, and duplicate host+RSVP events;
- current-time clamping and elapsed-range short-circuiting;
- the 100-item API/service bound;
- reversed date ranges and provider failures;
- malformed/cancelled record filtering;
- loading, failure, retry, selection, and calendar accessibility semantics.

Repository CI remains authoritative for NestJS unit/build/lint, Angular unit/build/static analysis, E2E contracts, dependency review, translation safety, and UI governance.

## Rollout and rollback

No database migration or persisted-state rewrite is required. Deploy the backend endpoint before or with the frontend. Mixed versions are safe because the legacy `/events/my` endpoint remains unchanged.

To roll back, revert the frontend to `/events/my?status=upcoming`, then remove the new calendar endpoint/service if desired. No data cleanup is required. The legacy endpoint should not be removed as part of this issue because other clients may still use it.

# Lessons module

## Learner contract

The learner-facing Angular routes are `/lessons` and `/lessons/:id`. They use the authenticated NestJS API instead of frontend fixture data.

- `GET /lessons?language=<code>` returns at most 100 published, learner-visible lessons ordered by `sort_order` and creation time. Each item includes the authenticated user's progress.
- `GET /lessons/:id` returns the lesson content and the authenticated user's progress. Hidden, unpublished, and non-entitled VIP lessons return `404` so the API does not disclose gated content.
- `PUT /lessons/:id/progress` accepts `progressPercent` (0-100), `lastPosition` (>= 0), and/or `completed`. Progress writes are monotonic and idempotent.

All three routes require `SupabaseAuthGuard`. The existing `/admin/lessons` CRUD routes remain protected by both `SupabaseAuthGuard` and `AdminGuard`.

## Content model

`lessons.content_json` remains backward compatible. The learner renderer treats content as text, never as trusted HTML. Preferred new content uses a `sections` array:

```json
{
  "sections": [
    { "title": "Greeting", "body": "こんにちは" },
    { "title": "Practice", "body": "Repeat the greeting aloud." }
  ]
}
```

A section can also use `text` or `content` instead of `body`. Legacy flat objects containing string values are rendered as titled sections. Unsupported nested values are ignored rather than stringified or inserted as HTML.

## Visibility and authorization

Migration `20260820172500_lessons_learning_progress.sql` adds three lesson publication controls:

- `is_published`: defaults to `true` so existing lessons remain available during rollout.
- `visibility`: `public`, `vip`, or `hidden`; defaults to `public`.
- `sort_order`: stable learner catalogue ordering, default `0`.

The backend uses its authenticated user identity for progress operations. Client-supplied user IDs are never accepted. VIP entitlement lookup fails closed: an entitlement lookup failure can hide VIP lessons but cannot expose them.

`lesson_progress` has a `(user_id, lesson_id)` primary key and RLS permits authenticated users to read only their own rows. Direct client inserts and updates are deliberately denied; all progress mutations go through the authenticated backend and the service-role-only atomic function. The learner API also scopes every progress query by the authenticated user ID.

## Progress, retries, and concurrency

The `upsert_lesson_progress` database function is the canonical mutation path. It uses `INSERT ... ON CONFLICT DO UPDATE` with `GREATEST` and `COALESCE`, so concurrent/retried writes cannot reduce `progress_percent`, move `last_position` backwards, or clear `completed_at`. Completion forces progress to 100 percent.

The Angular lesson detail page resumes at `last_position`, persists forward movement with `PUT`, and exposes completion separately. A failed mutation leaves the local lesson usable and surfaces an error; a later retry is safe.

## UX and accessibility

The catalogue and detail routes explicitly render loading, empty, API-error, and unauthorized failure states. Catalogue cards are keyboard-focusable links, progress is exposed through native `progressbar` ARIA values, controls have visible focus treatment and at least 44px minimum height, and lesson content uses normal text nodes so browser zoom/reflow and screen readers work without special handling. Important completion state is communicated by text as well as colour.

Deep links to `/lessons/:id` fetch authorization and content directly and do not depend on first visiting the catalogue.

## Observability

Backend database, progress, and entitlement failures are logged through the NestJS `LessonsService` logger. Logs identify the operation and lesson identifier where useful but do not log access tokens or lesson content.

## Rollout

1. Apply `20260820172500_lessons_learning_progress.sql`.
2. Verify existing lessons have `is_published = true` and `visibility = 'public'` unless intentionally changed.
3. Deploy the backend learner endpoints.
4. Deploy the Angular frontend.
5. Smoke test an authenticated public lesson, a VIP-gated lesson with and without entitlement, a direct `/lessons/:id` deep link, resume after reload, and repeated completion requests.

The migration must precede backend deployment because the learner queries reference the new publication columns and progress table.

## Rollback and recovery

Frontend and backend code can be reverted independently after the previous application version is restored. The additive database columns, progress table, and function are safe to leave in place during rollback and should not be dropped while a deployed client may still send progress requests. If a deployment is rolled back, retain `lesson_progress` so learner state is not lost. A later redeploy can resume from the persisted rows without migration replay.

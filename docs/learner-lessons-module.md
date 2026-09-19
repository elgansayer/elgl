# Learner lessons module

Issue #617 completes the learner-facing Angular Lessons module on top of the existing lesson authoring model. The earlier read-only surface remains backward compatible, while authenticated learners now get resumable per-user progress and monotonic completion state.

## Architecture

`LessonsService` is the learner-facing Angular API client. It sends the current Supabase bearer token to:

- `GET /api/lessons`
- `GET /api/lessons/:id`
- `GET /api/lessons/:id/progress`
- `PUT /api/lessons/:id/progress`

The NestJS `LearningLessonsController` exposes those routes behind `SupabaseAuthGuard` and derives progress ownership from the authenticated user. Clients never choose a `user_id`. Lesson creation, editing, deletion and upload management remain under the existing admin-only `/api/admin/lessons` controller.

The `/lessons` Angular page owns both browsing and reading. Selecting a lesson uses the `lesson` query parameter so the existing route and deep links remain backward compatible. Cards are native links, images use browser lazy loading, and the reader exposes segmented progress with native/Spartan controls. The saved segment is loaded alongside the lesson and clamped to current authored content, so shortening a lesson does not strand a learner at an invalid position.

## Content contract

Admin-authored `content_json` remains backward compatible. The learner UI recognises these optional fields:

```json
{
  "featured": true,
  "duration_minutes": 12,
  "stream_url": "https://example.com/live",
  "segments": [
    {
      "title": "Warm-up",
      "text": "Learner-visible plain text",
      "stream_url": "https://example.com/segment"
    }
  ]
}
```

Unknown fields are ignored. Malformed segment entries are discarded. If no usable segments exist, the plain-text lesson description is used as the reading segment. User-visible content is interpolated as text, never treated as trusted HTML.

`difficulty_level` maps from `1..6` to `A1..C2`. The "For your level" row reads the authenticated user's proficiency metadata when available and otherwise falls back to non-featured lessons. If authors have not marked any lesson as featured, the first three returned lessons form the Featured row so existing data remains usable.

## Progress and completion contract

Migration `20260826220000_lesson_progress.sql` adds one `lesson_progress` row per `(user_id, lesson_id)` with:

- a bounded `segment_index` from `0` through `10000`;
- a boolean `completed` flag;
- `completed_at` and `updated_at` timestamps;
- cascading foreign keys so progress is removed when either the learner account or lesson is deleted.

`PUT /api/lessons/:id/progress` is an idempotent upsert. The server checks that the requested segment exists in the current readable lesson content and only accepts `completed: true` for the final segment. A database trigger makes completion monotonic: retries and stale clients cannot turn a completed lesson back into an incomplete one or overwrite its original completion timestamp.

The Angular reader persists each successful Previous/Next transition. Reaching the final segment marks the lesson complete. A failed write restores the previous visible segment and exposes an alert, so the browser never suggests progress was saved when persistence failed. A progress-read failure is partial rather than destructive: lesson content remains readable from the first segment and the error is visible. One-segment lessons are completed when the learner reaches that only segment.

## Security and privacy

Learner reads and progress writes require a valid Supabase session. The browser fails closed before network I/O if no access token exists. The API derives ownership exclusively from the authenticated session and never accepts a learner identifier from the body or URL.

The `lesson_progress` table has row-level security restricting authenticated reads/inserts/updates to `auth.uid() = user_id`, providing defence in depth underneath the NestJS boundary. Progress contains only lesson identifiers, resume position and timestamps; lesson text, authentication credentials and other private content are not copied into progress rows or logs.

Media links are accepted only when they parse as HTTP or HTTPS URLs. External stream links use `noopener noreferrer`. API/provider failures propagate into explicit retry/error states instead of returning fabricated lesson or progress data.

## Accessibility and responsive behaviour

- Lesson cards are native links with visible focus treatment and a title-based accessible name.
- Cover images use the lesson title as alternate text and `loading="lazy"`.
- Reader progress uses `role="progressbar"` with numeric and textual progress values.
- Previous/Next actions use touch-sized Spartan buttons and native disabled semantics; actions are disabled while a progress mutation is in flight to prevent conflicting writes.
- Progress persistence failures use an alert rather than colour alone.
- Content wraps at narrow widths and high zoom; layouts move from one to two to three columns without physical left/right spacing utilities.
- Lesson text and titles remain plain text, allowing browser selection, screen readers and multilingual shaping.

## Failure handling and operations

Progress storage is intentionally a small, indexed lookup by learner and lesson. There are no collection scans or background jobs. Database failures fail the mutation rather than creating a local-only success state. Repeated PUTs are safe because the composite primary key is the upsert conflict target and completion is monotonic.

The `lesson_progress_user_updated_idx` index supports future recent-learning/resume queries without changing the current API contract. No learner content is logged as part of this flow. Existing application/database telemetry remains responsible for correlating endpoint and provider failures.

## Verification

Focused automated coverage lives in:

- `backend/src/lessons/learning-lessons.controller.spec.ts`
- `backend/src/lessons/lessons.service.spec.ts`
- `backend/src/database/migrations/20260826220000_lesson_progress.spec.ts`
- `frontend/src/app/services/lessons.service.spec.ts`
- `frontend/src/app/pages/lessons/lessons.component.spec.ts`
- `frontend/src/app/pages/lessons/lessons.model.spec.ts`

The repository CI remains authoritative for clean Supabase replay, frontend unit/static-analysis/build, backend unit/lint/build/E2E, design governance and dependency review.

## Rollout and rollback

Deploy the additive database migration before or with the backend. The existing lesson list/detail routes and admin authoring contract are unchanged, so older frontends remain compatible. New frontends treat unavailable progress APIs as a visible partial failure while keeping lesson content readable.

For rollback, revert the frontend and backend first. The additive `lesson_progress` table can remain in place safely while old application versions run. If the feature is permanently removed and retention requirements permit deletion, drop the trigger/function and table in a later forward migration rather than rewriting deployed migration history. Account and lesson deletion already cascade associated progress rows.
